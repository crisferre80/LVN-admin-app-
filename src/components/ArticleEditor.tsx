import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Image as ImageIcon,
  Loader,
  Wand2,
  CheckCircle2,
  Camera,
  FolderOpen,
  Brain,
  Music,
  Wifi,
  WifiOff,
  Clock,
  BookMarked,
  Trash2,
  Globe,
  Undo2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GalleryManager, GalleryTemplate } from './GalleryManager';
import AudioTranscriber from './AudioTranscriber';
import { AudioPlayer } from './AudioPlayer';
import { AudioSelector } from './AudioSelector';
import { JOURNALISTIC_PROMPTS, JournalisticStyle } from '../types/articlePrompts';
import { generateArticleImage } from '../lib/googleAI';
import { useAIModelConfig } from '../hooks/useAIModelConfig';
import { markdownToHtml } from '../lib/markdownUtils';
import { rewriteWithOpenRouter, generateContentWithOpenRouter, generateWithOpenRouter } from '../lib/openRouter';
import { rewriteWithOpenAI, generateWithOpenAIEdge } from '../lib/openai';
import { rewriteWithPuter, generateContentWithPuter, generateWithPuter } from '../lib/puter';
import { searchWebForTopic } from '../lib/webResearch';
import compress from 'browser-image-compression';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/AuthContext';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface ArticleEditorState {
  title: string;
  description: string;
  content: string;
  category: string;
  image_url: string;
  audio_url?: string;
  author: string;
  url: string;
  rss_source_id: string | null;
  gallery_urls: string[];
  gallery_template: GalleryTemplate;
  status: 'draft' | 'published';
}

interface GalleryImage {
  url: string;
  caption?: string;
  alt?: string;
}

const CATEGORIES = [
  'Nacionales',
  'Regionales',
  'Internacionales',
  'Economía',
  'Deportes',
  'Espectáculos',
  'Política',
  'Sociedad',
  'Medio Ambiente',
  'Tecnología',
  'Salud',
  'Educación',
  'Cultura',
  'Opinión',
  'Ciencia',
  'Turismo',
  'Justicia',
  'Seguridad'
];

interface ArticleEditorProps {
  onExit?: () => void;
  initialEditId?: string;
  initialNew?: boolean;
  initialRewrite?: boolean;
}

export function ArticleEditor({ onExit, initialEditId, initialNew, initialRewrite }: ArticleEditorProps = {}) {
  const navigate = useNavigate();
  const { id: urlId } = useParams<{ id?: string }>();
  const { config: aiConfig } = useAIModelConfig();
  const { user, session } = useAuth();

  // Debug: verificar estado de autenticación
  useEffect(() => {
    console.log('[ArticleEditor] Estado de autenticación:', {
      hasUser: !!user,
      hasSession: !!session,
      userId: user?.id,
      sessionUserId: session?.user?.id
    });
  }, [user, session]);

  // Función para salir del editor
  const exitEditor = () => {
    if (onExit) {
      onExit();
    } else {
      navigate('/admin');
    }
  };

  // Detectar parámetros de la URL o usar props iniciales
  const searchParams = new URLSearchParams(window.location.search);
  const editId = initialEditId || searchParams.get('edit');
  const isNew = initialNew || searchParams.get('new') === 'true';
  const isRewriteMode = initialRewrite || searchParams.get('rewrite') === 'true';

  // Determinar el ID del artículo (de URL params o search params)
  const articleId = urlId || editId;
  const isEditing = Boolean(articleId) && !isNew;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [originalTable, setOriginalTable] = useState<'articles' | 'ai_generated_articles' | 'local_news' | null>(null);

  // Image upload states
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const [formData, setFormData] = useState<ArticleEditorState>({
    title: '',
    description: '',
    content: '<p><br></p>',
    category: 'Nacionales',
    image_url: '',
    audio_url: '',
    author: '',
    url: '',
    rss_source_id: null,
    gallery_urls: [],
    gallery_template: 'list',
    status: 'draft'
  });

  // Estado local para descripción con debounce
  const [localDescription, setLocalDescription] = useState('');
  const descriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // AI Generation states
  const [selectedStyle, setSelectedStyle] = useState<JournalisticStyle>('noticia-objetiva');
  const [selectedProvider, setSelectedProvider] = useState<string>(aiConfig.fallbackOrder[0] || 'google');
  const [customTopic, setCustomTopic] = useState('');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [showAudioTranscriber, setShowAudioTranscriber] = useState(false);
  
  // Custom prompt and templates states
  const [customPrompt, setCustomPrompt] = useState('');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<Array<{id: string, name: string, prompt: string}>>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [useWebResearch, setUseWebResearch] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  // Web Research Test states
  const [showWebResearchTest, setShowWebResearchTest] = useState(false);
  const [testSearchTopic, setTestSearchTopic] = useState('');
  const [testSearchResults, setTestSearchResults] = useState<string>('');
  const [testingWebResearch, setTestingWebResearch] = useState(false);

  // Image generation states
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [showAdvancedImageGen, setShowAdvancedImageGen] = useState(false);
  const [advancedImagePrompt, setAdvancedImagePrompt] = useState('');
  const [useUploadedImage, setUseUploadedImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Title and description generation states
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [isManualGeneration, setIsManualGeneration] = useState(false); // Bandera para rastrear generación manual

  // Undo functionality states
  const [previousFormData, setPreviousFormData] = useState<ArticleEditorState | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  // Media selector states
  const [showAudioSelector, setShowAudioSelector] = useState(false);

  const [sources, setSources] = useState<{id: string, name: string}[]>([]);
  const editorRef = useRef<any>(null);
  const galleryImages: GalleryImage[] = formData.gallery_urls.map(url => ({ url }));

  // Ref para controlar el intervalo de verificación de conexión
  const connectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionCheckInProgressRef = useRef(false);

  // Estados para auto-guardado y conexión
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [autoSaveSettings, setAutoSaveSettings] = useState({
    enabled: true,
    interval: 2, // minutos
    saveOnNavigation: true,
    saveOnTyping: false,
    typingDelay: 30, // segundos
  });
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isOperationInProgress, setIsOperationInProgress] = useState(false); // Nueva bandera para operaciones críticas

  // Manejador de cambio de descripción con debounce
  const handleDescriptionChange = useCallback((value: string) => {
    setLocalDescription(value);
    
    // Limpiar timeout anterior
    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
    }
    
    // Actualizar formData después de 300ms de inactividad
    descriptionTimeoutRef.current = setTimeout(() => {
      setFormData(prev => ({ ...prev, description: value }));
    }, 300);

    // Marcar como cambios no guardados
    setHasUnsavedChanges(true);
  }, []);

  // Manejador de pegado en descripción
  const handleDescriptionPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    
    // Obtener texto plano del portapapeles
    const text = e.clipboardData.getData('text/plain');
    
    // Sanitizar: remover caracteres de control y limitar longitud
    const sanitized = text
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remover caracteres de control
      .substring(0, 500); // Limitar a 500 caracteres
    
    // Insertar en la posición actual del cursor
    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const currentValue = target.value;
    
    const newValue = currentValue.substring(0, start) + sanitized + currentValue.substring(end);
    
    handleDescriptionChange(newValue);
    
    // Actualizar posición del cursor
    setTimeout(() => {
      target.selectionStart = target.selectionEnd = start + sanitized.length;
    }, 0);
  }, [handleDescriptionChange]);

  const handleGalleryChange = (newImages: GalleryImage[]) => {
    setFormData(prev => ({
      ...prev,
      gallery_urls: newImages.map(img => img.url)
    }));
  };

  const handleGalleryTemplateChange = (template: GalleryTemplate) => {
    setFormData(prev => ({ ...prev, gallery_template: template }));
  };

  /**
   * Función helper para hacer llamadas a Google Gemini con fallback automático
   * entre modelos cuando uno alcanza su límite de cuota.
   * NO hace reintentos en el mismo modelo si está sin cuota (error 429).
   */
  const generateContentWithGeminiRetry = async (
    prompt: string,
    preferredModel: string = 'gemini-1.5-flash-latest'
  ): Promise<string> => {
    console.log('🔄 [API CALL] Llamando a Gemini API - Generación manual:', isManualGeneration);

    // Modelos alternativos en orden de preferencia (modelos reales disponibles en v1beta)
    const modelFallbacks = [
      preferredModel,
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-pro'
    ].filter((v, i, a) => a.indexOf(v) === i); // Eliminar duplicados

    let lastError: any = null;

    // Intentar con cada modelo UNA SOLA VEZ
    for (const modelName of modelFallbacks) {
      try {
        console.log(`🤖 Intentando con modelo: ${modelName}`);

        const response = await fetch('/.netlify/functions/google-ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'generateContent',
            data: { prompt, modelName },
            identifier: 'content-gen-' + Date.now()
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.content) {
          console.log(`✅ Éxito con modelo: ${modelName} (1 petición)`);
          return result.content;
        } else if (result.isQuotaError) {
          console.warn(`❌ ${modelName}: Sin cuota disponible, probando siguiente modelo...`);
          continue; // Pasar inmediatamente al siguiente modelo
        } else {
          // Si es otro tipo de error, lanzar inmediatamente
          console.error(`❌ ${modelName}: Error no relacionado con cuota:`, result.error);
          throw new Error(result.error || 'Error desconocido');
        }

      } catch (error: any) {
        lastError = error;
        console.error(`❌ Error de red con ${modelName}:`, error.message);
        // Si es error de red, probar siguiente modelo
        continue;
      }
    }

    // Todos los modelos fallaron
    throw lastError || new Error('Todos los modelos de Gemini están sin cuota o fallaron');
  };

  useEffect(() => {
    const fetchSources = async () => {
      const { data } = await supabase.from('rss_sources').select('id, name');
      setSources(data || []);
    };
    fetchSources();
  }, []);

  // Sincronizar descripción local con formData
  useEffect(() => {
    setLocalDescription(formData.description);
  }, [formData.description]);

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      // Limpiar timeout de descripción
      if (descriptionTimeoutRef.current) {
        clearTimeout(descriptionTimeoutRef.current);
      }
      // Limpiar referencia del editor
      if (editorRef.current) {
        editorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isEditing && articleId) {
      loadArticle(articleId);
    }
  }, [articleId, isEditing]);

  // Inicializar configuraciones de auto-guardado y conexión
  useEffect(() => {
    loadAutoSaveSettings();
    checkConnectionPeriodically(); // Verificación inicial

    // Limpiar intervalo anterior si existe
    if (connectionIntervalRef.current) {
      clearInterval(connectionIntervalRef.current);
    }

    // Configurar verificación periódica de conexión
    connectionIntervalRef.current = setInterval(checkConnectionPeriodically, 30000); // Cada 30 segundos

    // Configurar auto-guardado periódico
    const autoSaveInterval = setInterval(() => {
      if (autoSaveSettings.enabled) {
        autoSaveArticle();
      }
    }, autoSaveSettings.interval * 60 * 1000); // Convertir minutos a milisegundos

    return () => {
      if (connectionIntervalRef.current) {
        clearInterval(connectionIntervalRef.current);
        connectionIntervalRef.current = null;
      }
      clearInterval(autoSaveInterval);
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      if (typingTimer) clearTimeout(typingTimer);
      connectionCheckInProgressRef.current = false;
    };
  }, [autoSaveSettings.interval, autoSaveSettings.enabled]);

  // Auto-guardado al navegar
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (autoSaveSettings.saveOnNavigation && hasUnsavedChanges) {
        // Guardar antes de navegar
        autoSaveArticle(true);
        // Mostrar mensaje de confirmación
        e.preventDefault();
        e.returnValue = '¿Estás seguro de que quieres salir? Los cambios sin guardar se perderán.';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [autoSaveSettings.saveOnNavigation, hasUnsavedChanges]);

  const loadArticle = async (articleId: string) => {
    try {
      setLoading(true);

      // Try AI articles first (since this is the AI article editor)
      let { data, error } = await supabase
        .from('ai_generated_articles')
        .select('*')
        .eq('id', articleId)
        .maybeSingle();

      let sourceTable: 'articles' | 'ai_generated_articles' | 'local_news' = 'ai_generated_articles';

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }

      // If not found in AI articles, try local_news
      if (!data) {
        const result = await supabase
          .from('local_news')
          .select('*')
          .eq('id', articleId)
          .maybeSingle();
        
        data = result.data;
        error = result.error;
        sourceTable = 'local_news';
      }

      // If not found in local_news, try regular articles
      if (!data) {
        const result = await supabase
          .from('articles')
          .select('*')
          .eq('id', articleId)
          .maybeSingle();
        
        data = result.data;
        error = result.error;
        sourceTable = 'articles';
      } else if (sourceTable === 'ai_generated_articles') {
        // Si encontramos el artículo en ai_generated_articles, verificar si también existe en articles
        // Esto puede pasar si una migración anterior falló al eliminar de articles
        const { data: duplicateInArticles } = await supabase
          .from('articles')
          .select('id')
          .eq('id', articleId)
          .maybeSingle();
        
        if (duplicateInArticles) {
          console.warn('⚠️ Artículo encontrado en ambas tablas. Limpiando duplicado de articles...');
          // Limpiar silenciosamente el duplicado
          await supabase
            .from('articles')
            .delete()
            .eq('id', articleId);
          console.log('✅ Duplicado eliminado de articles');
        }
      }

      if (error) throw error;
      if (!data) throw new Error('Artículo no encontrado');

      // Guardar la tabla de origen para saber si necesitamos migrar
      setOriginalTable(sourceTable);

      setFormData({
        title: data.title || '',
        description: data.summary || data.description || '',
        content: data.content || '<p><br></p>',
        category: data.category || 'Nacionales',
        image_url: data.image_url || '',
        audio_url: data.audio_url || '',
        author: data.author || '',
        url: data.url || '',
        rss_source_id: data.source_rss_id || data.rss_source_id || null,
        gallery_urls: data.gallery_urls || [],
        gallery_template: data.gallery_template || 'list',
        status: data.status || (data.published_at ? 'published' : 'draft')
      });
    } catch (error) {
      console.error('Error loading article:', error);
      toast.error('Error al cargar el artículo');
      exitEditor();
    } finally {
      setLoading(false);
    }
  };

  const rewriteContentWithAI = async () => {
    if (!formData.content.trim()) {
      toast.error('No hay contenido para reescribir');
      return;
    }

    // Marcar como generación manual solicitada por el usuario
    setIsManualGeneration(true);
    console.log('🤖 [MANUAL] Usuario solicitó reescritura de contenido con IA');
    setGenerating(true);

    try {
      // INVESTIGACIÓN WEB: Obtener información actualizada del tema usando la imagen como fuente
      let researchData = '';
      const searchTopic = formData.title.trim() || 'tema general';
      toast('🔍 Investigando fuentes originales para reescritura...', { icon: '🔍' });
      
      try {
        researchData = await searchWebForTopic(searchTopic, formData.description, formData.image_url);
        if (researchData) {
          console.log('✅ Información de investigación obtenida para reescritura:', researchData.length, 'caracteres');
          toast.success('Información verificada obtenida de fuentes confiables');
        } else {
          console.warn('⚠️ No se obtuvo información de investigación para reescritura');
          toast('No se encontró información específica, reescribiendo con conocimientos generales', { icon: '⚠️' });
        }
      } catch (error) {
        console.error('Error en investigación web para reescritura:', error);
        toast('Error en investigación web, continuando con conocimientos generales', { icon: '⚠️' });
      }

      let rewrittenContent = '';
      let provider = '';
      const openrouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
      
      // Crear prompt para reescritura con información de investigación
      let rewritePrompt = `Reescribe el siguiente artículo mejorando su calidad, claridad y estilo periodístico. Mantén el mismo tema y enfoque principal.

Título: ${formData.title}
Categoría: ${formData.category}

Contenido original:
${formData.content.replace(/<[^>]*>/g, '')}

Reescribe el artículo de forma profesional y atractiva.`;

      // Agregar información de investigación si está disponible
      if (researchData) {
        rewritePrompt += `\n\n${researchData}\n\nIMPORTANTE: Usa la información verificada de arriba como base para la reescritura, especialmente si proviene de la fuente original del artículo.`;
      }
      
      // Usar el orden de fallback configurado
      for (const providerName of aiConfig.fallbackOrder) {
        if (rewrittenContent) break; // Si ya tenemos contenido, salir

        switch (providerName) {
          case 'google':
            try {
              rewrittenContent = await generateContentWithGeminiRetry(rewritePrompt);
              provider = 'Google AI';
            } catch (error: any) {
              console.warn('Google AI failed for rewrite:', error?.message);
              if (error?.message?.includes('quota') || error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
                console.warn('⚠️ Cuota de Google AI excedida para reescritura');
              }
            }
            break;

          case 'openrouter':
            if (openrouterApiKey) {
              try {
                const result = await rewriteWithOpenRouter(
                  formData.content.replace(/<[^>]*>/g, ''),
                  formData.title,
                  formData.category
                );
                if (result) {
                  rewrittenContent = result;
                  provider = 'OpenRouter';
                }
              } catch (error) {
                console.warn('OpenRouter failed for rewrite:', error);
              }
            }
            break;

          case 'openai':
            if (import.meta.env.VITE_OPENAI_API_KEY) {
              try {
                const result = await rewriteWithOpenAI(
                  formData.content.replace(/<[^>]*>/g, ''),
                  formData.title,
                  formData.category
                );
                if (result) {
                  rewrittenContent = result;
                  provider = 'OpenAI';
                }
              } catch (error) {
                console.warn('OpenAI failed for rewrite:', error);
              }
            }
            break;

          case 'puter':
            if (import.meta.env.VITE_PUTER_API_KEY) {
              try {
                const result = await rewriteWithPuter(
                  formData.content.replace(/<[^>]*>/g, ''),
                  formData.title,
                  formData.category,
                  selectedStyle
                );
                if (result) {
                  rewrittenContent = result;
                  provider = 'Puter AI';
                }
              } catch (error) {
                console.warn('Puter AI failed for rewrite:', error);
              }
            }
            break;
        }
      }

      if (!rewrittenContent) {
        toast.error('No se pudo reescribir el contenido. Verifica tus API keys.');
        return;
      }

      // Extraer título del contenido generado (línea que comienza con **)
      let extractedTitle = formData.title;
      let cleanedContent = rewrittenContent;

      const titleMatch = rewrittenContent.match(/^\*\*(.+?)\*\*/m);
      if (titleMatch && titleMatch[1].trim().length > 5) {
        extractedTitle = titleMatch[1].trim();
        // Remover la línea del título del contenido
        cleanedContent = rewrittenContent.replace(/^\*\*(.+?)\*\*\s*/, '');
      }

      // Convertir el contenido limpio (sin título) a HTML
      const htmlContent = markdownToHtml(cleanedContent);

      // Guardar estado anterior para undo
      setPreviousFormData(formData);
      setCanUndo(true);

      setFormData(prev => ({
        ...prev,
        title: extractedTitle,
        content: htmlContent
      }));

      toast.success(`¡Contenido reescrito con ${provider}!`);
    } catch (error) {
      console.error('Error rewriting content:', error);
      toast.error('Error al reescribir el contenido');
    } finally {
      setGenerating(false);
      setIsManualGeneration(false);
      console.log('✅ [MANUAL] Reescritura de contenido completada');
    }
  };

  // Cargar plantillas guardadas al montar el componente
  useEffect(() => {
    const templates = localStorage.getItem('promptTemplates');
    if (templates) {
      try {
        setSavedTemplates(JSON.parse(templates));
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    }
  }, []);

  // Función para guardar plantilla
  const saveTemplate = () => {
    if (!templateName.trim() || !customPrompt.trim()) {
      toast.error('Ingresa un nombre y un prompt para guardar la plantilla');
      return;
    }
    
    const newTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      prompt: customPrompt.trim()
    };
    
    const updatedTemplates = [...savedTemplates, newTemplate];
    setSavedTemplates(updatedTemplates);
    localStorage.setItem('promptTemplates', JSON.stringify(updatedTemplates));
    setTemplateName('');
    setShowSaveTemplate(false);
    toast.success(`Plantilla "${newTemplate.name}" guardada exitosamente`);
  };

  // Función para cargar plantilla
  const loadTemplate = (template: {id: string, name: string, prompt: string}) => {
    setCustomPrompt(template.prompt);
    setUseCustomPrompt(true);
    toast(`Plantilla "${template.name}" cargada`, { icon: '📋' });
  };

  // Función para eliminar plantilla
  const deleteTemplate = (id: string) => {
    const templateToDelete = savedTemplates.find(t => t.id === id);
    const updatedTemplates = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updatedTemplates);
    localStorage.setItem('promptTemplates', JSON.stringify(updatedTemplates));
    if (templateToDelete) {
      toast.success(`Plantilla "${templateToDelete.name}" eliminada`);
    }
  };

  const testWebResearch = async () => {
    if (!testSearchTopic.trim()) {
      toast.error('Ingresa un tema para buscar');
      return;
    }

    setTestingWebResearch(true);
    setTestSearchResults('');

    try {
      console.log('🧪 Probando investigación web para:', testSearchTopic);
      const results = await searchWebForTopic(testSearchTopic);
      
      if (results) {
        setTestSearchResults(results);
        console.log('✅ Resultados de prueba obtenidos:', results.length, 'caracteres');
        toast.success('Búsqueda completada exitosamente');
      } else {
        setTestSearchResults('No se encontraron resultados de investigación web.');
        console.warn('⚠️ No se encontraron resultados en la prueba');
        toast('No se encontraron resultados', { icon: '⚠️' });
      }
    } catch (error) {
      console.error('❌ Error en prueba de investigación web:', error);
      setTestSearchResults(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      toast.error('Error al probar la búsqueda web');
    } finally {
      setTestingWebResearch(false);
    }
  };

  const generateContentWithAI = async () => {
    // Validaciones: necesitamos tema o prompt personalizado o contenido existente
    if (!customTopic.trim() && !customPrompt.trim() && !formData.content?.trim()) {
      toast.error('Ingresa un tema, un prompt personalizado o asegúrate de que haya contenido existente');
      return;
    }

    // Marcar como generación manual solicitada por el usuario
    setIsManualGeneration(true);
    console.log('🤖 [MANUAL] Usuario solicitó generación de contenido completo con IA');
    console.log('📋 Parámetros:', { 
      useCustomPrompt, 
      useWebResearch, 
      customTopic: customTopic.trim(),
      selectedProvider,
      selectedStyle 
    });
    setGenerating(true);

    try {
      let researchData = '';
      
      // SIEMPRE investigar en la web para obtener información factual (como ChatGPT)
      const searchTopic = customTopic.trim() || formData.title || 'tema general';
      toast('🔍 Investigando en la web para obtener información factual...', { icon: '🔍' });
      try {
        researchData = await searchWebForTopic(searchTopic);
        if (researchData) {
          console.log('✅ Información de investigación obtenida:', researchData.length, 'caracteres');
          toast.success('Información verificada obtenida de fuentes confiables');
        } else {
          console.warn('⚠️ No se obtuvo información de investigación web');
          toast('No se encontró información específica, generando con conocimientos generales', { icon: '⚠️' });
        }
      } catch (error) {
        console.error('Error en investigación web:', error);
        toast('Error en investigación web, continuando con conocimientos generales', { icon: '⚠️' });
      }

      const selectedPrompt = JOURNALISTIC_PROMPTS[selectedStyle];
      if (!selectedPrompt) {
        toast.error('Estilo periodístico no encontrado');
        return;
      }

      let generatedContent = '';
      let provider = '';

      // Determinar el tema base
      const baseTopic = customTopic.trim() || formData.title || 'Artículo sin título';

      // Crear prompt: si hay custom prompt, usarlo; sino usar el estándar
      let generationPrompt: string;
      let systemPromptForAI = '';
      
      if (useCustomPrompt && customPrompt.trim()) {
        // Usar prompt personalizado - más limpio y directo
        systemPromptForAI = 'Eres un periodista profesional experto. Genera contenido de alta calidad basado ÚNICAMENTE en hechos verificables. NO inventes información, nombres o eventos que no estén en los datos proporcionados.';
        
        generationPrompt = `INSTRUCCIONES DEL USUARIO:\n${customPrompt.trim()}\n\n`;
        generationPrompt += `TEMA PRINCIPAL: ${baseTopic}\n`;
        generationPrompt += `CATEGORÍA: ${formData.category}\n\n`;
        
        if (researchData) {
          generationPrompt += `INFORMACIÓN VERIFICABLE DE FUENTES CONFIABLES (USA ÚNICAMENTE ESTA INFORMACIÓN):\n${researchData}\n\n`;
          generationPrompt += `REGLAS CRÍTICAS: NO inventes nombres, personas, fechas, eventos o datos que no estén explícitamente en la información proporcionada. Si necesitas datos específicos que no están disponibles, indica claramente que no hay información suficiente sobre ese aspecto.\n\n`;
        }
        
        generationPrompt += `IMPORTANTE: Si no hay información de referencia verificada, genera contenido genérico basado en conocimientos generales, pero evita cualquier detalle específico inventado.\n\n`;
        generationPrompt += `Genera el artículo ahora:`;
        
      } else {
        // Usar prompt estándar con el estilo seleccionado - simplificado
        systemPromptForAI = selectedPrompt.systemPrompt + ' CRÍTICO: Usa ÚNICAMENTE información verificable del contexto proporcionado. NO inventes nombres, personas, eventos, fechas o datos específicos. Si no hay información suficiente, genera contenido genérico pero factual.';
        
        generationPrompt = `TEMA DEL ARTÍCULO: ${baseTopic}\n`;
        generationPrompt += `CATEGORÍA: ${formData.category}\n`;
        generationPrompt += `ESTILO REQUERIDO: ${selectedPrompt.name}\n\n`;
        
        if (researchData) {
          generationPrompt += `INFORMACIÓN VERIFICABLE DE FUENTES CONFIABLES (USA ÚNICAMENTE ESTA INFORMACIÓN):\n${researchData}\n\n`;
          generationPrompt += `REGLAS ESTRICTAS - NO VIOLACIÓN PERMITIDA:\n`;
          generationPrompt += `- NO inventes nombres de personas, lugares específicos, fechas o eventos\n`;
          generationPrompt += `- NO agregues información que no esté explícitamente en las fuentes\n`;
          generationPrompt += `- Si necesitas datos específicos que no están disponibles, usa ejemplos genéricos o indica "sin información específica disponible"\n`;
          generationPrompt += `- Mantén toda la información basada en hechos verificables de las fuentes proporcionadas\n\n`;
        } else {
          generationPrompt += `NOTA: No hay información específica verificada disponible. Genera contenido basado en conocimientos generales del tema, pero evita cualquier detalle específico inventado.\n\n`;
        }
        
        // Solo incluir contenido existente si realmente existe y es significativo
        if (formData.content && formData.content.replace(/<[^>]*>/g, '').trim().length > 100) {
          generationPrompt += `NOTA: Hay contenido previo que puedes usar como base si es relevante, pero concéntrate en desarrollar el tema "${baseTopic}" de forma completa.\n\n`;
        }
        
        // Instrucciones claras y concisas
        generationPrompt += `INSTRUCCIONES:\n`;
        generationPrompt += `- Escribe un artículo periodístico completo sobre "${baseTopic}"\n`;
        generationPrompt += `- Longitud: ${selectedPrompt.minWords}-${selectedPrompt.maxWords} palabras\n`;
        generationPrompt += `- Estilo: ${selectedPrompt.description}\n`;
        generationPrompt += `- ${researchData ? 'Incorpora ÚNICAMENTE datos verificados de las fuentes proporcionadas, sin invenciones ni especulaciones' : 'Desarrolla el tema con información general verificable, sin detalles específicos inventados'}\n`;
        generationPrompt += `- Si no tienes información específica sobre un aspecto, dilo explícitamente\n`;
        generationPrompt += `- Mantén el foco en el tema principal en todo momento\n`;
        generationPrompt += `- Usa un formato estructurado con párrafos bien organizados\n\n`;
        generationPrompt += `Genera el artículo ahora:`;
      }

      // Log del prompt para debugging
      console.log('📝 Prompt generado:', {
        systemPrompt: systemPromptForAI.substring(0, 100) + '...',
        promptLength: generationPrompt.length,
        hasResearch: !!researchData,
        researchLength: researchData.length
      });
      console.log('📄 Prompt completo:\n', generationPrompt);

      // Usar el proveedor seleccionado por el usuario
      switch (selectedProvider) {
        case 'google':
          try {
            generatedContent = await generateContentWithGeminiRetry(generationPrompt);
            provider = 'Google AI';
          } catch (error: any) {
            console.warn('Google AI failed for content generation:', error?.message);
            if (error?.message?.includes('quota') || error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
              console.warn('⚠️ Cuota de Google AI excedida para generación de contenido');
              toast.error('⚠️ Cuota de Google AI excedida. Selecciona otro proveedor o espera a que se restablezca.');
            } else {
              toast.error(`Error con Google AI: ${error?.message || 'Error desconocido'}`);
            }
          }
          break;

        case 'openrouter':
          try {
            const result = await generateContentWithOpenRouter(
              baseTopic,
              selectedPrompt
            );
            if (result) {
              generatedContent = result;
              provider = 'OpenRouter';
            }
          } catch (error: any) {
            console.warn('OpenRouter failed for content generation:', error);
            toast.error(`Error con OpenRouter: ${error?.message || 'Error desconocido'}`);
          }
          break;

        case 'openai':
          try {
            const result = await generateWithOpenAIEdge(generationPrompt, {
              model: 'gpt-4o', // Modelo más avanzado para mejor fiabilidad y consistencia
              systemPrompt: systemPromptForAI,
              temperature: 0, // Temperatura reducida para resultados más deterministas y precisos
              maxTokens: Math.min(selectedPrompt.maxWords * 5, 16000) // Más tokens para respuestas completas
            });
            if (result) {
              generatedContent = result;
              provider = 'OpenAI (Edge Function)';
            }
          } catch (error: any) {
            console.warn('OpenAI Edge Function failed for content generation:', error);
            toast.error(`Error con OpenAI: ${error?.message || 'Error desconocido'}`);
          }
          break;

        case 'puter':
          if (import.meta.env.VITE_PUTER_API_KEY) {
            try {
              const result = await generateContentWithPuter(
                baseTopic,
                formData.description || '',
                formData.category,
                selectedStyle
              );
              if (result) {
                generatedContent = result;
                provider = 'Puter AI';
              }
            } catch (error: any) {
              console.warn('Puter AI failed for content generation:', error);
              toast.error(`Error con Puter AI: ${error?.message || 'Error desconocido'}`);
            }
          } else {
            toast.error('API key de Puter no configurada. Ve a Configuración > Modelos de IA para configurarla.');
          }
          break;

        default:
          toast.error(`Proveedor ${selectedProvider} no soportado`);
      }

      if (!generatedContent) {
        toast.error(`No se pudo generar el contenido con ${selectedProvider}. Verifica la configuración y cuota del proveedor seleccionado.`);
        return;
      }

      // Convertir el contenido generado a HTML
      // const htmlContent = markdownToHtml(generatedContent);

      // Generar título si no hay uno
      let title = formData.title;
      if (!title.trim()) {
        // Extraer título del contenido generado (línea que comienza con **)
        const titleMatch = generatedContent.match(/^\*\*(.+?)\*\*/m);
        if (titleMatch && titleMatch[1].trim().length > 5) {
          title = titleMatch[1].trim();
        } else {
          // Fallback: usar el título del artículo RSS original o el tema personalizado
          title = formData.title || customTopic.charAt(0).toUpperCase() + customTopic.slice(1);
        }
      }

      // Generar descripción si no hay una
      let description = formData.description;
      if (!description.trim()) {
        // Extraer descripción del contenido generado (línea que comienza con *)
        const descriptionMatch = generatedContent.match(/^\*(.+?)\*/m);
        if (descriptionMatch && descriptionMatch[1].trim().length > 10) {
          description = descriptionMatch[1].trim();
          // Limitar a 300 caracteres
          if (description.length > 300) {
            description = description.substring(0, 297) + '...';
          }
        } else {
          // Fallback: extraer la primera línea significativa
          const firstLine = generatedContent.split('\n').find(line => line.trim() && !line.startsWith('#') && !line.startsWith('*'));
          if (firstLine) {
            description = firstLine.replace(/[*_`]/g, '').trim();
            // Limitar a 300 caracteres
            if (description.length > 300) {
              description = description.substring(0, 297) + '...';
            }
          }
        }
      }

      // Limpiar el contenido generado removiendo título y descripción antes de convertir a HTML
      let cleanedContent = generatedContent;
      if (title && !formData.title.trim()) {
        // Remover la línea del título si fue extraída del contenido
        const titleMatch = cleanedContent.match(/^\*\*(.+?)\*\*\s*/m);
        if (titleMatch) {
          cleanedContent = cleanedContent.replace(/^\*\*(.+?)\*\*\s*/, '');
        }
      }
      if (description && !formData.description.trim()) {
        // Remover la línea de la descripción si fue extraída del contenido
        const descriptionMatch = cleanedContent.match(/^\*(.+?)\*\s*/m);
        if (descriptionMatch) {
          cleanedContent = cleanedContent.replace(/^\*(.+?)\*\s*/, '');
        }
      }

      // Convertir el contenido limpio a HTML
      const finalHtmlContent = markdownToHtml(cleanedContent);

      // Guardar estado anterior para undo
      setPreviousFormData(formData);
      setCanUndo(true);

      setFormData(prev => ({
        ...prev,
        title,
        description,
        content: finalHtmlContent
      }));

      // Cerrar el selector de estilos
      setShowStyleSelector(false);

      toast.success(`¡Artículo generado con ${provider}!`);
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error('Error al generar el contenido');
    } finally {
      setGenerating(false);
      setIsManualGeneration(false);
      console.log('✅ [MANUAL] Generación de contenido completo completada');
    }
  };

  const generateCoverImage = async () => {
    if (!formData.title.trim()) {
      toast.error('Ingresa un título para generar la imagen');
      return;
    }

    setGeneratingImage(true);
    try {
      console.log('Iniciando generación de imagen destacada...');
      const result = await generateArticleImage(
        formData.title,
        formData.description,
        formData.category,
        imagePrompt || undefined
      );

      if (result && result.startsWith('http')) {
        setFormData(prev => ({ ...prev, image_url: result }));
        toast.success('Imagen generada exitosamente');
      } else {
        toast.error('No se pudo generar la imagen. Se intentó con múltiples proveedores (Gemini, Pexels, Banana) pero todos fallaron. Si acabas de generar varias imágenes, espera unos minutos antes de intentar nuevamente.');
      }
    } catch (error: any) {
      console.error('Error generating image:', error);
      const errorMessage = error?.message || 'Error desconocido';

      if (errorMessage.includes('rate limit') || errorMessage.includes('429') || errorMessage.includes('Resource exhausted')) {
        toast.error('Límite de API excedido. La API de Google Gemini tiene límites de uso. Espera unos minutos antes de intentar generar otra imagen. El sistema automáticamente probará con otros proveedores alternativos.');
      } else {
        toast.error(`Error al generar la imagen: ${errorMessage}`);
      }
    } finally {
      setGeneratingImage(false);
    }
  };

  const generateTitleWithAI = async () => {
    if (!formData.content.trim()) {
      toast.error('Ingresa contenido del artículo para generar el título');
      return;
    }

    // Marcar como generación manual solicitada por el usuario
    setIsManualGeneration(true);
    console.log('🤖 [MANUAL] Usuario solicitó generación de título con IA');
    setGeneratingTitle(true);

    try {
      let generatedTitle = '';
      let provider = '';

      // Crear prompt para generar título
      const titlePrompt = `Eres un periodista experimentado de La Voz del Norte Diario, un periódico regional argentino con más de 50 años de trayectoria.

Tu tarea es crear un título impactante y periodístico para el siguiente artículo. El título debe:

- Ser atractivo y llamativo para captar la atención del lector
- Mantener el rigor periodístico y la objetividad
- Reflejar fielmente el contenido del artículo
- Tener entre 8-15 palabras aproximadamente
- Usar mayúsculas SOLO en: la primera palabra, nombres propios, ciudades, provincias, países, instituciones y marcas
- El resto de las palabras deben ir en minúsculas (como en títulos periodísticos profesionales)
- Evitar sensacionalismo excesivo
- Ser apropiado para la categoría: ${formData.category}

CONTENIDO DEL ARTÍCULO:
${formData.content.replace(/<[^>]*>/g, '').substring(0, 2000)}

INSTRUCCIONES ESPECÍFICAS:
- Si ya hay un título existente ("${formData.title}"), úsalo como inspiración pero crea uno nuevo y mejor
- El título debe resumir la esencia del artículo en pocas palabras
- Debe ser SEO-friendly y atractivo para redes sociales
- Mantén el enfoque regional si el contenido lo amerita

Responde ÚNICAMENTE con el título generado, sin comillas ni explicaciones adicionales.`;

      // Usar el orden de fallback configurado
      for (const providerName of aiConfig.fallbackOrder) {
        if (generatedTitle) break; // Si ya tenemos título, salir

        switch (providerName) {
          case 'google':
            try {
              generatedTitle = await generateContentWithGeminiRetry(titlePrompt);
              provider = 'Google AI';
            } catch (error: any) {
              console.warn('Google AI failed for title generation:', error?.message);
              if (error?.message?.includes('quota') || error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
                console.warn('⚠️ Cuota de Google AI excedida para generación de título');
              }
            }
            break;

          case 'openrouter':
            try {
              const result = await generateWithOpenRouter(titlePrompt, {
                systemPrompt: 'Eres un periodista experimentado especializado en crear títulos periodísticos impactantes.',
                maxTokens: 100
              });
              if (result) {
                generatedTitle = result.trim();
                provider = 'OpenRouter';
              }
            } catch (error) {
              console.warn('OpenRouter failed for title generation:', error);
            }
            break;

          case 'puter':
            if (import.meta.env.VITE_PUTER_API_KEY) {
              try {
                const result = await generateWithPuter(titlePrompt, {
                  systemPrompt: 'Eres un periodista experimentado especializado en crear títulos periodísticos impactantes.',
                  maxTokens: 100
                });
                if (result) {
                  generatedTitle = result.trim();
                  provider = 'Puter AI';
                }
              } catch (error) {
                console.warn('Puter AI failed for title generation:', error);
              }
            }
            break;

          case 'openai':
            try {
              const result = await generateWithOpenAIEdge(titlePrompt, {
                model: 'gpt-4o',
                systemPrompt: 'Eres un periodista experimentado especializado en crear títulos periodísticos impactantes, objetivos y basados en hechos verificables.',
                temperature: 0,
                maxTokens: 100
              });
              if (result) {
                generatedTitle = result.trim();
                provider = 'OpenAI (Edge Function)';
              }
            } catch (error) {
              console.warn('OpenAI Edge Function failed for title generation:', error);
            }
            break;
        }
      }

      if (!generatedTitle) {
        toast.error('No se pudo generar el título. Verifica la configuración de API keys.');
        return;
      }

      // Limpiar el título generado (remover comillas si las hay)
      const cleanTitle = generatedTitle.replace(/^["']|["']$/g, '').trim();

      // Guardar estado anterior para undo
      setPreviousFormData(formData);
      setCanUndo(true);

      setFormData(prev => ({
        ...prev,
        title: cleanTitle
      }));

      toast.success(`¡Título generado con ${provider}!`);
    } catch (error) {
      console.error('Error generating title:', error);
      toast.error('Error al generar el título');
    } finally {
      setGeneratingTitle(false);
      setIsManualGeneration(false);
      console.log('✅ [MANUAL] Generación de título completada');
    }
  };

  const generateDescriptionWithAI = async () => {
    if (!formData.content.trim()) {
      toast.error('Ingresa contenido del artículo para generar la descripción');
      return;
    }

    // Marcar como generación manual solicitada por el usuario
    setIsManualGeneration(true);
    console.log('🤖 [MANUAL] Usuario solicitó generación de descripción con IA');
    setGeneratingDescription(true);

    try {
      let generatedDescription = '';
      let provider = '';

      // Crear prompt para generar descripción
      const descriptionPrompt = `Eres un periodista experimentado de La Voz del Norte Diario, un periódico regional argentino con más de 50 años de trayectoria.

Tu tarea es crear una descripción breve y atractiva para el siguiente artículo. La descripción debe:

- Ser un resumen conciso pero completo del contenido principal (entre 200-300 caracteres)
- Captar la atención del lector y motivarlo a leer el artículo completo
- Mantener el tono periodístico profesional
- Incluir los elementos más importantes del artículo con suficiente detalle
- Ser apropiada para la categoría: ${formData.category}
- Evitar terminar con puntos suspensivos a menos que sea absolutamente necesario
- Proporcionar información sustancial, no solo un gancho publicitario

CONTENIDO DEL ARTÍCULO:
${formData.content.replace(/<[^>]*>/g, '').substring(0, 2000)}

INSTRUCCIONES ESPECÍFICAS:
- Si ya hay una descripción existente ("${formData.description}"), úsalo como inspiración pero crea una nueva
- La descripción debe ser impactante pero veraz
- Debe funcionar bien como preview en redes sociales o listados
- Mantén el enfoque regional si el contenido lo amerita
- NO uses comillas en la descripción

Responde ÚNICAMENTE con la descripción generada, sin explicaciones adicionales.`;

      // Usar el orden de fallback configurado
      for (const providerName of aiConfig.fallbackOrder) {
        if (generatedDescription) break; // Si ya tenemos descripción, salir

        switch (providerName) {
          case 'google':
            try {
              generatedDescription = await generateContentWithGeminiRetry(descriptionPrompt);
              provider = 'Google AI';
            } catch (error: any) {
              console.warn('Google AI failed for description generation:', error?.message);
              if (error?.message?.includes('quota') || error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
                console.warn('⚠️ Cuota de Google AI excedida para generación de descripción');
              }
            }
            break;

          case 'openrouter':
            try {
              const result = await generateWithOpenRouter(descriptionPrompt, {
                systemPrompt: 'Eres un periodista experimentado especializado en crear descripciones periodísticas concisas y atractivas.',
                maxTokens: 300
              });
              if (result) {
                generatedDescription = result.trim();
                provider = 'OpenRouter';
              }
            } catch (error) {
              console.warn('OpenRouter failed for description generation:', error);
            }
            break;

          case 'puter':
            if (import.meta.env.VITE_PUTER_API_KEY) {
              try {
                const result = await generateWithPuter(descriptionPrompt, {
                  systemPrompt: 'Eres un periodista experimentado especializado en crear descripciones periodísticas concisas y atractivas.',
                  maxTokens: 300
                });
                if (result) {
                  generatedDescription = result.trim();
                  provider = 'Puter AI';
                }
              } catch (error) {
                console.warn('Puter AI failed for description generation:', error);
              }
            }
            break;

          case 'openai':
            try {
              const result = await generateWithOpenAIEdge(descriptionPrompt, {
                model: 'gpt-4o',
                systemPrompt: 'Eres un periodista experimentado especializado en crear descripciones periodísticas concisas, atractivas y basadas en hechos verificables.',
                temperature: 0,
                maxTokens: 300
              });
              if (result) {
                generatedDescription = result.trim();
                provider = 'OpenAI (Edge Function)';
              }
            } catch (error) {
              console.warn('OpenAI Edge Function failed for description generation:', error);
            }
            break;
        }
      }

      if (!generatedDescription) {
        toast.error('No se pudo generar la descripción. Verifica la configuración de API keys.');
        return;
      }

      // Limpiar la descripción generada (remover comillas si las hay)
      const cleanDescription = generatedDescription.replace(/^["']|["']$/g, '').trim();

      // Limitar a 300 caracteres
      const finalDescription = cleanDescription.length > 300
        ? cleanDescription.substring(0, 297) + '...'
        : cleanDescription;

      // Guardar estado anterior para undo
      setPreviousFormData(formData);
      setCanUndo(true);

      setFormData(prev => ({
        ...prev,
        description: finalDescription
      }));

      // Actualizar también el estado local
      setLocalDescription(finalDescription);

      toast.success(`¡Descripción generada con ${provider}!`);
    } catch (error) {
      console.error('Error generating description:', error);
      toast.error('Error al generar la descripción');
    } finally {
      setGeneratingDescription(false);
      setIsManualGeneration(false);
      console.log('✅ [MANUAL] Generación de descripción completada');
    }
  };

  const undoLastAIChange = () => {
    if (previousFormData && canUndo) {
      setFormData(previousFormData);
      setLocalDescription(previousFormData.description);
      setPreviousFormData(null);
      setCanUndo(false);
      toast.success('Cambios de IA deshechos');
    } else {
      toast.error('No hay cambios para deshacer');
    }
  };

  const generateAdvancedImage = async () => {
    if (!advancedImagePrompt.trim()) {
      toast.error('Ingresa un prompt para generar la imagen');
      return;
    }

    setGeneratingImage(true);
    try {
      let enhancedPrompt = advancedImagePrompt;
      let provider = '';

      // Usar el orden de fallback configurado para mejorar el prompt
      for (const providerName of aiConfig.fallbackOrder) {
        if (enhancedPrompt !== advancedImagePrompt) break; // Si ya tenemos un prompt mejorado, salir

        switch (providerName) {
          case 'google':
            try {
              // Usar gemini-1.5-flash-latest que es compatible

                const promptEnhancement = `Mejora este prompt para generar una imagen profesional de periódico: "${advancedImagePrompt}". 
                Hazlo más detallado, específico y orientado a medios de comunicación. Incluye detalles sobre estilo, composición, colores y elementos visuales.`;

                // Usar la función con reintentos para manejar errores 429
                enhancedPrompt = await generateContentWithGeminiRetry(promptEnhancement);
                provider = 'Google AI';
              } catch (error: any) {
                console.warn('Google AI failed for prompt enhancement:', error?.message);
                // Si es error de cuota/rate limit, mostrar mensaje específico
                if (error?.message?.includes('quota') || error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
                  console.warn('⚠️ Cuota de Google AI excedida o demasiadas peticiones. Usando prompt original...');
                }
              }
            break;

          case 'openrouter':
            try {
              const promptEnhancement = `Mejora este prompt para generar una imagen profesional de periódico: "${advancedImagePrompt}". 
              Hazlo más detallado, específico y orientado a medios de comunicación. Incluye detalles sobre estilo, composición, colores y elementos visuales.`;

                const result = await generateWithOpenRouter(promptEnhancement, {
                  systemPrompt: 'Eres un experto en crear prompts detallados para generación de imágenes profesionales para medios de comunicación.',
                  maxTokens: 300
                });
                if (result) {
                  enhancedPrompt = result;
                  provider = 'OpenRouter';
                }
              } catch (error) {
                console.warn('OpenRouter failed for prompt enhancement:', error);
              }
            break;
        }
      }

      console.log(`Prompt mejorado por ${provider}:`, enhancedPrompt);

      // Usar el servicio de generación de imágenes con el prompt mejorado
      const imageResult = await generateArticleImage(
        formData.title,
        enhancedPrompt,
        formData.category,
        advancedImagePrompt
      );

      if (imageResult && imageResult.startsWith('http')) {
        setFormData(prev => ({ ...prev, image_url: imageResult }));
        toast.success(`Imagen generada exitosamente con ${provider} AI`);
      } else {
        toast.error('No se pudo generar la imagen. Se intentó con múltiples proveedores (Gemini, Pexels, Banana) pero todos fallaron. Si acabas de generar varias imágenes, espera unos minutos antes de intentar nuevamente.');
      }

      setShowAdvancedImageGen(false);
    } catch (error: any) {
      console.error('Error generating advanced image:', error);
      const errorMessage = error?.message || 'Error desconocido';

      if (errorMessage.includes('rate limit') || errorMessage.includes('429') || errorMessage.includes('Resource exhausted')) {
        toast.error('Límite de API excedido. La API de Google Gemini tiene límites de uso. Espera unos minutos antes de intentar generar otra imagen. El sistema automáticamente probará con otros proveedores alternativos.');
      } else {
        toast.error(`Error al generar la imagen avanzada: ${errorMessage}. Se intentó con múltiples proveedores pero todos fallaron.`);
      }
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    // Marcar operación crítica en progreso
    setIsOperationInProgress(true);

    try {
      setUploadingImage(true);
      setUploadProgress('Validando imagen...');

      // Validar tamaño inicial (antes de compresión)
      const maxInitialSize = 50 * 1024 * 1024; // 50MB máximo inicial
      if (file.size > maxInitialSize) {
        toast.error('La imagen es demasiado grande. El tamaño máximo inicial es 50MB.');
        return;
      }

      console.log('📸 Iniciando subida de imagen:', {
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + 'MB',
        type: file.type
      });

      setUploadProgress('Comprimiendo imagen...');

      // Configuración de compresión más agresiva para imágenes pequeñas
      const compressionOptions = {
        maxSizeMB: file.size > 1024 * 1024 ? 2 : 1, // 2MB para imágenes grandes, 1MB para pequeñas
        maxWidthOrHeight: file.size > 5 * 1024 * 1024 ? 1920 : 1280, // Resolución adaptativa
        useWebWorker: true,
        initialQuality: file.size > 1024 * 1024 ? 0.8 : 0.9, // Mejor calidad para imágenes pequeñas
        preserveExif: false, // No necesitamos EXIF para artículos
      };

      console.log('🗜️ Configuración de compresión:', compressionOptions);

      // Timeout más largo para imágenes grandes
      const compressionTimeout = file.size > 10 * 1024 * 1024 ? 120000 : 60000; // 2min para grandes, 1min para pequeñas

      const compressionPromise = compress(file, compressionOptions);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_COMPRESSION')), compressionTimeout)
      );

      const compressedFile = await Promise.race([compressionPromise, timeoutPromise]) as File;

      console.log('✅ Compresión completada:', {
        originalSize: (file.size / 1024 / 1024).toFixed(2) + 'MB',
        compressedSize: (compressedFile.size / 1024 / 1024).toFixed(2) + 'MB',
        compressionRatio: ((file.size - compressedFile.size) / file.size * 100).toFixed(1) + '%'
      });

      setUploadProgress('Subiendo imagen al servidor...');

      // Sanitize filename con mejor manejo
      const sanitizeFileName = (name: string) => {
        return name
          .normalize('NFD') // Normalizar caracteres unicode
          .replace(/[\u0300-\u036f]/g, '') // Remover acentos
          .toLowerCase()
          .replace(/[^a-z0-9.-]/g, '-') // Solo letras, números, puntos y guiones
          .replace(/-+/g, '-') // Evitar guiones múltiples
          .replace(/^-|-$/g, '') // Remover guiones al inicio/fin
          .substring(0, 100); // Limitar longitud
      };

      const sanitizedFileName = sanitizeFileName(compressedFile.name);
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const fileName = `article-${timestamp}-${randomId}-${sanitizedFileName}`;

      console.log('📤 Subiendo archivo:', fileName);

      // Timeout para subida basado en tamaño
      const uploadTimeout = compressedFile.size > 1024 * 1024 ? 90000 : 45000; // 1.5min para grandes, 45s para pequeñas

      const uploadPromise = supabase.storage
        .from('media')
        .upload(fileName, compressedFile, {
          cacheControl: '31536000', // 1 año de cache
          upsert: false // No sobrescribir archivos existentes
        });

      const uploadTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_UPLOAD')), uploadTimeout)
      );

      const uploadResult = await Promise.race([uploadPromise, uploadTimeoutPromise]) as any;

      if (uploadResult.error) {
        console.error('❌ Error en subida:', uploadResult.error);

        // Manejar errores específicos de Supabase Storage
        if (uploadResult.error.message?.includes('Duplicate')) {
          toast.error('Ya existe una imagen con ese nombre. Inténtalo de nuevo.');
        } else if (uploadResult.error.message?.includes('size')) {
          toast.error('La imagen comprimida sigue siendo demasiado grande para el servidor.');
        } else {
          toast.error(`Error al subir la imagen: ${uploadResult.error.message}`);
        }
        return;
      }

      console.log('✅ Archivo subido exitosamente');

      setUploadProgress('Obteniendo URL pública...');

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      console.log('🔗 URL pública obtenida:', publicUrl);

      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      toast.success('Imagen subida exitosamente');

      // Limpiar el archivo local después de un tiempo
      setTimeout(() => {
        setImageFile(null);
      }, 2000);

    } catch (error) {
      console.error('❌ Error en proceso de imagen:', error);

      // Limpiar timers y estado en caso de error crítico
      if (error instanceof Error && error.message === 'TIMEOUT_UPLOAD') {
        console.log('🧹 Limpiando estado después de TIMEOUT_UPLOAD');
        // Limpiar timers de auto-guardado que puedan estar corriendo
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
          setAutoSaveTimer(null);
        }
        if (typingTimer) {
          clearTimeout(typingTimer);
          setTypingTimer(null);
        }
        // Resetear indicadores de conexión
        setConnectionStatus('checking');
        // Limpiar archivo local inmediatamente
        setImageFile(null);
      }

      if (error instanceof Error) {
        if (error.message === 'TIMEOUT_COMPRESSION') {
          toast.error('La compresión de la imagen tomó demasiado tiempo. Inténtalo con una imagen más pequeña o de menor resolución.');
        } else if (error.message === 'TIMEOUT_UPLOAD') {
          toast.error('La subida de la imagen tomó demasiado tiempo. Verifica tu conexión a internet e inténtalo de nuevo.');
        } else if (error.message.includes('Invalid image')) {
          toast.error('El archivo seleccionado no es una imagen válida. Asegúrate de seleccionar un archivo de imagen.');
        } else if (error.message.includes('compression')) {
          toast.error('Error al comprimir la imagen. Inténtalo con una imagen diferente.');
        } else {
          toast.error(`Error al procesar la imagen: ${error.message}`);
        }
      } else {
        toast.error('Error desconocido al procesar la imagen. Revisa la consola para más detalles.');
      }
    } finally {
      setUploadingImage(false);
      setUploadProgress('');
      // Desmarcar operación crítica
      setIsOperationInProgress(false);
    }
  };

  // Función para verificar conectividad con Supabase
  const checkSupabaseConnection = async (): Promise<boolean> => {
    try {
      console.log('🔍 Verificando conexión con Supabase...');
      // Usar getSession en lugar de consultar una tabla específica
      // Esto es más confiable y no depende de permisos de tablas
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('❌ Error de conexión con Supabase:', error);
        return false;
      }

      if (!session) {
        console.error('❌ No hay sesión activa');
        return false;
      }

      console.log('✅ Conexión con Supabase OK');
      return true;
    } catch (error) {
      console.error('❌ Error verificando conexión:', error);
      return false;
    }
  };

  // Función para cargar configuraciones de auto-guardado
  const loadAutoSaveSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('auto_save_enabled, auto_save_interval, save_on_navigation, save_on_typing, typing_delay')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error cargando configuraciones:', error);
        return;
      }

      if (data) {
        setAutoSaveSettings({
          enabled: data.auto_save_enabled ?? true,
          interval: data.auto_save_interval ?? 2,
          saveOnNavigation: data.save_on_navigation ?? true,
          saveOnTyping: data.save_on_typing ?? false,
          typingDelay: data.typing_delay ?? 30,
        });
      }
    } catch (error) {
      console.error('Error cargando configuraciones de auto-guardado:', error);
    }
  };

  // Función para guardar borrador automáticamente
  const autoSaveArticle = async (isManual: boolean = false) => {
    if (!autoSaveSettings.enabled && !isManual) return;
    if (!user || !session) return;
    if (!hasUnsavedChanges && !isManual) return;

    console.log('💾 [AUTOGUARDADO] Iniciando autoguardado - NO llama a IA');
    try {
      const now = new Date();
      const articleData = {
        user_id: user.id,
        title: formData.title || 'Sin título',
        content: formData.content || '',
        summary: formData.description || '',
        category: formData.category,
        image_url: formData.image_url || null,
        audio_url: formData.audio_url || null,
        author: formData.author || 'IA',
        gallery_urls: formData.gallery_urls || [],
        gallery_template: formData.gallery_template || 'list',
        status: 'draft',
        last_modified: now.toISOString(),
        article_id: isEditing ? articleId : null,
      };

      if (isEditing && articleId) {
        // Actualizar borrador existente
        const { error } = await supabase
          .from('article_drafts')
          .upsert([articleData], { onConflict: 'user_id,article_id' });

        if (error) throw error;
      } else {
        // Crear nuevo borrador
        const { error } = await supabase
          .from('article_drafts')
          .insert([articleData]);

        if (error) throw error;
      }

      setLastSaved(now);
      setHasUnsavedChanges(false);
      console.log('✅ [AUTOGUARDADO] Completado exitosamente - NO se usó IA');

      if (isManual) {
        toast.success('Borrador guardado automáticamente');
      }
    } catch (error) {
      console.error('❌ [AUTOGUARDADO] Error en auto-guardado:', error);
      if (isManual) {
        toast.error('Error al guardar borrador');
      }
    }
  };

  // Función para verificar conexión periódicamente
  const checkConnectionPeriodically = async () => {
    // Evitar verificaciones concurrentes
    if (connectionCheckInProgressRef.current) {
      return;
    }

    connectionCheckInProgressRef.current = true;

    try {
      // No verificar conexión si hay una operación crítica en progreso
      if (isOperationInProgress) {
        console.log('⏸️ Verificación de conexión pausada - operación en progreso');
        return;
      }

      // Primero, verificar y refrescar sesión si es necesario
      if (session) {
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = session.expires_at;
        
        // Refrescar si faltan menos de 15 minutos
        if (expiresAt && expiresAt - now < 900) {
          console.log('🔄 Refrescando sesión proactivamente...');
          try {
            const { data, error } = await supabase.auth.refreshSession();
            if (error) {
              console.error('Error refrescando sesión:', error);
              setConnectionStatus('disconnected');
              toast.error('Tu sesión ha expirado. Por favor, guarda tu trabajo y vuelve a iniciar sesión.');
              return;
            }
            if (data.session) {
              console.log('✅ Sesión refrescada automáticamente');
            }
          } catch (refreshError) {
            console.error('Error inesperado refrescando sesión:', refreshError);
          }
        }
      }

      // Luego, verificar conectividad
      const isConnected = await checkSupabaseConnection();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');

      // Si se desconecta, mostrar notificación
      if (!isConnected && connectionStatus === 'connected') {
        toast.error('Conexión perdida. Los cambios se guardarán localmente hasta que se restablezca.');
      }

      // Si se reconecta, mostrar notificación y guardar cambios pendientes
      if (isConnected && connectionStatus === 'disconnected') {
        toast.success('Conexión restablecida. Guardando cambios pendientes...');
        if (hasUnsavedChanges) {
          await autoSaveArticle(true);
        }
      }
    } finally {
      connectionCheckInProgressRef.current = false;
    }
  };

  // Función para manejar cambios en el contenido (para auto-guardado por escritura)
  const handleContentChange = (html: string) => {
    setFormData(prev => ({ ...prev, content: html }));
    setHasUnsavedChanges(true);

    if (autoSaveSettings.saveOnTyping) {
      // Limpiar timer anterior
      if (typingTimer) {
        clearTimeout(typingTimer);
      }

      // Establecer nuevo timer
      const timer = setTimeout(() => {
        autoSaveArticle();
      }, autoSaveSettings.typingDelay * 1000);

      setTypingTimer(timer);
    }
  };

  const handleSave = async (publish: boolean = false) => {
    if (!formData.title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }

    // Marcar operación crítica en progreso
    setIsOperationInProgress(true);
    setSaving(true);

    try {
      // Verificar autenticación usando el hook useAuth
      if (!user || !session) {
        toast.error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
        navigate('/login');
        return;
      }

      // Refrescar sesión proactivamente antes de cualquier operación
      setSavingProgress('Verificando sesión...');
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at;
      
      // Siempre intentar refrescar si faltan menos de 10 minutos
      if (expiresAt && expiresAt - now < 600) {
        console.log('Sesión próxima a expirar, refrescando...');
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          console.error('Error refrescando sesión:', error);
          toast.error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
          navigate('/login');
          return;
        }
        if (data.session) {
          console.log('✅ Sesión refrescada exitosamente');
        }
      }

      // Verificar conectividad con Supabase
      setSavingProgress('Verificando conexión...');
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        toast.error('No se pudo conectar con el servidor. Verifica tu conexión a internet e inténtalo de nuevo.');
        return;
      }

      setSavingProgress('Preparando datos del artículo...');

      // Pequeño delay para mostrar el progreso inicial
      await new Promise(resolve => setTimeout(resolve, 100));

      const nowIso = new Date().toISOString();

      console.log('Guardando artículo...', {
        isEditing,
        articleId,
        originalTable,
        publish,
        title: formData.title.substring(0, 50) + '...'
      });

      // Preparar datos del artículo
      let contentToSave = formData.content;

      // Validar contenido básico
      if (!contentToSave || contentToSave.trim() === '') {
        throw new Error('El contenido del artículo no puede estar vacío');
      }

      // Los datos ya vienen como HTML, no necesitamos conversión Markdown
      console.log('Contenido listo para guardar');

      // Convertir Markdown a HTML si es necesario (solo si hay caracteres markdown)
      if (contentToSave.includes('*') || contentToSave.includes('_') || contentToSave.includes('`')) {
        console.log('Convirtiendo Markdown a HTML...');
        setSavingProgress('Convirtiendo formato...');
        try {
          contentToSave = markdownToHtml(contentToSave);
          console.log('Conversión Markdown completada');
        } catch (mdError) {
          console.error('Error convirtiendo Markdown:', mdError);
          // Continuar con el contenido original si falla la conversión
          toast.error('Advertencia: No se pudo convertir el formato Markdown');
        }
      }

      console.log('Preparando datos del artículo...');

      // Preparar datos del artículo - contenido ya está procesado como HTML
      const articleData: any = {
        title: formData.title.trim(),
        content: contentToSave,
        category: formData.category,
        status: publish ? 'published' : 'draft',
      };

      // Agregar campos opcionales básicos
      if (formData.description?.trim()) articleData.summary = formData.description.trim();
      if (formData.image_url?.trim()) articleData.image_url = formData.image_url.trim();
      if (formData.audio_url?.trim()) articleData.audio_url = formData.audio_url.trim();
      
      // Manejar fuente RSS - siempre convertir a artículo propio al guardar/publicar
      if (originalTable === 'articles' || originalTable === 'local_news') {
        // Artículos RSS migrados se convierten en propios
        articleData.source_rss_id = null;
        articleData.author = 'IA';
      } else if (formData.rss_source_id) {
        // Artículos que ya eran propios pero tenían fuente RSS se convierten en propios al editar
        articleData.source_rss_id = null;
        articleData.author = 'IA';
      } else {
        // Artículos nuevos o propios mantienen autor IA
        articleData.author = formData.author?.trim() || 'IA';
      }

      // Agregar galería
      if (formData.gallery_urls?.length > 0) {
        articleData.gallery_urls = formData.gallery_urls.map(url =>
          typeof url === 'string' ? url : (url as any)?.url || url
        );
      }
      if (formData.gallery_template) articleData.gallery_template = formData.gallery_template;
      if (!isEditing) articleData.created_at = nowIso;

      // Validar campos obligatorios
      if (!articleData.title || articleData.title.length < 3) {
        throw new Error('El título debe tener al menos 3 caracteres');
      }
      if (!articleData.content || articleData.content.length < 10) {
        throw new Error('El contenido debe tener al menos 10 caracteres');
      }
      if (!articleData.category) {
        throw new Error('Debes seleccionar una categoría');
      }

      setSavingProgress('Guardando en base de datos...');
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('📝 Guardando artículo:', {
        isEditing,
        articleId,
        originalTable,
        dataKeys: Object.keys(articleData),
        contentLength: articleData.content.length
      });

      // Configurar timeout para operaciones de BD
      const dbTimeout = 30000; // 30 segundos máximo

      if (isEditing && articleId) {
        // Edición de artículo existente
        if (originalTable === 'articles' || originalTable === 'local_news') {
          // Migrar de RSS a artículos propios
          setSavingProgress('Migrando artículo...');
          
          console.log('Migrando artículo de', originalTable, 'a ai_generated_articles');

          // Crear timeout para la inserción
          const insertPromise = supabase
            .from('ai_generated_articles')
            .insert([{ ...articleData, id: articleId, created_at: nowIso }]);

          const insertTimeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT_DB_INSERT')), dbTimeout)
          );

          const insertResult = await Promise.race([insertPromise, insertTimeoutPromise]) as any;

          if (insertResult.error) {
            if (insertResult.error.code === '23505') {
              // Ya existe, hacer update
              console.log('Artículo ya existe, actualizando...');
              const updatePromise = supabase
                .from('ai_generated_articles')
                .update(articleData)
                .eq('id', articleId)
                .select();

              const updateTimeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT_DB_UPDATE')), dbTimeout)
              );

              const updateResult = await Promise.race([updatePromise, updateTimeoutPromise]) as any;

              if (updateResult.error) throw updateResult.error;
              console.log('✅ Artículo actualizado exitosamente');
            } else {
              throw insertResult.error;
            }
          }
          
          // Limpiar tabla original en background (sin esperar)
          supabase.from(originalTable).delete().eq('id', articleId).then(() => {
            console.log('Tabla original limpiada en background');
          }, (err: unknown) => {
            console.warn('Error limpiando tabla original:', err);
          });

          setOriginalTable('ai_generated_articles');
          toast.success(publish ? 'Artículo publicado exitosamente' : 'Artículo guardado exitosamente');
        } else {
          // Actualizar artículo existente
          setSavingProgress('Actualizando...');
          
          console.log('Actualizando artículo existente en ai_generated_articles');

          const updatePromise = supabase
            .from('ai_generated_articles')
            .update(articleData)
            .eq('id', articleId)
            .select();

          const updateTimeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT_DB_UPDATE')), dbTimeout)
          );

          const updateResult = await Promise.race([updatePromise, updateTimeoutPromise]) as any;

          if (updateResult.error) throw updateResult.error;
          if (!updateResult.data || updateResult.data.length === 0) throw new Error('No data returned from update');
          console.log('✅ Artículo actualizado:', updateResult.data[0].id);
          toast.success(publish ? 'Artículo actualizado y publicado exitosamente' : 'Artículo actualizado exitosamente');
        }
      } else {
        // Crear nuevo artículo
        setSavingProgress('Creando artículo...');
        
        console.log('Creando nuevo artículo en ai_generated_articles');

        const insertPromise = supabase
          .from('ai_generated_articles')
          .insert([articleData])
          .select();

        const insertTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT_DB_INSERT')), dbTimeout)
        );

        const insertResult = await Promise.race([insertPromise, insertTimeoutPromise]) as any;

        if (insertResult.error) {
          console.error('❌ Error al insertar artículo:', insertResult.error);
          throw insertResult.error;
        }
        if (!insertResult.data || insertResult.data.length === 0) {
          console.error('❌ Insert sin datos:', insertResult);
          throw new Error('No data returned from insert');
        }
        console.log('✅ Artículo creado:', insertResult.data[0].id);
        toast.success(publish ? 'Artículo creado y publicado exitosamente' : 'Artículo creado exitosamente');
      }

      // Limpiar estado de cambios no guardados
      if (descriptionTimeoutRef.current) {
        clearTimeout(descriptionTimeoutRef.current);
      }
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      
      // No navegar, mantener el editor abierto para continuar editando
    } catch (error) {
      console.error('Error saving article:', error);
      
      // Log detallado del error para debugging
      if (error && typeof error === 'object') {
        console.error('Error details:', JSON.stringify(error, null, 2));
      }
      
      if (error instanceof Error) {
        if (error.message === 'TIMEOUT_DB_INSERT' || error.message === 'TIMEOUT_DB_UPDATE') {
          toast.error('La operación tomó demasiado tiempo. Verifica tu conexión a internet e inténtalo de nuevo.');
        } else if (error.message.includes('JWT') || error.message.includes('session') || error.message.includes('expired')) {
          toast.error('Tu sesión ha expirado. Redirigiendo al login...');
          navigate('/login');
        } else if (error.message.includes('duplicate key') || error.message.includes('23505')) {
          toast.error('Ya existe un artículo con datos similares. Inténtalo de nuevo.');
        } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
          toast.error('No tienes permisos para guardar artículos. Contacta al administrador.');
        } else {
          toast.error(`Error al guardar: ${error.message}`);
        }
      } else if (error && typeof error === 'object' && 'message' in error) {
        toast.error(`Error al guardar: ${(error as any).message}`);
      } else {
        toast.error('Error desconocido al guardar el artículo. Revisa la consola para más detalles.');
      }
    } finally {
      setSaving(false);
      setSavingProgress('');
      // Desmarcar operación crítica
      setIsOperationInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className={onExit ? "bg-slate-50" : "min-h-screen bg-slate-50"}>
      {/* Header */}
      <header className={onExit ? "border-b border-slate-200 bg-white shadow-sm" : "sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm"}>
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  // Limpiar estado antes de navegar
                  if (descriptionTimeoutRef.current) {
                    clearTimeout(descriptionTimeoutRef.current);
                  }
                  // No need to manually clean up ReactQuill - React handles it
                  exitEditor();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {isRewriteMode ? 'Editar artículo con IA' : (isEditing ? 'Editar artículo' : 'Nuevo artículo')}
                </h1>
                <p className="text-sm text-slate-500">
                  {formData.category} • {formData.status === 'published' ? 'Publicado' : 'Borrador'}
                  {isRewriteMode && ' • Modo IA activado'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Guardar borrador
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {formData.status === 'published' ? 'Actualizar' : 'Publicar'}
              </button>
            </div>
            {/* Indicadores de conexión y auto-guardado */}
            <div className="flex items-center gap-3">
              {/* Indicador de conexión */}
              <div className="flex items-center gap-2">
                {connectionStatus === 'checking' && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Loader className="h-3 w-3 animate-spin" />
                    Verificando...
                  </div>
                )}
                {connectionStatus === 'connected' && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <Wifi className="h-3 w-3" />
                    Conectado
                  </div>
                )}
                {connectionStatus === 'disconnected' && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <WifiOff className="h-3 w-3" />
                    Desconectado
                  </div>
                )}
              </div>

              {/* Indicador de auto-guardado */}
              {autoSaveSettings.enabled && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  {lastSaved ? `Guardado ${Math.floor((Date.now() - lastSaved.getTime()) / 1000 / 60)}min atrás` : 'Sin guardar'}
                  {hasUnsavedChanges && <span className="text-orange-500">•</span>}
                </div>
              )}
            </div>
            {saving && savingProgress && (
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <Loader className="h-4 w-4 animate-spin" />
                {savingProgress}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Style selector */}
            {showStyleSelector && (
              <section className="rounded-3xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">
                    Generar con IA
                  </h3>
                  <button
                    onClick={() => setShowStyleSelector(false)}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="mb-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Tema del artículo {!formData.content?.trim() && !useCustomPrompt && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      placeholder={formData.content?.trim() ? "Opcional: especifica un enfoque particular..." : "Ej: Nuevas medidas económicas del gobierno"}
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      disabled={useCustomPrompt}
                    />
                    {formData.content?.trim() && !useCustomPrompt && (
                      <p className="mt-1 text-xs text-slate-500">
                        El artículo ya tiene contenido. Puedes dejar este campo vacío para usar el contenido existente como base.
                      </p>
                    )}
                  </div>

                  {/* Opción para usar prompt personalizado */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useCustomPrompt"
                      checked={useCustomPrompt}
                      onChange={(e) => {
                        setUseCustomPrompt(e.target.checked);
                        if (!e.target.checked) {
                          setCustomPrompt('');
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-2 focus:ring-purple-100"
                    />
                    <label htmlFor="useCustomPrompt" className="text-sm font-medium text-slate-700 cursor-pointer">
                      Usar prompt personalizado
                    </label>
                  </div>

                  {/* Textarea para prompt personalizado */}
                  {useCustomPrompt && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-700">
                          Prompt personalizado <span className="text-red-500">*</span>
                        </label>
                        <button
                          onClick={() => setShowTemplateManager(!showTemplateManager)}
                          className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100"
                        >
                          <BookMarked className="h-3 w-3" />
                          Plantillas ({savedTemplates.length})
                        </button>
                      </div>
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="Ej: Escribe un artículo informativo sobre [tema] incluyendo estadísticas, opiniones de expertos y análisis de impacto económico. El tono debe ser profesional y objetivo."
                        rows={6}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                          Define exactamente cómo quieres que la IA genere tu artículo.
                        </p>
                        {customPrompt.trim() && (
                          <button
                            onClick={() => setShowSaveTemplate(true)}
                            className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                          >
                            💾 Guardar como plantilla
                          </button>
                        )}
                      </div>

                      {/* Modal para guardar plantilla */}
                      {showSaveTemplate && (
                        <div className="mt-3 rounded-2xl border border-purple-200 bg-purple-50 p-4">
                          <h4 className="mb-2 text-sm font-semibold text-slate-800">Guardar plantilla</h4>
                          <input
                            type="text"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="Nombre de la plantilla"
                            className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                saveTemplate();
                              }
                            }}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={saveTemplate}
                              className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => {
                                setShowSaveTemplate(false);
                                setTemplateName('');
                              }}
                              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Gestor de plantillas */}
                      {showTemplateManager && savedTemplates.length > 0 && (
                        <div className="mt-3 space-y-2 rounded-2xl border border-purple-200 bg-white p-4 max-h-60 overflow-y-auto">
                          <h4 className="mb-2 text-sm font-semibold text-slate-800">Mis plantillas</h4>
                          {savedTemplates.map((template) => (
                            <div
                              key={template.id}
                              className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100"
                            >
                              <div className="flex-1 cursor-pointer" onClick={() => loadTemplate(template)}>
                                <p className="text-sm font-medium text-slate-800">{template.name}</p>
                                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{template.prompt}</p>
                              </div>
                              <button
                                onClick={() => deleteTemplate(template.id)}
                                className="text-red-500 hover:text-red-700"
                                title="Eliminar plantilla"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Opción de investigación web */}
                  <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                    <input
                      type="checkbox"
                      id="useWebResearch"
                      checked={useWebResearch}
                      onChange={(e) => setUseWebResearch(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      disabled={!customTopic.trim() && !useCustomPrompt}
                    />
                    <label htmlFor="useWebResearch" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm font-medium text-slate-700">Investigar en otros diarios</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        La IA buscará información en medios reconocidos para crear un artículo más informado y preciso.
                      </p>
                    </label>
                  </div>
                </div>

                {!useCustomPrompt && (
                  <div>
                    <div className="mb-4">
                      <label className="text-sm font-medium text-slate-700">
                        Proveedor de IA
                      </label>
                      <select
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      >
                        {aiConfig.fallbackOrder.map(provider => (
                          <option key={provider} value={provider}>
                            {provider === 'google' ? 'Google AI (Gemini)' :
                             provider === 'openrouter' ? 'OpenRouter' :
                             provider === 'openai' ? 'OpenAI' :
                             provider === 'puter' ? 'Puter AI' : provider}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">
                        Selecciona el proveedor de IA que deseas usar para generar el contenido.
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="text-sm font-medium text-slate-700">
                        Estilo periodístico
                      </label>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {Object.values(JOURNALISTIC_PROMPTS).map(prompt => (
                          <button
                            key={prompt.id}
                            type="button"
                            onClick={() => setSelectedStyle(prompt.id)}
                            className={`rounded-2xl border-2 p-4 text-left transition ${
                              selectedStyle === prompt.id
                                ? 'border-purple-500 bg-purple-100'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="mb-2 text-2xl">{prompt.icon}</div>
                            <h4 className="font-semibold text-slate-800">{prompt.name}</h4>
                            <p className="mt-1 text-xs text-slate-500">{prompt.description}</p>
                            <p className="mt-2 text-xs text-slate-400">
                              {prompt.minWords}-{prompt.maxWords} palabras
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Web Research Test Component */}
                <div className="mb-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Globe className="h-4 w-4 text-indigo-600" />
                      Probar Investigación Web
                    </h4>
                    <button
                      onClick={() => setShowWebResearchTest(!showWebResearchTest)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      {showWebResearchTest ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>

                  {showWebResearchTest && (
                    <div className="space-y-3">
                      <div>
                        <input
                          type="text"
                          value={testSearchTopic}
                          onChange={(e) => setTestSearchTopic(e.target.value)}
                          placeholder="Ingresa un tema para buscar (ej: inflación Argentina 2024)"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              testWebResearch();
                            }
                          }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={testWebResearch}
                          disabled={testingWebResearch || !testSearchTopic.trim()}
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {testingWebResearch ? (
                            <>
                              <Loader className="h-4 w-4 animate-spin" />
                              Buscando...
                            </>
                          ) : (
                            <>
                              <Globe className="h-4 w-4" />
                              Probar búsqueda
                            </>
                          )}
                        </button>
                        {testSearchResults && (
                          <button
                            onClick={() => setTestSearchResults('')}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>
                      {testSearchResults && (
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <h5 className="mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Resultados de la búsqueda:
                          </h5>
                          <div className="max-h-60 overflow-y-auto">
                            <pre className="whitespace-pre-wrap text-xs text-slate-700 font-mono">
                              {testSearchResults}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={generateContentWithAI}
                  disabled={generating}
                  className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
                >
                  {generating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader className="h-5 w-5 animate-spin" />
                      {useWebResearch ? 'Investigando y generando...' : 'Generando...'}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Wand2 className="h-5 w-5" />
                      Generar artículo
                    </span>
                  )}
                </button>
              </section>
            )}

            {/* Title and description */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">
                      Título del artículo
                    </label>
                    <button
                      onClick={generateTitleWithAI}
                      disabled={generatingTitle || !formData.content.trim()}
                      className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generar título con IA"
                    >
                      {generatingTitle ? (
                        <Loader className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {generatingTitle ? 'Generando...' : 'Generar'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, title: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Ingresa un título impactante..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">
                      Descripción breve
                    </label>
                    <button
                      onClick={generateDescriptionWithAI}
                      disabled={generatingDescription || !formData.content.trim()}
                      className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generar descripción con IA"
                    >
                      {generatingDescription ? (
                        <Loader className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {generatingDescription ? 'Generando...' : 'Generar'}
                    </button>
                  </div>
                  <textarea
                    value={localDescription}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    onPaste={handleDescriptionPaste}
                    placeholder="Resumen del artículo..."
                    rows={3}
                    maxLength={500}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {localDescription.length}/500 caracteres
                  </p>
                </div>
              </div>
            </section>

            {/* Content editor */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              {isRewriteMode && (
                <div className="mb-4 rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 p-4">
                  <div className="flex items-center gap-3">
                    <Brain className="h-6 w-6 text-purple-600" />
                    <div>
                      <h4 className="font-semibold text-purple-900">Modo Edición con IA</h4>
                      <p className="text-sm text-purple-700">
                        Puedes reescribir el contenido existente usando IA para mejorarlo, o generar contenido completamente nuevo.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">
                  Contenido principal
                </h3>
                <div className="flex gap-2">
                  {isRewriteMode && (
                    <button
                      onClick={rewriteContentWithAI}
                      disabled={generating}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
                    >
                      <Brain className="h-4 w-4" />
                      {generating ? 'Reescribiendo...' : 'Reescribir'}
                    </button>
                  )}
                  {!showStyleSelector && (
                    <button
                      onClick={() => setShowStyleSelector(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white hover:from-purple-700 hover:to-pink-700"
                    >
                      <Sparkles className="h-4 w-4" />
                      Generar con IA
                    </button>
                  )}
                </div>
              </div>
              <ReactQuill
                ref={editorRef}
                value={formData.content}
                onChange={handleContentChange}
                theme="snow"
                className="bg-white"
                style={{ minHeight: '500px' }}
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'script': 'sub'}, { 'script': 'super' }],
                    [{ 'indent': '-1'}, { 'indent': '+1' }],
                    [{ 'direction': 'rtl' }],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'align': [] }],
                    ['link', 'image', 'video'],
                    ['clean']
                  ]
                }}
                placeholder="Escribe el contenido del artículo aquí..."
              />
            </section>

            {/* Gallery */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-slate-800">
                Galería multimedia
              </h3>
              <GalleryManager
                images={galleryImages}
                template={formData.gallery_template}
                onImagesChange={handleGalleryChange}
                onTemplateChange={handleGalleryTemplateChange}
                maxImages={20}
              />
            </section>

            {/* Audio Transcriber with AI */}
            <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-slate-900">Transcribir Audio a Texto</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAudioTranscriber(!showAudioTranscriber)}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Brain className="h-4 w-4" />
                {showAudioTranscriber ? 'Ocultar' : 'Abrir'} Transcriptor Whisper
              </button>
              {showAudioTranscriber && (
                <div className="mt-4">
                  <AudioTranscriber
                    onTranscriptionComplete={(text) => {
                      setFormData(prev => ({ ...prev, content: prev.content + '\n\n' + text }));
                      toast.success('Transcripción agregada al contenido del artículo');
                      setShowAudioTranscriber(false);
                    }}
                  />
                </div>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Transcribe entrevistas, conferencias de prensa o cualquier audio a texto automáticamente con Whisper de OpenAI.
              </p>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick actions */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Acciones rápidas
              </h3>
              <div className="space-y-3">
                {/* Web research toggle */}
                <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                  <input
                    type="checkbox"
                    id="globalWebResearch"
                    checked={useWebResearch}
                    onChange={(e) => setUseWebResearch(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                  <label htmlFor="globalWebResearch" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm font-medium text-slate-700">Investigar en la web</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Busca información actualizada en medios confiables para enriquecer el contenido generado.
                    </p>
                  </label>
                </div>
                <div className="space-y-2">
                {isRewriteMode && (
                  <button
                    onClick={rewriteContentWithAI}
                    disabled={generating}
                    className="flex w-full items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-left text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                  >
                    <Brain className="h-5 w-5" />
                    {generating ? 'Reescribiendo...' : 'Reescribir con IA'}
                  </button>
                )}
                <button
                  onClick={() => setShowStyleSelector(true)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-left text-sm font-medium text-purple-700 hover:bg-purple-100"
                >
                  <Wand2 className="h-5 w-5" />
                  Generar contenido con IA
                </button>
                <button
                  onClick={generateCoverImage}
                  disabled={generatingImage}
                  className="flex w-full items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  <ImageIcon className="h-5 w-5" />
                  {generatingImage ? 'Generando...' : 'Generar imagen destacada'}
                </button>
                <button
                  onClick={() => setShowAdvancedImageGen(true)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-left text-sm font-medium text-green-700 hover:bg-green-100"
                >
                  <Sparkles className="h-5 w-5" />
                  Generación avanzada con IA
                </button>
                {canUndo && (
                  <button
                    onClick={undoLastAIChange}
                    className="flex w-full items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-left text-sm font-medium text-orange-700 hover:bg-orange-100"
                  >
                    <Undo2 className="h-5 w-5" />
                    Deshacer último cambio de IA
                  </button>
                )}
                </div>
              </div>
            </section>

            {/* Cover image */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Imagen destacada
              </h3>
              {uploadingImage && uploadProgress && (
                <div className="mb-4 flex items-center gap-2 text-sm text-blue-600">
                  <Loader className="h-4 w-4 animate-spin" />
                  {uploadProgress}
                </div>
              )}
              {formData.image_url && (
                <div className="mb-4">
                  <img
                    src={formData.image_url}
                    alt="Portada"
                    className="w-full rounded-2xl object-cover"
                  />
                </div>
              )}
              {imageFile && !formData.image_url && (
                <div className="mb-4">
                  <img
                    src={URL.createObjectURL(imageFile)}
                    alt="Preview"
                    className="w-full rounded-2xl object-cover"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Tamaño original: {(imageFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-xs text-blue-600">
                    La imagen será comprimida automáticamente antes de subir (máx. 2MB, 1920px)
                  </p>
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Subir imagen desde dispositivo
                  </label>
                  {/* Detectar si es móvil para mostrar opciones diferentes */}
                  {typeof window !== 'undefined' && window.innerWidth < 768 ? (
                    // Móvil: dos botones separados
                    <div className="mt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              setImageFile(file);
                              handleImageUpload(file);
                            }
                          };
                          input.click();
                        }}
                        disabled={uploadingImage}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                      >
                        <FolderOpen className="h-4 w-4" />
                        Seleccionar de galería
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.capture = 'environment';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              setImageFile(file);
                              handleImageUpload(file);
                            }
                          };
                          input.click();
                        }}
                        disabled={uploadingImage}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        <Camera className="h-4 w-4" />
                        Tomar foto
                      </button>
                    </div>
                  ) : (
                    // Desktop: input file único
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setImageFile(file);
                            handleImageUpload(file);
                          }
                        }}
                        disabled={uploadingImage}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Puedes subir una imagen desde tu dispositivo o tomar una foto con la cámara.
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    O ingresa URL de imagen
                  </label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                    placeholder="URL de la imagen..."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                {showImagePrompt && (
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Prompt personalizado para IA
                    </label>
                    <input
                      type="text"
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="Describe la imagen que deseas..."
                      className="mt-1 w-full rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-slate-700 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowImagePrompt(!showImagePrompt)}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    {showImagePrompt ? 'Ocultar' : 'Personalizar'} prompt
                  </button>
                </div>
              </div>
            </section>

            {/* Audio */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Audio del artículo
              </h3>
              {formData.audio_url && (
                <div className="mb-4">
                  <AudioPlayer
                    audioUrl={formData.audio_url}
                    audioTitle={formData.title || 'Audio del artículo'}
                    className="mb-4"
                  />
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    URL del audio
                  </label>
                  <input
                    type="url"
                    value={formData.audio_url || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, audio_url: e.target.value }))}
                    placeholder="URL del archivo de audio..."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAudioSelector(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <Music className="h-4 w-4" />
                    Seleccionar audio
                  </button>
                  <p className="mt-1 text-xs text-slate-500">
                    Elige un archivo de audio ya subido al servidor.
                  </p>
                </div>
              </div>
            </section>

            {/* Advanced Image Generation */}
            {showAdvancedImageGen && (
              <section className="rounded-3xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">
                    Generación Avanzada con IA
                  </h3>
                  <button
                    onClick={() => setShowAdvancedImageGen(false)}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Prompt detallado para la IA
                    </label>
                    <textarea
                      value={advancedImagePrompt}
                      onChange={(e) => setAdvancedImagePrompt(e.target.value)}
                      placeholder="Describe con detalle la imagen que quieres generar. La IA analizará tu descripción y creará una imagen profesional..."
                      rows={4}
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="useUploadedImage"
                      checked={useUploadedImage}
                      onChange={(e) => setUseUploadedImage(e.target.checked)}
                      className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                    />
                    <label htmlFor="useUploadedImage" className="text-sm text-slate-700">
                      Considerar imagen subida como inspiración (la IA mejorará el prompt basado en tu descripción)
                    </label>
                  </div>

                  {useUploadedImage && (
                    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4">
                      <p className="text-sm text-slate-600 mb-2">
                        Sube una imagen que sirva como inspiración para la IA:
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setImageFile(file);
                          }
                        }}
                        className="w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                      />
                      {imageFile && (
                        <div className="mt-3">
                          <img
                            src={URL.createObjectURL(imageFile)}
                            alt="Inspiración"
                            className="w-full max-h-32 rounded-xl object-cover"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            La IA usará esta imagen como inspiración para mejorar tu prompt
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={generateAdvancedImage}
                    disabled={generatingImage || !advancedImagePrompt.trim()}
                    className="w-full rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 font-semibold text-white hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
                  >
                    {generatingImage ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader className="h-5 w-5 animate-spin" />
                        Generando con IA...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        Generar imagen avanzada
                      </span>
                    )}
                  </button>
                </div>
              </section>
            )}

            {/* Settings */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Configuración
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Categoría
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Autor
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                    placeholder="Nombre del autor..."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                {isEditing && formData.rss_source_id && (
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Fuente
                    </label>
                    <select
                      value={formData.rss_source_id || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, rss_source_id: e.target.value || null }))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Sin fuente</option>
                      {sources.map(source => (
                        <option key={source.id} value={source.id}>
                          {source.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Audio Selector */}
      <AudioSelector
        isOpen={showAudioSelector}
        onClose={() => setShowAudioSelector(false)}
        onSelect={(url) => {
          setFormData(prev => ({ ...prev, audio_url: url }));
          setShowAudioSelector(false);
        }}
      />
    </div>
  );
}
