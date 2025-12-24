import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import imageCompression from 'browser-image-compression';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { convertHtmlToDocument, prepareContentForDisplay } from '../lib/contentFormatting';
import { markdownToHtml, cleanAIGeneratedContent } from '../lib/markdownUtils';
import toast from 'react-hot-toast';

interface AIArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url: string | null;
  image_caption?: string | null;
  summary?: string | null;
  published_at: string;
  status: string;
}

interface RSSArticle {
  id: string;
  title: string;
  description: string;
  content: string;
  url: string;
  category: string;
  image_url?: string;
  rss_source_id: string;
  rss_sources: {
    name: string;
  }[];
}

export const AIManager: React.FC = () => {
  const [article, setArticle] = useState('');
  const [puterPrompt, setPuterPrompt] = useState('');
  const [puterResponse, setPuterResponse] = useState('');
  const [puterLoading, setPuterLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Nacionales');
  const [summary, setSummary] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [rssArticles, setRssArticles] = useState<RSSArticle[]>([]);
  const [selectedRssArticle, setSelectedRssArticle] = useState<RSSArticle | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [rssImageFile, setRssImageFile] = useState<File | null>(null);
  const [rssUrl, setRssUrl] = useState('');
  const [aiArticles, setAiArticles] = useState<AIArticle[]>([]);
  const [selectedAiArticle, setSelectedAiArticle] = useState<AIArticle | null>(null);
  const [editing, setEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [promptUsed, setPromptUsed] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rssFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRssArticles();
    loadAiArticles();
  }, []);

  const cleanRewrittenArticle = (content: string): string => {
    // Usar la función de limpieza de contenido IA que preserva el formato Markdown
    const cleanedMarkdown = cleanAIGeneratedContent(content);
    // Convertir el Markdown limpio a HTML
    return markdownToHtml(cleanedMarkdown);
  };

  const loadRssArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select(`
          id,
          title,
          description,
          content,
          url,
          category,
          image_url,
          rss_source_id,
          rss_sources (
            name
          )
        `)
        .not('rss_source_id', 'is', null)
        .order('published_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRssArticles(data || []);
    } catch (error) {
      console.error('Error loading RSS articles:', error);
    }
  };

  const loadAiArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_generated_articles')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAiArticles(data || []);
    } catch (error) {
      console.error('Error loading AI articles:', error);
    }
  };

  const handleEditAiArticle = (article: AIArticle) => {
    setSelectedAiArticle(article);
    setTitle(article.title);
    setArticle(convertHtmlToDocument(article.content || ''));
    setCategory(article.category);
    setSummary(article.summary || '');
    setImageCaption(article.image_caption || '');
    setImageFile(null); // Reset image file since we're editing existing article
    setEditing(true);
  };

  const handleUpdateAiArticle = async () => {
    if (!selectedAiArticle || !title || !article) {
      toast.error('Completa todos los campos requeridos.');
      return;
    }

    const loadingToast = toast.loading('Actualizando artículo...');

    const htmlContent = prepareContentForDisplay(article);

    setUpdating(true);
    try {
      let imageUrl = selectedAiArticle.image_url;

      // Handle new image upload if provided
      if (imageFile) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };

        try {
          const compressedFile = await imageCompression(imageFile, options);
          const fileName = `ai-article-${Date.now()}-${compressedFile.name}`;

          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(fileName, compressedFile);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('media')
              .getPublicUrl(fileName);
            imageUrl = publicUrl;
          }
        } catch (compressionError) {
          console.error('Error compressing image:', compressionError);
          // Try with original file
          try {
            const fileName = `ai-article-${Date.now()}-${imageFile.name}`;
            const { error: uploadError } = await supabase.storage
              .from('media')
              .upload(fileName, imageFile);

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(fileName);
              imageUrl = publicUrl;
            }
          } catch (uploadErr) {
            console.error('Error uploading original image:', uploadErr);
          }
        }
      }

      const { error } = await supabase
        .from('ai_generated_articles')
        .update({
          title,
          content: htmlContent,
          category,
          image_url: imageUrl,
          image_caption: imageCaption || null,
          summary: summary || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedAiArticle.id);

      if (error) throw error;

      toast.success('Artículo actualizado exitosamente!', { id: loadingToast });
      await loadAiArticles(); // Reload articles
      setSelectedAiArticle(null);
      setEditing(false);
      setTitle('');
      setArticle('');
      setCategory('Nacionales');
      setSummary('');
      setImageCaption('');
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Error updating AI article:', error);
      toast.error('Error al actualizar el artículo.', { id: loadingToast });
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setSelectedAiArticle(null);
    setEditing(false);
    setTitle('');
    setArticle('');
    setCategory('Nacionales');
    setSummary('');
    setImageCaption('');
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRewriteRssArticle = async () => {
    console.log('Iniciando handleRewriteRssArticle');
    if (!selectedRssArticle) {
      toast.error('Selecciona un artículo RSS primero.');
      return;
    }

    const loadingToast = toast.loading('Reescribiendo artículo con IA...');

    setRewriting(true);
    let imageUrl = '';

    // Verificar si el usuario está autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Debes estar autenticado para guardar artículos.', { id: loadingToast });
      setRewriting(false);
      return;
    }

    console.log('Usuario autenticado:', user.id);
    try {
      const rewritePrompt = `Reescribe el siguiente artículo de noticias de manera profesional y atractiva, manteniendo la información esencial pero mejorando el lenguaje y la estructura. El artículo original es sobre: "${selectedRssArticle.title}"

Resumen original: "${selectedRssArticle.description}"

Contenido completo: "${selectedRssArticle.content}"

Por favor, genera:
1. Un título más atractivo y SEO-friendly
2. Un artículo reescrito completo con buena estructura, párrafos coherentes y lenguaje periodístico profesional
3. Mantén la objetividad y precisión de la información original`;

      setPromptUsed(rewritePrompt);

      const puterObj = window as unknown as { puter?: { ai?: { chat: (msg: string) => Promise<string> } } };
      if (!puterObj.puter || !puterObj.puter.ai || !puterObj.puter.ai.chat) {
        toast.error('Puter.js no está disponible. Asegúrate de haber incluido el script de Puter.js en index.html y que la página se haya cargado completamente.', { id: loadingToast });
        return;
      }

      const response = await puterObj.puter.ai.chat(rewritePrompt);
      const rawRewrittenArticle = typeof response === 'string' ? response : JSON.stringify(response, null, 2);

      // Limpiar el contenido generado por IA
      const rewrittenArticle = cleanRewrittenArticle(rawRewrittenArticle);

      setArticle(rewrittenArticle);

      // Extraer título del artículo reescrito (primera línea o primeras palabras)
      const textContent = rewrittenArticle.replace(/<[^>]*>/g, '');
      const lines = textContent.split('\n').filter(line => line.trim());
      const extractedTitle = lines[0]?.length > 5 ? lines[0] :
                            textContent.substring(0, 80) + (textContent.length > 80 ? '...' : '');
      setTitle(extractedTitle);
      // Mantener la categoría del artículo original
      setCategory(selectedRssArticle.category);

      // Subir imagen si existe, o usar la imagen del artículo RSS original
      if (rssImageFile) {
        toast.loading('Subiendo imagen...', { id: loadingToast });
        try {
          // Comprimir y redimensionar imagen antes de subir
          const options = {
            maxSizeMB: 1, // Máximo 1MB
            maxWidthOrHeight: 1920, // Máximo 1920px de ancho o alto
            useWebWorker: true,
          };

          const compressedFile = await imageCompression(rssImageFile, options);
          const fileName = `rss-article-${Date.now()}-${compressedFile.name}`;

          console.log('Subiendo imagen comprimida:', fileName, 'Tamaño:', compressedFile.size);

          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(fileName, compressedFile);

          if (uploadError) {
            console.error('Error uploading compressed image:', uploadError);
            toast.error('Error al subir la imagen, pero el artículo fue reescrito correctamente.', { id: loadingToast });
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('media')
              .getPublicUrl(fileName);
            setImageFile(compressedFile); // Guardar la imagen comprimida para publicación
            imageUrl = publicUrl;
            console.log('Imagen subida exitosamente:', publicUrl);
          }
        } catch (compressionError) {
          console.error('Error compressing image:', compressionError);
          // Intentar subir la imagen original si falla la compresión
          try {
            const fileName = `rss-article-${Date.now()}-${rssImageFile.name}`;
            const { error: uploadError } = await supabase.storage
              .from('media')
              .upload(fileName, rssImageFile);

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(fileName);
              setImageFile(rssImageFile);
              imageUrl = publicUrl;
              console.log('Imagen original subida exitosamente:', publicUrl);
            } else {
              toast.error('Error al subir la imagen, pero el artículo fue reescrito correctamente.', { id: loadingToast });
            }
          } catch (uploadErr) {
            console.error('Error uploading original image:', uploadErr);
            toast.error('Error al subir la imagen, pero el artículo fue reescrito correctamente.', { id: loadingToast });
          }
        }
      } else if (selectedRssArticle.image_url) {
        // Usar la imagen del artículo RSS original si no se subió una nueva
        imageUrl = selectedRssArticle.image_url;
        console.log('Usando imagen del artículo RSS original:', imageUrl);
      }

      toast.loading('Guardando artículo como borrador...', { id: loadingToast });

      console.log('selectedRssArticle:', selectedRssArticle);

      // Convertir el artículo reescrito a HTML antes de usar htmlContent
      const htmlContent = rewrittenArticle; // Ya viene convertido de cleanRewrittenArticle

      console.log('Intentando guardar borrador con datos:', {
        title: extractedTitle,
        content: htmlContent.substring(0, 100) + '...',
        category: selectedRssArticle.category,
        status: 'draft',
        source_rss_id: null, // Artículos propios no tienen fuente RSS
        prompt_used: rewritePrompt,
        image_url: imageUrl || null,
        summary: '',
        image_caption: '',
      });

      try {
        const { error: draftError } = await supabase
          .from('ai_generated_articles')
          .insert([{
            title: extractedTitle,
            content: htmlContent,
            category: selectedRssArticle.category,
            status: 'draft',
            source_rss_id: null, // Artículos propios no tienen fuente RSS
            prompt_used: rewritePrompt,
            image_url: imageUrl || null,
            summary: '',
            image_caption: '',
            author: 'La Voz del Norte Diario', // Establecer autor
          }]);

        if (draftError) {
          console.error('Error saving draft:', draftError);
          toast.error('Error al guardar el borrador: ' + draftError.message, { id: loadingToast });
        } else {
          console.log('Borrador guardado exitosamente en la base de datos como artículo propio');
          toast.success('Artículo reescrito y guardado como borrador exitosamente.', { id: loadingToast });
          await loadAiArticles();
        }
      } catch (draftErr) {
        console.error('Excepción al guardar borrador:', draftErr);
        toast.error('Error al guardar el borrador: ' + (draftErr as Error).message, { id: loadingToast });
      }
    } catch (error) {
      console.error('Error reescribiendo artículo:', error);
      toast.error('Error al reescribir el artículo.', { id: loadingToast });
    } finally {
      setRewriting(false);
    }
  };

  const handlePuterChat = async () => {
    const loadingToast = toast.loading('Consultando Puter.js...');

    setPuterLoading(true);
    try {
      const puterObj = window as unknown as { puter?: { ai?: { chat: (msg: string) => Promise<string> } } };
      if (puterObj.puter && puterObj.puter.ai && puterObj.puter.ai.chat) {
        const response = await puterObj.puter.ai.chat(puterPrompt);
        setPromptUsed(puterPrompt);
        const responseText = typeof response === 'string' ? response : JSON.stringify(response, null, 2);
        const cleanedResponse = cleanRewrittenArticle(responseText);
        setPuterResponse(responseText);
        setArticle(cleanedResponse);
        // Extraer título de las primeras palabras, removiendo tags HTML
        const textContent = cleanedResponse.replace(/<[^>]*>/g, '');
        const firstLine = textContent.split('\n')[0];
        setTitle(firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine);
        toast.success('Consulta completada exitosamente', { id: loadingToast });
      } else {
        toast.error('El objeto puter no está disponible. Asegúrate de haber incluido el script de Puter.js en index.html.', { id: loadingToast });
      }
    } catch (error) {
      console.error(error);
      toast.error('Error consultando Puter.js.', { id: loadingToast });
    } finally {
      setPuterLoading(false);
    }
  };

  const handlePublish = async () => {
    console.log('Iniciando handlePublish');
    if (!article || !title) {
      toast.error('Debes generar un artículo y proporcionar un título.');
      return;
    }

    // Verificar si el usuario está autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Debes estar autenticado para publicar artículos.');
      return;
    }

    console.log('Usuario autenticado:', user.id);

    const loadingToast = toast.loading('Publicando artículo...');

    setPublishing(true);
    try {
      let imageUrl = '';

      if (imageFile) {
        toast.loading('Subiendo imagen...', { id: loadingToast });
        // Comprimir y redimensionar imagen antes de subir
        const options = {
          maxSizeMB: 1, // Máximo 1MB
          maxWidthOrHeight: 1920, // Máximo 1920px de ancho o alto
          useWebWorker: true,
        };

        try {
          const compressedFile = await imageCompression(imageFile, options);
          const fileName = `ai-article-${Date.now()}-${compressedFile.name}`;

          console.log('Subiendo imagen comprimida:', fileName, 'Tamaño:', compressedFile.size);

          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(fileName, compressedFile);

          if (uploadError) {
            console.error('Error uploading compressed image:', uploadError);
            toast.error('Error al subir la imagen, pero continuando con la publicación.', { id: loadingToast });
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('media')
              .getPublicUrl(fileName);
            imageUrl = publicUrl;
            console.log('Imagen subida exitosamente:', publicUrl);
          }
        } catch (compressionError) {
          console.error('Error compressing image:', compressionError);
          // Intentar subir la imagen original si falla la compresión
          try {
            const fileName = `ai-article-${Date.now()}-${imageFile.name}`;
            const { error: uploadError } = await supabase.storage
              .from('media')
              .upload(fileName, imageFile);

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(fileName);
              imageUrl = publicUrl;
            } else {
              toast.error('Error al subir la imagen, pero continuando con la publicación.', { id: loadingToast });
            }
          } catch (uploadErr) {
            console.error('Error uploading original image:', uploadErr);
            toast.error('Error al subir la imagen, pero continuando con la publicación.', { id: loadingToast });
          }
        }
      }

      const htmlContent = prepareContentForDisplay(article);

      // Los artículos propios (reescritos o generados) no tienen source_rss_id
      const sourceRssId = null;

      console.log('Intentando publicar artículo con datos:', {
        title,
        content: htmlContent.substring(0, 100) + '...',
        category,
        status: 'published',
        source_rss_id: sourceRssId,
        prompt_used: promptUsed,
        image_url: imageUrl || null,
        image_caption: imageCaption || null,
        summary: summary || null,
        published_at: new Date().toISOString()
      });

      const { error } = await supabase
        .from('ai_generated_articles')
        .insert([{
          title,
          content: htmlContent,
          category,
          status: 'published',
          source_rss_id: sourceRssId,
          prompt_used: promptUsed,
          image_url: imageUrl || null,
          image_caption: imageCaption || null,
          summary: summary || null,
          author: 'La Voz del Norte Diario',
          published_at: new Date().toISOString()
        }]);

      if (error) throw error;

      console.log('Artículo publicado exitosamente');
      toast.success('Artículo publicado exitosamente!', { id: loadingToast });
      // Limpiar formulario
      setArticle('');
      setTitle('');
      setSummary('');
      setImageCaption('');
      setPuterPrompt('');
      setPuterResponse('');
      setImageFile(null);
      setRssImageFile(null);
      setRssUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (rssFileInputRef.current) rssFileInputRef.current.value = '';
    } catch (error) {
      console.error('Error publicando artículo:', error);
      toast.error('Error al publicar el artículo: ' + (error as Error).message, { id: loadingToast });
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveDraft = async () => {
    console.log('Iniciando handleSaveDraft');
    if (!article || !title) {
      toast.error('Debes generar un artículo y proporcionar un título.');
      return;
    }

    const loadingToast = toast.loading('Guardando borrador...');

    setPublishing(true);
    try {
      let imageUrl = '';

      if (imageFile) {
        toast.loading('Subiendo imagen...', { id: loadingToast });
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };

        try {
          const compressedFile = await imageCompression(imageFile, options);
          const fileName = `ai-article-${Date.now()}-${compressedFile.name}`;

          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(fileName, compressedFile);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('media')
              .getPublicUrl(fileName);
            imageUrl = publicUrl;
          } else {
            toast.error('Error al subir la imagen, pero continuando con el guardado.', { id: loadingToast });
          }
        } catch (compressionError) {
          try {
            const fileName = `ai-article-${Date.now()}-${imageFile.name}`;
            const { error: uploadError } = await supabase.storage
              .from('media')
              .upload(fileName, imageFile);

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(fileName);
              imageUrl = publicUrl;
            } else {
              toast.error('Error al subir la imagen, pero continuando con el guardado.', { id: loadingToast });
            }
          } catch (uploadErr) {
            console.error('Error uploading original image:', uploadErr);
            toast.error('Error al subir la imagen, pero continuando con el guardado.', { id: loadingToast });
          }
        }
      }

      const htmlContent = prepareContentForDisplay(article);

      // Los artículos propios no tienen source_rss_id
      const sourceRssId = null;

      console.log('Intentando guardar borrador manual con datos:', {
        title,
        content: htmlContent.substring(0, 100) + '...',
        category,
        status: 'draft',
        source_rss_id: sourceRssId,
        prompt_used: promptUsed,
        image_url: imageUrl || null,
        image_caption: imageCaption || null,
        summary: summary || null,
      });

      const { error } = await supabase
        .from('ai_generated_articles')
        .insert([{
          title,
          content: htmlContent,
          category,
          status: 'draft',
          source_rss_id: sourceRssId,
          prompt_used: promptUsed,
          image_url: imageUrl || null,
          image_caption: imageCaption || null,
          summary: summary || null,
          author: 'La Voz del Norte Diario',
        }]);

      if (error) throw error;

      console.log('Borrador manual guardado exitosamente');
      toast.success('Borrador guardado exitosamente!', { id: loadingToast });
      await loadAiArticles();
    } catch (error) {
      console.error('Error guardando borrador:', error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Error al guardar el borrador: ' + message, { id: loadingToast });
    } finally {
      setPublishing(false);
    }
  };

  const handleContentChange = (value: string) => {
    setArticle(value);
  };

  return (
    <div className="p-4 md:p-6">
      <h2 className="text-xl md:text-2xl font-bold mb-4">Generador de Artículos con IA</h2>

      {/* Nueva sección: Reescribir artículos RSS */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3">Reescribir Artículo RSS</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-blue-700 mb-2">Seleccionar Artículo RSS:</label>
          <select
            value={selectedRssArticle?.id || ''}
            onChange={(e) => {
              const article = rssArticles.find(a => a.id === e.target.value);
              setSelectedRssArticle(article || null);
            }}
            className="w-full p-2 border border-blue-300 rounded"
          >
            <option value="">-- Seleccionar artículo --</option>
            {rssArticles.map((article) => (
              <option key={article.id} value={article.id}>
                {article.title} - {article.rss_sources?.[0]?.name || 'Fuente desconocida'}
              </option>
            ))}
          </select>
        </div>

        {selectedRssArticle && (
          <div className="mb-4 p-3 bg-white border border-blue-300 rounded">
            <h4 className="font-medium text-blue-800">{selectedRssArticle.title}</h4>
            <p className="text-sm text-gray-600 mt-1">{selectedRssArticle.description}</p>
            <p className="text-xs text-gray-500 mt-2">Categoría: {selectedRssArticle.category} | Fuente: {selectedRssArticle.rss_sources?.[0]?.name || 'Desconocida'}</p>
            {selectedRssArticle.image_url && (
              <div className="mt-3">
                <img 
                  src={selectedRssArticle.image_url} 
                  alt="Imagen del artículo RSS" 
                  className="max-w-full max-h-32 object-cover rounded border" 
                />
                <p className="text-xs text-blue-600 mt-1">
                  ✅ Esta imagen se usará automáticamente en el artículo reescrito
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-blue-700 mb-2">Imagen del Artículo (opcional):</label>
          <input
            ref={rssFileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setRssImageFile(e.target.files?.[0] || null)}
            className="w-full p-2 border border-blue-300 rounded"
          />
          <p className="text-xs text-gray-500 mt-1">Puedes subir una imagen desde tu dispositivo o tomar una foto con la cámara.</p>
        </div>

        {rssImageFile && (
          <div className="mb-4">
            <img 
              src={URL.createObjectURL(rssImageFile)} 
              alt="Preview" 
              className="max-w-full max-h-48 object-cover rounded border" 
            />
            <p className="text-xs text-gray-500 mt-1">
              Tamaño original: {(rssImageFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <p className="text-xs text-blue-600">
              La imagen será comprimida automáticamente antes de subir (máx. 1MB, 1920px)
            </p>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-blue-700 mb-2">Enlace URL (opcional):</label>
          <input
            type="url"
            value={rssUrl}
            onChange={(e) => setRssUrl(e.target.value)}
            placeholder="https://ejemplo.com/articulo"
            className="w-full p-2 border border-blue-300 rounded"
          />
          <p className="text-xs text-gray-500 mt-1">Enlace externo relacionado con el artículo (fuente adicional, referencia, etc.)</p>
        </div>

        <button
          onClick={handleRewriteRssArticle}
          disabled={!selectedRssArticle || rewriting}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {rewriting ? 'Reescribiendo...' : 'Reescribir con IA'}
        </button>
      </div>

      {/* Nueva sección: Gestionar artículos generados por IA */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-green-800 mb-3">Gestionar Artículos Generados por IA</h3>
        
        <div className="mb-4">
          <button
            onClick={loadAiArticles}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mb-4"
          >
            Cargar Artículos de IA
          </button>
        </div>

        {aiArticles.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-green-700 mb-2">Seleccionar Artículo para Editar:</label>
            <select
              value={selectedAiArticle?.id || ''}
              onChange={(e) => {
                const article = aiArticles.find(a => a.id === e.target.value);
                if (article) {
                  handleEditAiArticle(article);
                }
              }}
              className="w-full p-2 border border-green-300 rounded"
            >
              <option value="">-- Seleccionar artículo --</option>
              {aiArticles.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.title} - {new Date(article.published_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        )}

        {aiArticles.length === 0 && (
          <p className="text-sm text-gray-600">No hay artículos generados por IA. Crea uno primero.</p>
        )}
      </div>

      {article && (
        <div className="mt-6 border p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">
            {editing ? 'Editando Artículo Generado por IA' : 'Artículo Generado'}
          </h3>
          
          {editing && selectedAiArticle && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Editando:</strong> {selectedAiArticle.title}
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                Creado: {new Date(selectedAiArticle.published_at).toLocaleString()}
              </p>
            </div>
          )}
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Título del Artículo:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Ingresa el título..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Categoría:</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="Nacionales">Nacionales</option>
              <option value="Regionales">Regionales</option>
              <option value="Internacionales">Internacionales</option>
              <option value="Economía">Economía</option>
              <option value="Deportes">Deportes</option>
              <option value="Espectaculos">Espectaculos</option>
              <option value="Policiales">Policiales</option>
              <option value="Clasificados">Clasificados</option>
              
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Reseña o Volanta:</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Ingresa una reseña breve o volanta..."
              rows={3}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Pie de Foto (opcional):</label>
            <input
              type="text"
              value={imageCaption}
              onChange={(e) => setImageCaption(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Descripción de la imagen..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Imagen del Artículo:</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="w-full p-2 border rounded"
            />
            <p className="text-xs text-gray-500 mt-1">Puedes subir una imagen desde tu dispositivo o tomar una foto con la cámara.</p>
          </div>

          {imageFile && (
            <div className="mb-4">
              <img 
                src={URL.createObjectURL(imageFile)} 
                alt="Preview" 
                className="max-w-full max-h-48 object-cover rounded border" 
              />
              <p className="text-xs text-gray-500 mt-1">
                Tamaño original: {(imageFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <p className="text-xs text-blue-600">
                La imagen será comprimida automáticamente antes de subir (máx. 1MB, 1920px)
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Contenido del Artículo:</label>
            <ReactQuill
              value={article}
              onChange={handleContentChange}
              className="bg-white border rounded"
              theme="snow"
            />
          </div>

          <button
            onClick={editing ? handleUpdateAiArticle : handlePublish}
            disabled={(editing ? updating : publishing) || !title}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 mr-2"
          >
            {editing ? (updating ? 'Actualizando...' : 'Actualizar Artículo') : (publishing ? 'Publicando...' : 'Publicar Artículo')}
          </button>

          {!editing && (
            <button
              onClick={handleSaveDraft}
              disabled={publishing || !title}
              className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:opacity-50 mr-2"
            >
              Guardar como Borrador
            </button>
          )}

          {editing && (
            <button
              onClick={handleCancelEdit}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Cancelar Edición
            </button>
          )}

          <div className="mt-4">
            <p>{article.replace(/<[^>]*>/g, '')}</p>
          </div>
        </div>
      )}

      <div className="mt-6 border p-4 rounded">
        <h3 className="text-xl font-semibold mb-2">Uso de Puter.js</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium">Mensaje para Chat:</label>
          <input
            type="text"
            value={puterPrompt}
            onChange={(e) => setPuterPrompt(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="w-full p-2 border rounded"
          />
        </div>
        <button
          onClick={handlePuterChat}
          disabled={puterLoading}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          {puterLoading ? 'Consultando...' : 'Enviar a Puter'}
        </button>
        {puterResponse && (
          <div className="mt-4 p-4 border rounded">
            <h4 className="font-semibold">Respuesta:</h4>
            <p>{puterResponse}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIManager;