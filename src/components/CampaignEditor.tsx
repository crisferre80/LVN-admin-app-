import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createCampaign, sendCampaign } from '../lib/emailCampaigns';
import { render } from '@react-email/render';
import NewsletterEmail from '../emails/NewsletterEmail';
import toast from 'react-hot-toast';
import { XMarkIcon, EyeIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

interface CampaignEditorProps {
  campaignId?: string;
  onClose: () => void;
  onSaved: () => void;
}

interface Article {
  id: string;
  title: string;
  summary: string;
  category: string;
  image_url: string | null;
}

export default function CampaignEditor({ campaignId, onClose, onSaved }: CampaignEditorProps) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [templateType, setTemplateType] = useState<'newsletter' | 'custom'>('newsletter');
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [customHtml, setCustomHtml] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Cargar artículos recientes
    const { data: articlesData } = await supabase
      .from('articles')
      .select('id, title, summary, category, image_url')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20);

    if (articlesData) setArticles(articlesData);

    // Cargar contactos activos
    const { data: contactsData } = await supabase
      .from('email_contacts')
      .select('*')
      .eq('status', 'active')
      .order('email');

    if (contactsData) setContacts(contactsData);

    // Si es edición, cargar datos de campaña
    if (campaignId) {
      const { data: campaign } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaign) {
        setName(campaign.name);
        setSubject(campaign.subject);
        // Cargar más datos según sea necesario
      }
    }
  };

  const generateNewsletterHtml = async () => {
    const selectedArticleData = articles.filter((a) =>
      selectedArticles.includes(a.id)
    );

    return await render(
      <NewsletterEmail
        subscriberName="{{name}}"
        articles={selectedArticleData.map((a) => ({
          title: a.title,
          summary: a.summary || '',
          category: a.category,
          image_url: a.image_url || '',
          url: `https://lavozdelnortediario.com.com.ar/article/${a.id}`,
        }))}
      />
    );
  };

  const handleSave = async () => {
    if (!name || !subject) {
      toast.error('Completa nombre y asunto');
      return;
    }

    setLoading(true);

    try {
      const html_content =
        templateType === 'newsletter'
          ? await generateNewsletterHtml()
          : customHtml;

      await createCampaign({
        name,
        subject,
        html_content,
      });

      toast.success('Campaña guardada como borrador');
      onSaved();
    } catch (error) {
      console.error('Error guardando campaña:', error);
      toast.error('Error guardando campaña');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!name || !subject || selectedContacts.length === 0) {
      toast.error('Completa todos los campos y selecciona destinatarios');
      return;
    }

    if (!confirm(`¿Enviar campaña a ${selectedContacts.length} contactos?`)) {
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Creando y enviando campaña...');

    try {
      // Crear campaña
      const html_content =
        templateType === 'newsletter'
          ? await generateNewsletterHtml()
          : customHtml;

      const campaign = await createCampaign({
        name,
        subject,
        html_content,
      });

      // Enviar campaña
      const result = await sendCampaign({
        campaignId: campaign.id,
        templateHtml: html_content,
        subject,
        contactIds: selectedContacts,
      });

      toast.success(
        `Campaña enviada: ${result.sentCount} exitosos, ${result.failedCount} fallidos`,
        { id: loadingToast }
      );

      onSaved();
    } catch (error) {
      console.error('Error enviando campaña:', error);
      toast.error('Error enviando campaña', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  const getPreviewHtml = async () => {
    if (templateType === 'newsletter') {
      return await generateNewsletterHtml();
    }
    return customHtml;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            {campaignId ? 'Editar Campaña' : 'Nueva Campaña'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Información básica */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Nombre de la Campaña *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ej: Newsletter Semanal - Enero 2024"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Asunto del Email *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ej: 📰 Las noticias más importantes de la semana"
              />
            </div>
          </div>

          {/* Tipo de plantilla */}
          <div>
            <label className="block text-sm font-medium mb-2">Tipo de Plantilla</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="newsletter"
                  checked={templateType === 'newsletter'}
                  onChange={(e) => setTemplateType(e.target.value as any)}
                  className="mr-2"
                />
                Newsletter con Artículos
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="custom"
                  checked={templateType === 'custom'}
                  onChange={(e) => setTemplateType(e.target.value as any)}
                  className="mr-2"
                />
                HTML Personalizado
              </label>
            </div>
          </div>

          {/* Contenido según tipo */}
          {templateType === 'newsletter' ? (
            <div>
              <label className="block text-sm font-medium mb-2">
                Seleccionar Artículos (máximo 5)
              </label>
              <div className="border rounded-lg p-4 max-h-80 overflow-y-auto space-y-2">
                {articles.map((article) => (
                  <label
                    key={article.id}
                    className={`flex items-start gap-3 p-3 rounded hover:bg-gray-50 cursor-pointer ${
                      selectedArticles.includes(article.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedArticles.includes(article.id)}
                      onChange={(e) => {
                        if (e.target.checked && selectedArticles.length >= 5) {
                          toast.error('Máximo 5 artículos');
                          return;
                        }
                        if (e.target.checked) {
                          setSelectedArticles([...selectedArticles, article.id]);
                        } else {
                          setSelectedArticles(
                            selectedArticles.filter((id) => id !== article.id)
                          );
                        }
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{article.title}</div>
                      <div className="text-sm text-gray-600">
                        {article.category} • {article.summary?.substring(0, 100)}...
                      </div>
                    </div>
                    {article.image_url && (
                      <img
                        src={article.image_url}
                        alt=""
                        className="w-20 h-14 object-cover rounded"
                      />
                    )}
                  </label>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {selectedArticles.length} / 5 artículos seleccionados
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">HTML del Email</label>
              <textarea
                value={customHtml}
                onChange={(e) => setCustomHtml(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                rows={12}
                placeholder="Ingresa tu código HTML aquí..."
              />
              <p className="text-sm text-gray-600 mt-1">
                Puedes usar la variable <code className="bg-gray-100 px-1">{'{{name}}'}</code> para
                personalizar con el nombre del suscriptor
              </p>
            </div>
          )}

          {/* Selección de destinatarios */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Destinatarios ({selectedContacts.length} seleccionados)
            </label>
            <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
              <div className="mb-2">
                <button
                  onClick={() => {
                    if (selectedContacts.length === contacts.length) {
                      setSelectedContacts([]);
                    } else {
                      setSelectedContacts(contacts.map((c) => c.id));
                    }
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {selectedContacts.length === contacts.length
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos'}
                </button>
              </div>
              {contacts.map((contact) => (
                <label key={contact.id} className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    checked={selectedContacts.includes(contact.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedContacts([...selectedContacts, contact.id]);
                      } else {
                        setSelectedContacts(
                          selectedContacts.filter((id) => id !== contact.id)
                        );
                      }
                    }}
                    className="rounded"
                  />
                  <span>{contact.email}</span>
                  {contact.name && (
                    <span className="text-gray-500 text-sm">({contact.name})</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-between items-center">
          <button
            onClick={async () => {
              const html = await getPreviewHtml();
              setPreviewHtml(html);
              setShowPreview(true);
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <EyeIcon className="w-5 h-5 inline mr-2" />
            Vista Previa
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Guardar Borrador
            </button>
            <button
              onClick={handleSend}
              disabled={loading || selectedContacts.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <PaperAirplaneIcon className="w-5 h-5 inline mr-2" />
              Enviar Ahora
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold">Vista Previa</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">
                  <strong>Asunto:</strong> {subject || '(Sin asunto)'}
                </p>
              </div>
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[600px] border rounded"
                title="Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
