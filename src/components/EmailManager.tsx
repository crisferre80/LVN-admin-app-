import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { sendEmail, sendBatchEmails } from '../lib/resend';
import { render } from '@react-email/render';
import NewsletterEmail from '../emails/NewsletterEmail';
import CampaignEditor from './CampaignEditor';
import TemplateEditor from './TemplateEditor';
import { importContactsFromCSV, exportContactsToCSV } from '../lib/emailCampaigns';
import toast from 'react-hot-toast';
import { 
  EnvelopeIcon, 
  UserGroupIcon, 
  DocumentTextIcon,
  PaperAirplaneIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

interface EmailContact {
  id: string;
  email: string;
  name: string | null;
  status: 'active' | 'unsubscribed' | 'bounced';
  tags: string[] | null;
  subscribed_at: string;
}

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  total_recipients: number;
  sent_count: number;
  opened_count: number;
  created_at: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  html_content: string;
  template_type: string;
}

type TabType = 'contacts' | 'campaigns' | 'templates' | 'send';

export default function EmailManager() {
  const [activeTab, setActiveTab] = useState<TabType>('contacts');
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para formularios
  const [showCampaignEditor, setShowCampaignEditor] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | undefined>();
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | undefined>();

  // Monitorear cambios en activeTab
  useEffect(() => {
    console.log('[EmailManager] 📍 Estado activeTab cambió a:', {
      pestaña: activeTab,
      timestamp: new Date().toISOString()
    });
  }, [activeTab]);

  const handleTabChange = (tab: TabType) => {
    console.log('[EmailManager] 🔄 Cambio de pestaña:', {
      pestañaAnterior: activeTab,
      pestañaNueva: tab,
      timestamp: new Date().toISOString()
    });
    setActiveTab(tab);
    console.log('[EmailManager] ✅ Pestaña cambiada a:', tab);
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'contacts':
          await loadContacts();
          break;
        case 'campaigns':
          await loadCampaigns();
          break;
        case 'templates':
          await loadTemplates();
          break;
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    const { data, error } = await supabase
      .from('email_contacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setContacts(data || []);
  };

  const loadCampaigns = async () => {
    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setCampaigns(data || []);
  };

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setTemplates(data || []);
  };

  const deleteContact = async (id: string) => {
    if (!confirm('¿Eliminar este contacto?')) return;

    const { error } = await supabase
      .from('email_contacts')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Error eliminando contacto');
      return;
    }

    toast.success('Contacto eliminado');
    loadContacts();
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('¿Eliminar esta campaña?')) return;

    const { error } = await supabase
      .from('email_campaigns')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Error eliminando campaña');
      return;
    }

    toast.success('Campaña eliminada');
    loadCampaigns();
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return;

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Error eliminando plantilla');
      return;
    }

    toast.success('Plantilla eliminada');
    loadTemplates();
  };

  const sendTestEmail = async () => {
    const testEmail = prompt('Ingresa el email de prueba:');
    if (!testEmail) return;

    const loadingToast = toast.loading('Enviando email de prueba...');

    try {
      console.log('🚀 Iniciando envío de email de prueba a:', testEmail);
      
      const emailHtml = await render(
        <NewsletterEmail
          subscriberName="Usuario de Prueba"
          articles={[
            {
              title: 'Título de ejemplo',
              summary: 'Este es un resumen de ejemplo para probar la plantilla.',
              category: 'Noticias',
              image_url: 'https://via.placeholder.com/600x400',
              url: 'https://lavozdelnortediario.com.com.ar',
            },
          ]}
        />
      );

      console.log('📝 HTML renderizado, longitud:', emailHtml.length);

      const result = await sendEmail({
        to: testEmail,
        subject: '📰 Email de Prueba - La Voz del Norte',
        html: emailHtml,
      });

      console.log('📬 Resultado del envío:', result);

      if (result.success) {
        toast.success('Email de prueba enviado correctamente', { id: loadingToast });
      } else {
        throw new Error('Error enviando email');
      }
    } catch (error) {
      console.error('❌ Error enviando email de prueba:', error);
      toast.error('Error enviando email de prueba', { id: loadingToast });
    }
  };

  const sendBulkEmail = async (
    templateId: string,
    subject: string,
    contactIds: string[]
  ) => {
    console.log('🚀 Iniciando envío masivo');
    console.log('📧 Plantilla:', templateId);
    console.log('📝 Asunto:', subject);
    console.log('👥 Contactos:', contactIds.length);

    const loadingToast = toast.loading(
      `Enviando email a ${contactIds.length} contacto(s)...`
    );

    try {
      // Llamar a la Edge Function de envío masivo
      const result = await sendBatchEmails(templateId, subject, contactIds);

      if (result.success) {
        console.log(`
📊 Resumen del envío:
✅ Exitosos: ${result.successCount}
❌ Fallidos: ${result.errorCount}
📧 Total: ${result.total}
`);

        toast.success(
          `Emails enviados: ${result.successCount} exitosos, ${result.errorCount} fallidos`,
          { id: loadingToast }
        );
      } else {
        throw new Error('Error en el envío masivo');
      }
    } catch (error) {
      console.error('❌ Error en envío masivo:', error);
      toast.error('Error enviando emails', { id: loadingToast });
    }
  };

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          📧 Gestión de Emails
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Administra contactos, campañas y plantillas de email
        </p>
      </div>

      {/* Campaign Editor Modal */}
      {showCampaignEditor && (
        <CampaignEditor
          campaignId={editingCampaignId}
          onClose={() => {
            setShowCampaignEditor(false);
            setEditingCampaignId(undefined);
          }}
          onSaved={() => {
            setShowCampaignEditor(false);
            setEditingCampaignId(undefined);
            loadCampaigns();
          }}
        />
      )}

      {/* Template Editor Modal */}
      {showTemplateEditor && (
        <TemplateEditor
          templateId={editingTemplateId}
          onClose={() => {
            setShowTemplateEditor(false);
            setEditingTemplateId(undefined);
          }}
          onSaved={() => {
            setShowTemplateEditor(false);
            setEditingTemplateId(undefined);
            loadTemplates();
          }}
        />
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max">
          <button
            onClick={() => handleTabChange('contacts')}
            className={`pb-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
              activeTab === 'contacts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <UserGroupIcon className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1 sm:mr-2" />
            Contactos ({contacts.length})
          </button>
          <button
            onClick={() => handleTabChange('campaigns')}
            className={`pb-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
              activeTab === 'campaigns'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <EnvelopeIcon className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1 sm:mr-2" />
            Campañas ({campaigns.length})
          </button>
          <button
            onClick={() => handleTabChange('templates')}
            className={`pb-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1 sm:mr-2" />
            Plantillas ({templates.length})
          </button>
          <button
            onClick={() => handleTabChange('send')}
            className={`pb-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
              activeTab === 'send'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <PaperAirplaneIcon className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1 sm:mr-2" />
            Enviar
          </button>
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      ) : (
        <>
          {activeTab === 'contacts' && (
            <ContactsTab
              contacts={contacts}
              onDelete={deleteContact}
              onRefresh={loadContacts}
            />
          )}

          {activeTab === 'campaigns' && (
            <CampaignsTab
              campaigns={campaigns}
              onDelete={deleteCampaign}
              onRefresh={loadCampaigns}
              onEdit={(id: string) => {
                setEditingCampaignId(id);
                setShowCampaignEditor(true);
              }}
              onNew={() => {
                setEditingCampaignId(undefined);
                setShowCampaignEditor(true);
              }}
            />
          )}

          {activeTab === 'templates' && (
            <TemplatesTab
              templates={templates}
              onDelete={deleteTemplate}
              onRefresh={loadTemplates}
              onEdit={(id: string) => {
                setEditingTemplateId(id);
                setShowTemplateEditor(true);
              }}
              onNew={() => {
                setEditingTemplateId(undefined);
                setShowTemplateEditor(true);
              }}
            />
          )}

          {activeTab === 'send' && (
            <SendTab
              contacts={contacts}
              templates={templates}
              onTestEmail={sendTestEmail}
              onSendBulk={sendBulkEmail}
            />
          )}
        </>
      )}
    </div>
  );
}

// Componente de pestaña de Contactos
function ContactsTab({ contacts, onDelete, onRefresh }: any) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ email: '', name: '' });
  const [showImport, setShowImport] = useState(false);
  const [csvData, setCsvData] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { error } = await supabase
      .from('email_contacts')
      .insert([formData]);

    if (error) {
      toast.error('Error agregando contacto');
      return;
    }

    toast.success('Contacto agregado');
    setFormData({ email: '', name: '' });
    setShowForm(false);
    onRefresh();
  };

  const handleImport = async () => {
    const loadingToast = toast.loading('Importando contactos...');
    try {
      const result = await importContactsFromCSV(csvData);
      toast.success(`${result.imported} contactos importados`, { id: loadingToast });
      setShowImport(false);
      setCsvData('');
      onRefresh();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error importando contactos', { id: loadingToast });
    }
  };

  const handleExport = async () => {
    try {
      const csv = await exportContactsToCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contactos_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('Contactos exportados');
    } catch (error) {
      toast.error('Error exportando contactos');
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-lg sm:text-xl font-semibold">Contactos</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowImport(!showImport)}
            className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            Importar
          </button>
          <button
            onClick={handleExport}
            className="px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
          >
            Exportar
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Agregar</span>
            <span className="sm:hidden">+</span>
          </button>
        </div>
      </div>

      {showImport && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Importar desde CSV</h3>
          <p className="text-sm text-gray-600 mb-3">
            El CSV debe tener columnas "email" y opcionalmente "nombre"
          </p>
          <textarea
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg font-mono text-sm mb-3"
            rows={6}
            placeholder="email,nombre&#10;usuario@ejemplo.com,Juan Pérez&#10;otro@ejemplo.com,María García"
          />
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Importar
            </button>
            <button
              onClick={() => setShowImport(false)}
              className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.map((contact: EmailContact) => (
                <tr key={contact.id}>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm break-all">{contact.email}</td>
                  <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm">{contact.name || '-'}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      contact.status === 'active' ? 'bg-green-100 text-green-800' :
                      contact.status === 'unsubscribed' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {contact.status}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(contact.subscribed_at).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => onDelete(contact.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Componente de pestaña de Campañas
function CampaignsTab({ campaigns, onDelete, onEdit, onNew }: any) {
  return (
    <div>
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-lg sm:text-xl font-semibold">Campañas</h2>
        <button
          onClick={onNew}
          className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1 sm:mr-2" />
          Nueva Campaña
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {campaigns.map((campaign: EmailCampaign) => (
          <div key={campaign.id} className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="font-semibold text-base sm:text-lg mb-2 break-words">{campaign.name}</h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-4 break-words">{campaign.subject}</p>
            
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-gray-600">Estado:</span>
                <span className={`font-medium ${
                  campaign.status === 'sent' ? 'text-green-600' :
                  campaign.status === 'sending' ? 'text-blue-600' :
                  campaign.status === 'failed' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {campaign.status}
                </span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-gray-600">Enviados:</span>
                <span className="font-medium">{campaign.sent_count} / {campaign.total_recipients}</span>
              </div>
              {campaign.sent_count > 0 && (
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">Abiertos:</span>
                  <span className="font-medium">
                    {campaign.opened_count} ({Math.round((campaign.opened_count / campaign.sent_count) * 100)}%)
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onEdit(campaign.id)}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs sm:text-sm rounded hover:bg-blue-700"
              >
                Ver Detalles
              </button>
              <button
                onClick={() => onDelete(campaign.id)}
                className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Componente de pestaña de Plantillas
function TemplatesTab({ templates, onDelete, onEdit, onNew }: any) {
  return (
    <div>
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-lg sm:text-xl font-semibold">Plantillas</h2>
        <button
          onClick={onNew}
          className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1 sm:mr-2" />
          Nueva Plantilla
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {templates.map((template: EmailTemplate) => (
          <div key={template.id} className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base sm:text-lg break-words">{template.name}</h3>
                {template.description && (
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">{template.description}</p>
                )}
              </div>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded whitespace-nowrap ml-2">
                {template.template_type}
              </span>
            </div>

            {template.subject && (
              <p className="text-xs sm:text-sm text-gray-700 mb-4 break-words">
                <strong>Asunto:</strong> {template.subject}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => onEdit(template.id)}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs sm:text-sm rounded hover:bg-blue-700"
              >
                <PencilIcon className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                Editar
              </button>
              <button
                onClick={() => onDelete(template.id)}
                className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Componente de pestaña de Envío
function SendTab({ contacts, templates, onTestEmail, onSendBulk }: any) {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [subject, setSubject] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  const handleSend = async () => {
    if (!selectedTemplate || !subject || selectedContacts.length === 0) {
      console.warn('⚠️ Faltan datos para enviar');
      return;
    }

    console.log('🎯 Preparando envío masivo...');
    await onSendBulk(selectedTemplate, subject, selectedContacts);
    
    // Limpiar formulario después del envío
    setSelectedTemplate('');
    setSubject('');
    setSelectedContacts([]);
  };

  return (
    <div>
      <h2 className="text-lg sm:text-xl font-semibold mb-6">Enviar Email</h2>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Plantilla</label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">Seleccionar plantilla...</option>
            {templates.map((t: EmailTemplate) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Asunto</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="Asunto del email..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Destinatarios ({selectedContacts.length} seleccionados)
          </label>
          <div className="border rounded-lg p-3 sm:p-4 max-h-60 overflow-y-auto">
            {contacts.filter((c: EmailContact) => c.status === 'active').map((contact: EmailContact) => (
              <label key={contact.id} className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  checked={selectedContacts.includes(contact.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedContacts([...selectedContacts, contact.id]);
                    } else {
                      setSelectedContacts(selectedContacts.filter((id: string) => id !== contact.id));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-xs sm:text-sm break-all">{contact.email}</span>
                {contact.name && <span className="text-gray-500 text-xs sm:text-sm">({contact.name})</span>}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={onTestEmail}
            className="px-4 sm:px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm sm:text-base"
          >
            Enviar Prueba
          </button>
          <button
            onClick={handleSend}
            disabled={!selectedTemplate || !subject || selectedContacts.length === 0}
            className="px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            <PaperAirplaneIcon className="w-5 h-5 inline mr-2" />
            Enviar a {selectedContacts.length} contactos
          </button>
        </div>
      </div>
    </div>
  );
}
