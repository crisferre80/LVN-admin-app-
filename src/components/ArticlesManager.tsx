import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Share2,
  Facebook,
  Twitter,
  MessageCircle,
  Linkedin,
  Send,
  CalendarDays,
  Sparkles,
  Globe,
  Image as ImageIcon,
  MonitorSmartphone,
  Brain,
  Zap,
} from 'lucide-react';
import { supabase, Article } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import toast from 'react-hot-toast';
import { AudioPlayer } from './AudioPlayer';
import { articlesCache } from '../lib/articlesCache';

const decodeHtmlEntities = (text: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

type ExtendedArticle = Article & {
  status?: string;
  source_rss_id?: string;
  gallery_urls?: string[];
  gallery_template?: 'list' | 'grid-2' | 'grid-3';
  audio_url?: string;
};

const isPublished = (article: ExtendedArticle) =>
  article.author === 'IA' ? article.status === 'published' : Boolean(article.published_at && article.published_at !== '1970-01-01T00:00:00.000Z' && article.published_at !== '1970-01-01T00:00:00+00:00');

const statusBadgeClasses = (article: ExtendedArticle) =>
  isPublished(article)
    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    : 'bg-amber-100 text-amber-700 border border-amber-200';

const getArticleTypeLabel = (article: ExtendedArticle) => (article.author === 'IA' ? 'Propio' : 'RSS');

const typeBadgeClasses = (article: ExtendedArticle) =>
  article.author === 'IA'
    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
    : 'bg-slate-100 text-slate-600 border border-slate-200';

const isLocalNews = (article: ExtendedArticle) => article.rss_source_id === 'local_news' || article.author?.startsWith('Local -');

const getTableName = (article: ExtendedArticle): 'articles' | 'ai_generated_articles' | 'local_news' => {
  if (article.author === 'IA') return 'ai_generated_articles';
  if (isLocalNews(article)) return 'local_news';
  return 'articles';
};

const formatSpanishDate = (value: string | null | undefined) => {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (error) {
    console.warn('No se pudo formatear la fecha', error);
    return 'Fecha desconocida';
  }
};

const shareOnFacebook = (article: ExtendedArticle) => {
  const url = encodeURIComponent(`${window.location.origin}/article/${article.id}`);
  const text = encodeURIComponent(`¡Mira este artículo! ${article.title}`);
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank');
};

const shareOnTwitter = (article: ExtendedArticle) => {
  const url = encodeURIComponent(`${window.location.origin}/article/${article.id}`);
  const text = encodeURIComponent(`${article.title} - ${article.description?.substring(0, 100)}...`);
  window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
};

const shareOnWhatsApp = (article: ExtendedArticle) => {
  const url = encodeURIComponent(`${window.location.origin}/article/${article.id}`);
  const text = encodeURIComponent(`¡Mira este artículo! ${article.title}\n\n${article.description?.substring(0, 100)}...\n\n${url}`);
  window.open(`https://wa.me/?text=${text}`, '_blank');
};

const shareOnLinkedIn = (article: ExtendedArticle) => {
  const url = encodeURIComponent(`${window.location.origin}/article/${article.id}`);
  const title = encodeURIComponent(article.title);
  const summary = encodeURIComponent(article.description?.substring(0, 200) || '');
  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}&summary=${summary}`, '_blank');
};

const shareOnTelegram = (article: ExtendedArticle) => {
  const url = encodeURIComponent(`${window.location.origin}/article/${article.id}`);
  const text = encodeURIComponent(`${article.title}\n\n${article.description?.substring(0, 100)}...\n\n${url}`);
  window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
};

const copyToClipboard = async (article: ExtendedArticle) => {
  const url = `${window.location.origin}/article/${article.id}`;
  try {
    await navigator.clipboard.writeText(url);
    alert('Enlace copiado al portapapeles');
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert('Enlace copiado al portapapeles');
  }
};

export function ArticlesManager({ onSectionChange }: { onSectionChange: (section: string) => void }) {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [articles, setArticles] = useState<ExtendedArticle[]>([]);
  const [aiArticles, setAiArticles] = useState<ExtendedArticle[]>([]);
  const [localNews, setLocalNews] = useState<ExtendedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRSS, setShowRSS] = useState(false);
  const [showLocalNews, setShowLocalNews] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const articlesPerPage = 30;
  const [shareMenuOpen, setShareMenuOpen] = useState<string | null>(null);
  const [recategorizing, setRecategorizing] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);

  // Detectar cuando la página pierde/gana visibilidad
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);
      console.log('[ArticlesManager] 👁️ Visibilidad de página:', visible ? 'visible' : 'oculta');
      
      // Si la página vuelve a ser visible, refrescar datos si es necesario
      if (visible && articles.length === 0) {
        console.log('[ArticlesManager] 🔄 Refrescando datos al volver a la página');
        loadArticles();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [articles.length]);

  const handleEditWithAI = (article: ExtendedArticle) => {
    onSectionChange('editor', { editId: article.id, isRewrite: true });
  };

  const handleEditArticle = (article: ExtendedArticle) => {
    onSectionChange('editor');
    // Usar search params para pasar el ID
    const url = new URL(window.location.href);
    url.searchParams.set('edit', article.id);
    window.history.replaceState({}, '', url.toString());
  };

  const handleToggleFeatured = async (article: ExtendedArticle) => {
    try {
      const tableName = article.author === 'IA' ? 'ai_generated_articles' : 'articles';
      const currentFeatured = (article as any).is_featured || false;
      const newFeatured = !currentFeatured;

      const { error } = await supabase
        .from(tableName)
        .update({ is_featured: newFeatured })
        .eq('id', article.id);

      if (error) throw error;

      // Update local state
      if (article.author === 'IA') {
        setAiArticles(prev => prev.map(a =>
          a.id === article.id ? { ...a, is_featured: newFeatured } : a
        ));
      } else {
        setArticles(prev => prev.map(a =>
          a.id === article.id ? { ...a, is_featured: newFeatured } : a
        ));
      }

      toast.success(newFeatured ? 'Artículo marcado como destacado' : 'Artículo removido de destacados');
    } catch (error: any) {
      console.error('Error al cambiar estado destacado:', error);
      toast.error('Error al cambiar estado destacado');
    }
  };

  const handleCreateArticle = () => {
    onSectionChange('editor', { isNew: true });
  };

  const handleBulkGenerator = () => {
    navigate('/admin/bulk-generator');
  };

  const toggleShareMenu = (id: string) => {
    setShareMenuOpen((current) => (current === id ? null : id));
  };

  const loadArticles = useCallback(async (controller?: AbortController) => {
    // Si la página no es visible, no cargar datos
    if (!isPageVisible) {
      console.log('[ArticlesManager] 💤 Página no visible, omitiendo carga de datos');
      return;
    }

    const activeController = controller || new AbortController();
    const timeoutId = setTimeout(() => activeController.abort(), 15000); // 15 segundos timeout

    try {
      console.log('🔄 Cargando artículos...');
      const { data: regularArticles, error: regularError } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false })
        .abortSignal(activeController.signal);

      if (regularError) throw regularError;

      const { data: aiGeneratedArticles, error: aiError } = await supabase
        .from('ai_generated_articles')
        .select('*')
        .order('created_at', { ascending: false })
        .abortSignal(activeController.signal);

      if (aiError) {
        console.warn('Tabla ai_generated_articles no encontrada, usando solo artículos regulares:', aiError);
      }

      // Cargar noticias locales
      const { data: localNewsData, error: localNewsError } = await supabase
        .from('local_news')
        .select('*')
        .order('published_at', { ascending: false })
        .abortSignal(activeController.signal);

      if (localNewsError) {
        console.warn('Tabla local_news no encontrada:', localNewsError);
      }

      // Mark AI articles
      const aiArticlesWithFlag = (aiGeneratedArticles || []).map(article => ({
        ...article,
        author: article.author || 'IA', // Usar el autor real si existe, sino 'IA'
        description: article.summary || '',
        rss_source_id: article.source_rss_id,
        published_at: article.status === 'published' ? article.created_at : null,
        status: article.status
      }));

      console.log('📊 Artículos AI cargados:', aiArticlesWithFlag.length);
      console.log('🎵 Artículos AI con audio:', aiArticlesWithFlag.filter(a => a.audio_url).length);
      aiArticlesWithFlag.filter(a => a.audio_url).forEach(a => console.log('  -', a.title, ':', a.audio_url));

      // Formatear noticias locales para que coincidan con la estructura de artículos
      const localNewsWithFlag = (localNewsData || []).map(news => ({
        ...news,
        id: news.id,
        title: news.title,
        description: news.summary || news.content?.substring(0, 200) || '',
        content: news.content,
        image_url: news.image_url,
        url: news.url,
        author: `Local - ${news.source}`,
        published_at: news.published_at || news.created_at,
        created_at: news.created_at,
        category: news.category || 'Regionales',
        rss_source_id: 'local_news',
      }));

      setArticles(regularArticles || []);
      setAiArticles(aiArticlesWithFlag);
      setLocalNews(localNewsWithFlag);

      console.log('✅ Artículos cargados exitosamente');
      setRetryCount(0); // Resetear contador de reintentos en éxito
      
      // Invalidar caché cuando se cargan nuevos datos
      articlesCache.invalidateAll();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('❌ Carga de artículos cancelada por timeout o desmontaje del componente');
        return; // No mostrar error si fue cancelado intencionalmente
      } else {
        console.error('❌ Error loading articles:', error);
        toast.error('Error al cargar los artículos. Reintentando...');
      }

      // Reintentar después de un breve delay solo si no fue cancelado
      if (error.name !== 'AbortError') {
        setRetryCount(prev => prev + 1);
        if (retryCount < 3) { // Máximo 3 reintentos
          setTimeout(() => {
            loadArticles();
          }, 2000);
          return; // No ejecutar finally para mantener loading = true durante el reintento
        } else {
          console.error('❌ Máximo número de reintentos alcanzado');
          toast.error('No se pudieron cargar los artículos después de varios intentos.');
        }
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [retryCount, isPageVisible]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadData = async () => {
      if (!isMounted) return;
      await loadArticles(controller);
    };

    loadData();

    // Cleanup function
    return () => {
      isMounted = false;
      controller.abort(); // Cancelar cualquier petición en curso

      // Timeout de seguridad: si después de 10 segundos aún está cargando, forzar a false
      setTimeout(() => {
        setLoading(false);
      }, 10000);
    };
  }, []);

  // Suscripción en tiempo real para local_news
  useEffect(() => {
    const channel = supabase
      .channel('local_news_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'local_news' },
        (payload) => {
          console.log('Local news table changed:', payload);
          // Recargar artículos cuando hay cambios en local_news
          loadArticles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [showRSS, showLocalNews, searchTerm]);

  const refreshArticles = async () => {
    const loadingToast = toast.loading('Renovando artículos desde fuentes RSS...');

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('process_rss');

      if (error) {
        console.error('Error renovando artículos:', error);
        toast.error('Error al renovar artículos: ' + error.message, { id: loadingToast });
      } else {
        console.log('Artículos renovados:', data);
        toast.success('Artículos renovados exitosamente', { id: loadingToast });
        // Recargar la lista de artículos
        loadArticles();
      }
    } catch (error) {
      console.error('Error inesperado:', error);
      toast.error('Error inesperado al renovar artículos', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  const refreshLocalNews = async () => {
    const loadingToast = toast.loading('Iniciando renovación de noticias locales...');

    try {
      setLoading(true);
      let totalInserted = 0;
      let hasMore = true;
      let currentSource = 0;
      const totalSources = 2; // Diario Panorama + Info del Estero

      // Procesar fuente por fuente para evitar timeout
      while (hasMore && currentSource < totalSources) {
        toast.loading(`Procesando fuente ${currentSource + 1}/${totalSources}...`, { id: loadingToast });
        
        const { data, error } = await supabase.functions.invoke('process_local_rss', {
          body: { 
            batch: true,
            source: currentSource,
            max: 10
          }
        });

        if (error) {
          console.error(`Error procesando fuente ${currentSource}:`, error);
          toast.error(`Error en fuente ${currentSource + 1}: ${error.message}`, { id: loadingToast });
          break;
        }

        console.log(`Fuente ${currentSource} procesada:`, data);
        totalInserted += data.total_news_inserted || 0;
        hasMore = data.has_more || false;
        currentSource++;

        // Delay de 2 segundos entre fuentes para evitar sobrecarga
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (totalInserted > 0) {
        toast.success(`✅ ${totalInserted} noticias locales renovadas de ${currentSource} fuentes`, { id: loadingToast });
        // Recargar la lista de artículos
        loadArticles();
      } else {
        toast.success('Renovación completada, no hay noticias nuevas', { id: loadingToast });
      }
    } catch (error) {
      console.error('Error inesperado:', error);
      toast.error('Error inesperado al renovar noticias locales', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  const recategorizeRSSArticles = async () => {
    if (recategorizing) return;

    setRecategorizing(true);
    const loadingToast = toast.loading('Recategorizando artículos RSS...');
    try {
      // Obtener solo artículos RSS (no generados por IA)
      const { data: rssArticles, error } = await supabase
        .from('articles')
        .select('id, title, description, category')
        .neq('author', 'IA'); // Excluir artículos generados por IA

      if (error) throw error;

      if (!rssArticles || rssArticles.length === 0) {
        toast.error('No se encontraron artículos RSS para recategorizar.', { id: loadingToast });
        return;
      }

      toast.loading(`Recategorizando ${rssArticles.length} artículos RSS...`, { id: loadingToast });

      let processedCount = 0;
      let updatedCount = 0;
      const categories = ['Nacionales', 'Regionales', 'Internacionales', 'Economía', 'Deportes', 'Espectáculos', 'Agro', 'Turismo', 'Política', 'Misceláneas', 'Medio Ambiente', 'Opinión'];

      for (const article of rssArticles) {
        try {
          const prompt = `Analiza el siguiente artículo y determina la categoría más apropiada de entre estas opciones: ${categories.join(', ')}.

Título: "${article.title}"
Descripción: "${article.description || 'Sin descripción'}"

Responde SOLO con el nombre de la categoría más apropiada, sin explicaciones adicionales.`;

          let newCategory = article.category; // Default to current category
          let usedProvider = '';

          // Try Google AI first
          if (googleApiKey) {
            try {
              usedProvider = 'Google AI';
              const aiPrompt = `Eres un experto periodista que clasifica artículos en categorías apropiadas. Responde solo con el nombre de la categoría.

${prompt}`;

              const response = await fetch('/.netlify/functions/google-ai', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  action: 'generateContent',
                  data: { prompt: aiPrompt, modelName: 'gemini-1.5-flash-latest' },
                  identifier: 'article-categorization-' + Date.now()
                }),
              });

              if (response.ok) {
                const result = await response.json();
                const aiResponse = result.content?.trim();
                if (aiResponse && categories.includes(aiResponse)) {
                  newCategory = aiResponse;
                }
              } else if (response.status === 429) {
                console.warn('Cuota de Google AI excedida para categorización');
              }
            } catch (googleError: any) {
              console.warn('Google AI failed for categorization:', googleError?.message);
              if (googleError?.message?.includes('quota') || googleError?.message?.includes('429')) {
                console.warn('Cuota de Google AI excedida');
              }
            }
          }

          // Try OpenRouter as final fallback
          if (!newCategory || newCategory === article.category) {
            if (openrouterApiKey) {
              try {
                usedProvider = 'OpenRouter';
                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${openrouterApiKey}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Diario Santiago',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'openai/gpt-4o-mini',
                    messages: [
                      {
                        role: 'system',
                        content: 'Eres un experto periodista que clasifica artículos en categorías apropiadas. Responde solo con el nombre de la categoría.'
                      },
                      {
                        role: 'user',
                        content: prompt
                      }
                    ],
                    max_tokens: 50,
                    temperature: 0.3,
                  }),
                });

                if (response.ok) {
                  const data = await response.json();
                  const aiResponse = data.choices[0]?.message?.content?.trim();
                  if (aiResponse && categories.includes(aiResponse)) {
                    newCategory = aiResponse;
                  }
                }
              } catch (openrouterError) {
                console.warn('OpenRouter failed for categorization:', openrouterError);
              }
            }
          }

          // Update category if it changed
          if (newCategory !== article.category) {
            const { error: updateError } = await supabase
              .from('articles')
              .update({ category: newCategory })
              .eq('id', article.id);

            if (!updateError) {
              updatedCount++;
              console.log(`Artículo "${article.title}" recategorizado: ${article.category} → ${newCategory} (${usedProvider})`);
            } else {
              console.error(`Error updating category for article ${article.id}:`, updateError);
            }
          }

          processedCount++;

          // Small delay to avoid rate limits (aumentado a 1 segundo)
          if (processedCount < rssArticles.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (articleError) {
          console.error(`Error processing article ${article.id}:`, articleError);
          processedCount++;
        }
      }

      // Reload articles to show updated categories
      loadArticles();

      toast.success(`Recategorización completada. Procesados: ${processedCount}, Actualizados: ${updatedCount}`, { id: loadingToast });

    } catch (error) {
      console.error('Error en recategorización:', error);
      toast.error('Error al recategorizar artículos: ' + (error instanceof Error ? error.message : 'Error desconocido'), { id: loadingToast });
    } finally {
      setRecategorizing(false);
    }
  };

  const deleteArticle = async (id: string, article: ExtendedArticle) => {
    // Verificar autenticación
    if (!user || !session) {
      toast.error('Debes estar autenticado para eliminar artículos');
      console.error('❌ No hay sesión activa');
      return;
    }

    if (!confirm('¿Estás seguro de que quieres eliminar este artículo?')) return;

    console.log('🗑️ deleteArticle called:', { 
      id, 
      articleType: article.author, 
      tableName: getTableName(article),
      userId: user.id,
      userEmail: user.email
    });

    const loadingToast = toast.loading('Eliminando artículo...');

    try {
      const tableName = getTableName(article);
      console.log('💾 Deleting from table:', tableName);

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Delete error:', error);
        
        // Manejo específico de errores
        if (error.code === 'PGRST301') {
          toast.error('Error de permisos: No tienes autorización para eliminar este artículo', { id: loadingToast });
        } else if (error.code === '42501') {
          toast.error('Acceso denegado: Verifica que estés autenticado correctamente', { id: loadingToast });
        } else if (error.message?.includes('JWT')) {
          toast.error('Sesión expirada. Por favor, vuelve a iniciar sesión', { id: loadingToast });
          // Refrescar sesión
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('Error refrescando sesión:', refreshError);
          }
        } else {
          toast.error(`Error al eliminar: ${error.message}`, { id: loadingToast });
        }
        
        throw error;
      }

      console.log('✅ Article deleted successfully');
      toast.success('Artículo eliminado exitosamente', { id: loadingToast });
      loadArticles(); // Recargar para mostrar cambios
    } catch (error: any) {
      console.error('❌ Error deleting article:', error);
      // El error ya fue manejado arriba, no mostrar toast duplicado
      if (!error.code && !error.message) {
        toast.error('Error al eliminar el artículo', { id: loadingToast });
      }
    }
  };

  const convertToAI = async (article: ExtendedArticle) => {
    if (article.author === 'IA') {
      alert('Este artículo ya es propio');
      return;
    }

    const articleType = isLocalNews(article) ? 'noticia local' : 'artículo RSS';
    if (!confirm(`¿Convertir este ${articleType} en artículo propio? Aparecerá en la sección de artículos generados por IA.`)) return;

    const loadingToast = toast.loading('Convirtiendo artículo...');

    try {
      // Mapear campos del artículo RSS/Local al formato AI
      const aiArticleData = {
        title: article.title,
        content: article.content || article.description || '',
        category: article.category,
        image_url: article.image_url,
        source_rss_id: article.rss_source_id || article.source_rss_id || null,
        status: 'published', // Los artículos RSS/locales suelen estar publicados
        summary: article.description || '',
        gallery_urls: article.gallery_urls || [],
        gallery_template: (article.gallery_template as 'list' | 'grid-2' | 'grid-3') || 'list',
        created_at: article.created_at,
        published_at: article.published_at || article.created_at,
      };

      console.log('Convirtiendo artículo a AI:', aiArticleData);

      // Insertar en tabla ai_generated_articles
      const { data: newArticle, error: insertError } = await supabase
        .from('ai_generated_articles')
        .insert([aiArticleData])
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Eliminar de la tabla original
      const originalTable = getTableName(article);
      const { error: deleteError } = await supabase
        .from(originalTable)
        .delete()
        .eq('id', article.id);

      if (deleteError) throw deleteError;

      console.log('Artículo convertido exitosamente. Nuevo ID:', newArticle?.id);
      toast.success('Artículo convertido a propio exitosamente', { id: loadingToast });

      // Recargar artículos para mostrar el cambio
      loadArticles();
    } catch (error) {
      console.error('Error convirtiendo artículo:', error);
      toast.error('Error al convertir el artículo', { id: loadingToast });
    }
  };

  const togglePublish = async (article: ExtendedArticle, isAI: boolean) => {
    // Verificar autenticación
    if (!user || !session) {
      toast.error('Debes estar autenticado para publicar/despublicar artículos');
      console.error('❌ No hay sesión activa');
      return;
    }

    console.log('🔄 togglePublish called:', { 
      articleId: article.id, 
      isAI, 
      currentStatus: article.status, 
      author: article.author,
      userId: user.id,
      userEmail: user.email
    });

    const isLocal = isLocalNews(article);

    // Determinar el nuevo estado antes del update optimista
    const currentIsPublished = isPublished(article);
    const newStatus = isAI
      ? (currentIsPublished ? 'draft' : 'published')
      : null;
    const newPublishedAt = !isAI
      ? (currentIsPublished
          ? '1970-01-01T00:00:00.000Z' // Fecha especial para indicar "no publicado"
          : new Date().toISOString())
      : null;

    console.log('📊 Toggle calculation:', {
      currentIsPublished,
      newStatus,
      newPublishedAt,
      tableName: getTableName(article)
    });

    // Optimistic update: actualizar el estado local inmediatamente
    const updateLocalState = () => {
      if (isAI) {
        setAiArticles(prev => prev.map(a =>
          a.id === article.id
            ? { ...a, status: newStatus ?? undefined }
            : a
        ));
      } else if (isLocal) {
        setLocalNews(prev => prev.map(a =>
          a.id === article.id
            ? {
                ...a,
                published_at: newPublishedAt as string
              }
            : a
        ));
      } else {
        setArticles(prev => prev.map(a =>
          a.id === article.id
            ? {
                ...a,
                published_at: newPublishedAt as string
              }
            : a
        ));
      }
    };

    // Aplicar el cambio optimista
    updateLocalState();

    try {
      const tableName = getTableName(article);
      const updateData = isAI
        ? { status: newStatus }
        : { published_at: newPublishedAt };

      console.log('💾 Updating database:', { tableName, articleId: article.id, updateData });

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', article.id);

      if (error) {
        console.error('❌ Database update error:', error);
        
        // Manejo específico de errores
        if (error.code === 'PGRST301') {
          toast.error('Error de permisos: No tienes autorización para modificar este artículo');
        } else if (error.code === '42501') {
          toast.error('Acceso denegado: Verifica que estés autenticado correctamente');
        } else if (error.message?.includes('JWT')) {
          toast.error('Sesión expirada. Por favor, vuelve a iniciar sesión');
          // Refrescar sesión
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('Error refrescando sesión:', refreshError);
          }
        } else {
          toast.error(`Error: ${error.message}`);
        }
        
        throw error;
      }

      console.log('✅ Database update successful');
      toast.success(`Artículo ${currentIsPublished ? 'despublicado' : 'publicado'} exitosamente`);

      // Recargar para asegurar consistencia con la base de datos
      loadArticles();
    } catch (error: any) {
      console.error('❌ Error toggling publish status:', error);
      // El error ya fue manejado arriba
      if (!error.code && !error.message) {
        toast.error('Error al cambiar el estado de publicación');
      }

      // Revertir el cambio optimista en caso de error
      updateLocalState(); // Llamar nuevamente para revertir
    }
  };

  const updateArticleCategory = async (article: ExtendedArticle, newCategory: string, isAI: boolean) => {
    const isLocal = isLocalNews(article);
    
    // Optimistic update: actualizar el estado local inmediatamente
    const updateLocalState = () => {
      if (isAI) {
        setAiArticles(prev => prev.map(a =>
          a.id === article.id
            ? { ...a, category: newCategory }
            : a
        ));
      } else if (isLocal) {
        setLocalNews(prev => prev.map(a =>
          a.id === article.id
            ? { ...a, category: newCategory }
            : a
        ));
      } else {
        setArticles(prev => prev.map(a =>
          a.id === article.id
            ? { ...a, category: newCategory }
            : a
        ));
      }
    };

    // Aplicar el cambio optimista
    updateLocalState();

    try {
      const tableName = getTableName(article);
      const { error } = await supabase
        .from(tableName)
        .update({ category: newCategory })
        .eq('id', article.id);

      if (error) throw error;

      toast.success('Categoría actualizada exitosamente');
      // Emitir evento para sincronizar UI en otras partes de la app (cards, detail, carrusel, etc.)
      try {
        const detail = { id: article.id, newCategory } as any;
        window.dispatchEvent(new CustomEvent('articleCategoryChanged', { detail }));
      } catch (e) {
        // ignore
      }
      // Evento legacy para compatibilidad con listeners existentes
      window.dispatchEvent(new CustomEvent('categoriesUpdated'));
      // No necesitamos recargar ya que hicimos optimistic update
    } catch (error) {
      console.error('Error updating article category:', error);
      toast.error('Error al cambiar la categoría del artículo');

      // Revertir el cambio optimista en caso de error
      updateLocalState(); // Llamar nuevamente para revertir
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-56 rounded-xl bg-slate-200" />
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-20 rounded-2xl bg-slate-200" />
          ))}
        </div>
        {retryCount > 0 && (
          <div className="text-center text-sm text-slate-500">
            Reintentando carga... ({retryCount}/3)
          </div>
        )}
      </div>
    );
  }

  const allArticles = showRSS ? articles : showLocalNews ? localNews : aiArticles;

  console.log('🎯 Mostrando artículos:', {
    showRSS,
    showLocalNews,
    totalArticles: allArticles.length,
    articlesWithAudio: allArticles.filter(a => a.audio_url).length
  });

  const filteredArticles = allArticles.filter((article) => {
    const matchesSearch =
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (article.description ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalPages = (showRSS || showLocalNews) ? Math.ceil(filteredArticles.length / articlesPerPage) : 1;
  const startIndex = (currentPage - 1) * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;
  const paginatedArticles = (showRSS || showLocalNews) ? filteredArticles.slice(startIndex, endIndex) : filteredArticles;

  const totalArticles = allArticles.length;
  const filteredCount = filteredArticles.length;
  const displayedCount = paginatedArticles.length;

  const emptyState = (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
      <Sparkles className="h-10 w-10 text-blue-400" />
      <p className="text-sm font-semibold text-slate-600">No encontramos artículos con esa búsqueda.</p>
      <p className="text-sm text-slate-400">Prueba con otro término o crea un nuevo artículo.</p>
      <button
        onClick={handleCreateArticle}
        className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Nuevo artículo
      </button>
    </div>
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Gestión de Artículos</h2>
          <p className="text-sm text-slate-500">
            {showRSS
              ? 'Controla artículos importados desde fuentes RSS con paginación optimizada.'
              : 'Organiza tus artículos propios y publícalos en minutos desde tu celular.'}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            onClick={handleBulkGenerator}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-purple-700 hover:to-pink-700"
          >
            <Zap className="h-4 w-4" />
            Generación múltiple
          </button>
          <button
            onClick={refreshArticles}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            Renovar RSS
          </button>
          <button
            onClick={recategorizeRSSArticles}
            disabled={recategorizing || loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-purple-200 bg-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Brain className="h-4 w-4" />
            {recategorizing ? 'Recategorizando…' : 'Recategorizar RSS'}
          </button>
          <button
            onClick={handleCreateArticle}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo artículo
          </button>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="w-full sm:max-w-sm">
            <label htmlFor="article-search" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Buscar artículos
            </label>
            <input
              id="article-search"
              type="search"
              placeholder="Título o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 shadow-inner sm:w-auto">
                <span className="inline-flex items-center gap-2">
                  <Globe className={`h-4 w-4 ${showRSS ? 'text-emerald-500' : 'text-slate-400'}`} />
                  RSS
                </span>
                <input
                  type="checkbox"
                  checked={showRSS}
                  onChange={(e) => {
                    setShowRSS(e.target.checked);
                    if (e.target.checked) setShowLocalNews(false);
                  }}
                  className="h-4 w-8 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
              <label className="inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 shadow-inner sm:w-auto">
                <span className="inline-flex items-center gap-2">
                  <Globe className={`h-4 w-4 ${showLocalNews ? 'text-blue-500' : 'text-slate-400'}`} />
                  Locales
                </span>
                <input
                  type="checkbox"
                  checked={showLocalNews}
                  onChange={(e) => {
                    setShowLocalNews(e.target.checked);
                    if (e.target.checked) setShowRSS(false);
                  }}
                  className="h-4 w-8 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>
            <p className="text-xs text-slate-500">
              {(showRSS || showLocalNews)
                ? `${startIndex + 1}-${Math.min(endIndex, filteredCount)} de ${filteredCount} artículos (página ${currentPage} de ${totalPages})`
                : `${filteredCount} de ${totalArticles} artículos`
              }
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="grid gap-4 md:hidden sm:grid-cols-2">
          {displayedCount === 0
            ? emptyState
            : paginatedArticles.map((article) => {
                const TypeIcon = article.author === 'IA' ? Sparkles : Globe;
                return (
                  <article
                    key={article.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="relative h-36 w-full overflow-hidden bg-slate-100 sm:h-40">
                      {article.image_url ? (
                        <img
                          src={article.image_url}
                          alt={article.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-slate-900/70 to-transparent px-3 pb-2 pt-5 text-[11px] text-white">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-2.5 py-1 font-medium backdrop-blur">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatSpanishDate(article.created_at)}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePublish(article, article.author === 'IA')}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur transition cursor-pointer hover:scale-105 active:scale-95 ${statusBadgeClasses(article)}`}
                          title={isPublished(article) ? 'Click para despublicar' : 'Click para publicar'}
                        >
                          {isPublished(article) ? 'Publicado' : 'Borrador'}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-3 px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span 
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${typeBadgeClasses(article)} ${article.author !== 'IA' ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''}`}
                          onClick={() => article.author !== 'IA' && convertToAI(article)}
                          title={article.author !== 'IA' ? 'Convertir a artículo propio' : ''}
                        >
                          <TypeIcon className="h-3.5 w-3.5" />
                          {getArticleTypeLabel(article)}
                        </span>
                        <select
                          value={article.category || 'Nacionales'}
                          onChange={(e) => updateArticleCategory(article, e.target.value, article.author === 'IA')}
                          className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
                        >
                          <option value="Nacionales">Nacionales</option>
                          <option value="Regionales">Regionales</option>
                          <option value="Internacionales">Internacionales</option>
                          <option value="Política">Política</option>
                          <option value="Policiales">Policiales</option>
                          <option value="Clasificados">Clasificados</option>
                          <option value="Economía">Economía</option>
                          <option value="Deportes">Deportes</option>
                          <option value="Espectáculos">Espectáculos</option>
                          <option value="Medio Ambiente">Medio Ambiente</option>
                          <option value="Opinión">Opinión</option>
                          <option value="Agro">Agro</option>
                          <option value="Tecnología">Tecnología</option>
                          <option value="Salud">Salud</option>
                          <option value="Cultura">Cultura</option>
                          <option value="Misceláneas">Misceláneas</option>
                          <option value="Cine">Cine</option>
                          <option value="Educación">Educación</option>
                          <option value="Turismo">Turismo</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">{article.title}</h3>
                        {article.description && (
                          <p className="line-clamp-3 text-xs text-slate-600">{decodeHtmlEntities(article.description)}</p>
                        )}
                        {article.audio_url && (
                          <div className="mt-2">
                            {console.log('🎵 Renderizando AudioPlayer para artículo:', article.title, 'audio_url:', article.audio_url)}
                            <AudioPlayer audioUrl={article.audio_url} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2">
                      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <MonitorSmartphone className="h-4 w-4" />
                          {article.author === 'IA' ? 'Artículo propio' : 'Desde RSS'}
                        </span>
                        <div className="flex items-center gap-2">
                          {article.author !== 'IA' && (
                            <button
                              onClick={() => handleEditWithAI(article)}
                              className="inline-flex items-center justify-center rounded-full border border-purple-200 p-1.5 text-purple-600 transition hover:border-purple-300 hover:bg-purple-50"
                              title="Editar con IA"
                            >
                              <Brain className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleFeatured(article)}
                            className={`inline-flex items-center justify-center rounded-full border p-1.5 transition ${
                              (article as any).is_featured
                                ? 'border-yellow-300 bg-yellow-50 text-yellow-600 hover:border-yellow-400'
                                : 'border-slate-200 text-slate-500 hover:border-yellow-300 hover:text-yellow-600'
                            }`}
                            title={(article as any).is_featured ? 'Remover de destacados' : 'Marcar como destacado'}
                          >
                            <svg className="h-4 w-4" fill={(article as any).is_featured ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEditArticle(article)}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 p-1.5 text-slate-500 transition hover:border-blue-300 hover:text-blue-600"
                            title="Editar artículo"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteArticle(article.id, article)}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 p-1.5 text-slate-500 transition hover:border-red-300 hover:text-red-600"
                            title="Eliminar artículo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="relative share-menu">
                            <button
                              onClick={() => toggleShareMenu(article.id)}
                              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-1.5 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                              title="Compartir"
                            >
                              <Share2 className="h-4 w-4" />
                            </button>
                            {shareMenuOpen === article.id && (
                              <div className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                                <div className="py-1">
                                  <button
                                    onClick={() => {
                                      shareOnFacebook(article);
                                      setShareMenuOpen(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                                  >
                                    <Facebook className="h-4 w-4 text-blue-600" />
                                    Facebook
                                  </button>
                                  <button
                                    onClick={() => {
                                      shareOnTwitter(article);
                                      setShareMenuOpen(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                                  >
                                    <Twitter className="h-4 w-4 text-sky-500" />
                                    Twitter
                                  </button>
                                  <button
                                    onClick={() => {
                                      shareOnWhatsApp(article);
                                      setShareMenuOpen(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                                  >
                                    <MessageCircle className="h-4 w-4 text-emerald-500" />
                                    WhatsApp
                                  </button>
                                  <button
                                    onClick={() => {
                                      shareOnLinkedIn(article);
                                      setShareMenuOpen(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                                  >
                                    <Linkedin className="h-4 w-4 text-blue-700" />
                                    LinkedIn
                                  </button>
                                  <button
                                    onClick={() => {
                                      shareOnTelegram(article);
                                      setShareMenuOpen(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                                  >
                                    <Send className="h-4 w-4 text-sky-500" />
                                    Telegram
                                  </button>
                                  <button
                                    onClick={() => {
                                      copyToClipboard(article);
                                      setShareMenuOpen(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                                  >
                                    <Share2 className="h-4 w-4 text-slate-500" />
                                    Copiar enlace
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
        </div>

        <div className="hidden md:block">
          {displayedCount === 0 ? (
            emptyState
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {paginatedArticles.map((article) => {
                const TypeIcon = article.author === 'IA' ? Sparkles : Globe;
                return (
                  <article
                    key={article.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                      {article.image_url ? (
                        <img
                          src={article.image_url}
                          alt={article.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-slate-900/70 to-transparent px-3 pb-2 pt-5 text-white">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium backdrop-blur">
                          <CalendarDays className="h-3 w-3" />
                          {formatSpanishDate(article.created_at)}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePublish(article, article.author === 'IA')}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold backdrop-blur transition ${statusBadgeClasses(article)}`}
                        >
                          {isPublished(article) ? 'Publicado' : 'Borrador'}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-3 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span 
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${typeBadgeClasses(article)} ${article.author !== 'IA' ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''}`}
                          onClick={() => article.author !== 'IA' && convertToAI(article)}
                          title={article.author !== 'IA' ? 'Convertir a artículo propio' : ''}
                        >
                          <TypeIcon className="h-3.5 w-3.5" />
                          {getArticleTypeLabel(article)}
                        </span>
                        <select
                          value={article.category || 'Nacionales'}
                          onChange={(e) => updateArticleCategory(article, e.target.value, article.author === 'IA')}
                          className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
                        >
                          <option value="Nacionales">Nacionales</option>
                          <option value="Regionales">Regionales</option>
                          <option value="Internacionales">Internacionales</option>
                          <option value="Política">Política</option>
                          <option value="Policiales">Policiales</option>
                          <option value="Clasificados">Clasificados</option>
                          <option value="Economía">Economía</option>
                          <option value="Deportes">Deportes</option>
                          <option value="Espectáculos">Espectáculos</option>
                          <option value="Medio Ambiente">Medio Ambiente</option>
                          <option value="Opinión">Opinión</option>
                          <option value="Agro">Agro</option>
                          <option value="Tecnología">Tecnología</option>
                          <option value="Salud">Salud</option>
                          <option value="Cultura">Cultura</option>
                          <option value="Misceláneas">Misceláneas</option>
                          <option value="Cine">Cine</option>
                          <option value="Educación">Educación</option>
                          <option value="Turismo">Turismo</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">{article.title}</h3>
                        {article.description && (
                          <p className="line-clamp-3 text-xs text-slate-600">{decodeHtmlEntities(article.description)}</p>
                        )}
                        {article.audio_url && (
                          <div className="mt-2">
                            {console.log('🎵 Renderizando AudioPlayer para artículo:', article.title, 'audio_url:', article.audio_url)}
                            <AudioPlayer audioUrl={article.audio_url} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <MonitorSmartphone className="h-4 w-4" />
                          {article.author === 'IA' ? 'Artículo propio' : 'Desde RSS'}
                        </span>
                        <div className="flex items-center gap-2">
                          {article.author !== 'IA' && (
                            <button
                              onClick={() => handleEditWithAI(article)}
                              className="inline-flex items-center justify-center rounded-full border border-purple-200 p-1.5 text-purple-600 transition hover:border-purple-300 hover:bg-purple-50"
                              title="Editar con IA"
                            >
                              <Brain className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleFeatured(article)}
                            className={`inline-flex items-center justify-center rounded-full border p-1.5 transition ${
                              (article as any).is_featured
                                ? 'border-yellow-300 bg-yellow-50 text-yellow-600 hover:border-yellow-400'
                                : 'border-slate-200 text-slate-500 hover:border-yellow-300 hover:text-yellow-600'
                            }`}
                            title={(article as any).is_featured ? 'Remover de destacados' : 'Marcar como destacado'}
                          >
                            <svg className="h-4 w-4" fill={(article as any).is_featured ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEditArticle(article)}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 p-1.5 text-slate-500 transition hover:border-blue-300 hover:text-blue-600"
                            title="Editar artículo"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteArticle(article.id, article)}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 p-1.5 text-slate-500 transition hover:border-red-300 hover:text-red-600"
                            title="Eliminar artículo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="relative share-menu">
                            <button
                              onClick={() => toggleShareMenu(article.id)}
                              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-1.5 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                              title="Compartir"
                            >
                              <Share2 className="h-4 w-4" />
                            </button>
                            {shareMenuOpen === article.id && (
                              <div className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                                <div className="py-1">
                                  <button
                                    onClick={() => {
                                      shareOnFacebook(article);
                                      setShareMenuOpen(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                                  >
                                    <Facebook className="h-4 w-4 text-blue-600" />
                                    Facebook
                                  </button>
                                  <button
                                    onClick={() => {
                                      shareOnTwitter(article);
                                      setShareMenuOpen(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                                  >
                                    <Twitter className="h-4 w-4 text-sky-500" />
                                    Twitter
                                  </button>
                                  <button
                                    onClick={() => {
                                      shareOnWhatsApp(article);
                                      setShareMenuOpen(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                                  >
                                    <MessageCircle className="h-4 w-4 text-emerald-500" />
                                    WhatsApp
                                  </button>
                                  <button
                                    onClick={() => {
                                      shareOnLinkedIn(article);
                                      setShareMenuOpen(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                                  >
                                    <Linkedin className="h-4 w-4 text-blue-700" />
                                    LinkedIn
                                  </button>
                                  <button
                                    onClick={() => {
                                      shareOnTelegram(article);
                                      setShareMenuOpen(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                                  >
                                    <Send className="h-4 w-4 text-sky-500" />
                                    Telegram
                                  </button>
                                  <button
                                    onClick={() => {
                                      copyToClipboard(article);
                                      setShareMenuOpen(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                                  >
                                    <Share2 className="h-4 w-4 text-slate-500" />
                                    Copiar enlace
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {(showRSS || showLocalNews) && totalPages > 1 && (
        <section className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-6 py-4">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`inline-flex items-center justify-center rounded-full border px-3 py-2 text-sm font-medium transition ${
                    currentPage === page
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            {totalPages > 5 && (
              <>
                <span className="text-slate-500">...</span>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className={`inline-flex items-center justify-center rounded-full border px-3 py-2 text-sm font-medium transition ${
                    currentPage === totalPages
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente
          </button>
        </section>
      )}
    </div>
  );
}
