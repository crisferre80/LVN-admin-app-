import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { XMarkIcon, EyeIcon, PhotoIcon } from '@heroicons/react/24/outline';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface TemplateEditorProps {
  templateId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function TemplateEditor({ templateId, onClose, onSaved }: TemplateEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [templateType, setTemplateType] = useState('custom');
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Configuración de colores
  const [primaryColor, setPrimaryColor] = useState('#1e40af');
  const [secondaryColor, setSecondaryColor] = useState('#3b82f6');
  const [backgroundColor, setBackgroundColor] = useState('#f6f9fc');
  const [textColor, setTextColor] = useState('#374151');
  
  // Logo/Header image
  const [headerImage, setHeaderImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (templateId) {
      loadTemplate();
    } else {
      // Template por defecto
      setHtmlContent(getDefaultTemplate());
    }
  }, [templateId]);

  const loadTemplate = async () => {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      toast.error('Error cargando plantilla');
      return;
    }

    if (data) {
      setName(data.name);
      setDescription(data.description || '');
      setSubject(data.subject || '');
      setHtmlContent(data.html_content);
      setTemplateType(data.template_type || 'custom');
    }
  };

  const getDefaultTemplate = () => {
    return `
      <div style="background-color: ${backgroundColor}; padding: 20px; font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <div style="background-color: ${primaryColor}; padding: 30px; text-align: center;">
            ${headerImage ? `<img src="${headerImage}" alt="Logo" style="max-width: 200px; height: auto;" />` : ''}
            <h1 style="color: white; margin: 10px 0 0 0;">{{subject}}</h1>
          </div>
          
          <!-- Contenido -->
          <div style="padding: 30px;">
            <p style="color: ${textColor}; font-size: 16px; line-height: 1.6;">
              Hola {{name}},
            </p>
            <p style="color: ${textColor}; font-size: 16px; line-height: 1.6;">
              Este es el contenido de tu email. Puedes editarlo como quieras.
            </p>
            
            <!-- Botón CTA -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background-color: ${secondaryColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Ver más
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              © 2025 La Voz del Norte Diario
            </p>
            <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0 0;">
              <a href="#" style="color: ${secondaryColor}; text-decoration: none;">Cancelar suscripción</a>
            </p>
          </div>
        </div>
      </div>
    `;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 2MB');
      return;
    }

    setUploadingImage(true);

    try {
      const fileName = `email-headers/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from('images')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      setHeaderImage(publicUrl);
      toast.success('Imagen subida');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error subiendo imagen');
    } finally {
      setUploadingImage(false);
    }
  };

  const updateTemplateColors = () => {
    let updated = htmlContent;
    updated = updated.replace(/background-color:\s*#[0-9a-fA-F]{6}/g, 
      (match, offset) => {
        if (htmlContent.substring(Math.max(0, offset - 100), offset).includes('Header')) {
          return `background-color: ${primaryColor}`;
        }
        return match;
      });
    setHtmlContent(updated);
  };

  const handleSave = async () => {
    if (!name || !htmlContent) {
      toast.error('Completa nombre y contenido');
      return;
    }

    setLoading(true);

    try {
      const templateData = {
        name,
        description,
        subject,
        html_content: htmlContent,
        template_type: templateType,
      };

      if (templateId) {
        const { error } = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', templateId);

        if (error) throw error;
        toast.success('Plantilla actualizada');
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert([templateData]);

        if (error) throw error;
        toast.success('Plantilla creada');
      }

      onSaved();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error guardando plantilla');
    } finally {
      setLoading(false);
    }
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ],
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl my-4 max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl sm:text-2xl font-bold">
            {templateId ? 'Editar Plantilla' : 'Nueva Plantilla'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Información básica */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Nombre de la Plantilla *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ej: Newsletter Semanal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Tipo de Plantilla
              </label>
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="custom">Personalizada</option>
                <option value="newsletter">Newsletter</option>
                <option value="welcome">Bienvenida</option>
                <option value="notification">Notificación</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Descripción
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Descripción breve de la plantilla"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Asunto (opcional)
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Asunto por defecto del email"
            />
          </div>

          {/* Personalización de diseño */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">🎨 Personalización de Diseño</h3>
            
            {/* Imagen de header */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Logo/Imagen del Header
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="header-image-upload"
                />
                <label
                  htmlFor="header-image-upload"
                  className="flex-1 px-4 py-2 border-2 border-dashed rounded-lg text-center cursor-pointer hover:bg-gray-50"
                >
                  {uploadingImage ? (
                    'Subiendo...'
                  ) : headerImage ? (
                    <img src={headerImage} alt="Header" className="max-h-20 mx-auto" />
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <PhotoIcon className="w-5 h-5" />
                      <span className="text-sm">Click para subir imagen</span>
                    </div>
                  )}
                </label>
                {headerImage && (
                  <button
                    onClick={() => setHeaderImage('')}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>

            {/* Paleta de colores */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Color Primario
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Color Secundario
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Fondo
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Texto
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={updateTemplateColors}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Aplicar Colores a Plantilla
            </button>
          </div>

          {/* Editor HTML */}
          <div className="border-t pt-6">
            <label className="block text-sm font-medium mb-2">
              Contenido HTML del Email
            </label>
            <div className="mb-2 text-xs text-gray-600 space-y-1">
              <p>💡 Variables disponibles:</p>
              <ul className="list-disc list-inside pl-2">
                <li><code className="bg-gray-100 px-1 rounded">{'{{name}}'}</code> - Nombre del suscriptor</li>
                <li><code className="bg-gray-100 px-1 rounded">{'{{email}}'}</code> - Email del suscriptor</li>
                <li><code className="bg-gray-100 px-1 rounded">{'{{subject}}'}</code> - Asunto del email</li>
              </ul>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <ReactQuill
                value={htmlContent}
                onChange={setHtmlContent}
                modules={modules}
                theme="snow"
                className="bg-white"
                style={{ minHeight: '300px' }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <button
            onClick={() => setShowPreview(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 order-2 sm:order-1"
          >
            <EyeIcon className="w-5 h-5 inline mr-2" />
            Vista Previa
          </button>

          <div className="flex flex-col sm:flex-row gap-3 order-1 sm:order-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : templateId ? 'Actualizar' : 'Crear Plantilla'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg sm:text-xl font-bold">Vista Previa</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <div className="mb-4 p-3 sm:p-4 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">
                  <strong>Asunto:</strong> {subject || '(Sin asunto)'}
                </p>
              </div>
              <div
                className="border rounded overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
