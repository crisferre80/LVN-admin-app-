import { useState, useEffect, useCallback } from 'react';
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
  Image as ImageIcon,
  MonitorSmartphone,
  WifiOff,
} from 'lucide-react';
import { supabase, Article } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import toast from 'react-hot-toast';
import { AudioPlayer } from './AudioPlayer';
import { articlesCache } from '../lib/articlesCache';
import { testSupabaseConnection } from '../lib/supabaseTest';

const decodeHtmlEntities = (text: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

const formatError = (error: any) => {
  if (!error) return {
    message: 'Error desconocido',
    code: '',
    details: '',
    hint: '',
    statusCode: '',
    name: ''
  };

  try {
    return {
      message: error.message || 'Sin mensaje',
      code: error.code || 'Sin código',
      details: error.details || 'Sin detalles',
      hint: error.hint || 'Sin sugerencia',
      statusCode: error.statusCode || 'Sin código de estado',
      name: error.name || 'Sin nombre'
    };
  } catch (formatError) {
    return {
      message: 'Error al formatear el error original',
      code: '',
      details: '',
      hint: '',
      statusCode: '',
      name: ''
    };
  }
};

type ExtendedArticle = Article & {
  status?: string;
  source_rss_id?: string;
  gallery_urls?: string[];
  gallery_template?: 'list' | 'grid-2' | 'grid-3';
  audio_url?: string;
  is_featured?: boolean;
  _source?: 'own' | 'rss' | 'local';
};

const isPublished = (article: ExtendedArticle) =>
  article.author === 'IA' ? article.status === 'published' : Boolean(article.published_at && article.published_at !== '1970-01-01T00:00:00.000Z' && article.published_at !== '1970-01-01T00:00:00+00:00');

const statusBadgeClasses = (article: ExtendedArticle) =>
  isPublished(article)
    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    : 'bg-amber-100 text-amber-700 border border-amber-200';

const getArticleTypeLabel = (_article: ExtendedArticle) => 'Propio';

const typeBadgeClasses = (_article: ExtendedArticle) =>
  'bg-indigo-100 text-indigo-700 border border-indigo-200';

const getTableName = (article: ExtendedArticle): 'ai_generated_articles' | 'articles' | 'local_news' => {
  if (article._source === 'rss') return 'articles';
  if (article._source === 'local') return 'local_news';
  return 'ai_generated_articles';
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

export function ArticlesManager({ onSectionChange }: { onSectionChange: (section: string, params?: { editId?: string; isNew?: boolean; isRewrite?: boolean }) => void }) {
  const { user, session } = useAuth();
  const [aiArticles, setAiArticles] = useState<ExtendedArticle[]>([]);
  const [rssArticles, setRssArticles] = useState<ExtendedArticle[]>([]);
  const [localNewsArticles, setLocalNewsArticles] = useState<ExtendedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const articlesPerPage = 30;
  const [shareMenuOpen, setShareMenuOpen] = useState<string | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [activeArticleTab, setActiveArticleTab] = useState<'own' | 'rss' | 'local'>('own');

  // Detectar cuando la página pierde/gana visibilidad
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);
      console.log('[ArticlesManager] 👁️ Visibilidad de página:', visible ? 'visible' : 'oculta');
      
      // Si la página vuelve a ser visible, refrescar datos si es necesario
      if (visible && aiArticles.length === 0) {
        console.log('[ArticlesManager] 🔄 Refrescando datos al volver a la página');
        loadArticles();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [aiArticles.length]);

  const handleEditArticle = (article: ExtendedArticle) => {
    onSectionChange('editor', { editId: article.id });
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
      setAiArticles(prev => prev.map(a =>
        a.id === article.id ? { ...a, is_featured: newFeatured } : a
      ));

      toast.success(newFeatured ? 'Artículo marcado como destacado' : 'Artículo removido de destacados');
    } catch (error: any) {
      console.error('Error al cambiar estado destacado:', error);
      toast.error('Error al cambiar estado destacado');
    }
  };

  const handleCreateArticle = () => {
    onSectionChange('editor', { isNew: true });
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

    // Limpiar mensaje de error anterior
    setErrorMessage(null);

    const activeController = controller || new AbortController();
    const timeoutId = setTimeout(() => activeController.abort(), 15000); // 15 segundos timeout

    try {
      console.log('🔄 Cargando artículos de todas las fuentes...');
      
      // Cargar artículos propios (AI) - limitar a los más recientes para optimizar
      const { data: aiGeneratedArticles, error: aiError } = await supabase
        .from('ai_generated_articles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)  // Limitar a 100 artículos más recientes
        .abortSignal(activeController.signal);

      if (aiError) {
        const errorInfo = formatError(aiError);
        console.error('❌ Error cargando artículos AI:', errorInfo.message, `(Código: ${errorInfo.code})`);
        throw aiError;
      }
      console.log('✅ Artículos AI cargados:', aiGeneratedArticles?.length || 0);

      // Cargar artículos RSS - limitar a los más recientes para optimizar
      const { data: rssData, error: rssError } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)  // Limitar a 100 artículos más recientes
        .abortSignal(activeController.signal);

      if (rssError) {
        console.error('❌ Error cargando artículos RSS:', rssError.message);
      }
      console.log('✅ Artículos RSS cargados:', rssData?.length || 0);

      // Cargar artículos locales - limitar a los más recientes para optimizar
      const { data: localData, error: localError } = await supabase
        .from('local_news')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)  // Limitar a 100 artículos más recientes
        .abortSignal(activeController.signal);

      if (localError) {
        console.error('❌ Error cargando artículos locales:', localError.message);
      }
      console.log('✅ Artículos locales cargados:', localData?.length || 0);

      // Procesar artículos AI
      const aiArticlesWithFlag = (aiGeneratedArticles || []).map(article => ({
        ...article,
        author: article.author || 'IA',
        description: article.summary || '',
        published_at: article.status === 'published' ? article.created_at : null,
        status: article.status,
        _source: 'own' as const
      }));

      // Procesar artículos RSS
      const rssArticlesWithFlag = (rssData || []).map(article => ({
        ...article,
        description: article.description || article.summary || '',
        status: article.published_at ? 'published' : 'draft',
        _source: 'rss' as const
      }));

      // Procesar artículos locales
      const localArticlesWithFlag = (localData || []).map(article => ({
        ...article,
        description: article.summary || article.content?.substring(0, 200) || '',
        status: article.published_at ? 'published' : 'draft',
        _source: 'local' as const
      }));

      setAiArticles(aiArticlesWithFlag);
      setRssArticles(rssArticlesWithFlag);
      setLocalNewsArticles(localArticlesWithFlag);

      console.log('✅ Todos los artículos cargados exitosamente');
      console.log('📊 Totales:', {
        propios: aiArticlesWithFlag.length,
        rss: rssArticlesWithFlag.length,
        locales: localArticlesWithFlag.length
      });
      
      setRetryCount(0);
      setErrorMessage(null);
      
      articlesCache.invalidateAll();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('❌ Carga de artículos cancelada por timeout o desmontaje del componente');
        return; // No mostrar error si fue cancelado intencionalmente
      } else {
        // Mejorar el logging del error
        const errorDetails = formatError(error);

        console.error('❌ Error loading articles:', errorDetails.message, `(Código: ${errorDetails.code})`);
        console.error('❌ Error details:', errorDetails);

        const errorMsg = error?.message || 'Error desconocido al cargar artículos';
        setErrorMessage(errorMsg);

        // Solo mostrar toast si no es un error temporal que se resuelve automáticamente
        if (retryCount >= 2) {
          toast.error(`Error al cargar los artículos: ${errorMsg}`);
        } else {
          console.warn(`⚠️ Error temporal en carga de artículos (intento ${retryCount + 1}), reintentando automáticamente...`);
        }

        // Ejecutar diagnóstico de conexión solo en errores persistentes
        if (retryCount >= 2) {
          console.log('🔍 Ejecutando diagnóstico de conexión...');
          const diagnostic = await testSupabaseConnection();
          if (!diagnostic.success) {
            console.error('❌ Diagnóstico fallido:', diagnostic.error);
          }
        }
      }

      // Reintentar después de un breve delay solo si no fue cancelado
      if (error.name !== 'AbortError') {
        setRetryCount(prev => prev + 1);
        if (retryCount < 3) { // Máximo 3 reintentos
          console.log(`🔄 Reintentando carga de artículos... (intento ${retryCount + 1}/3)`);
          setTimeout(() => {
            loadArticles();
          }, 2000);
          return; // No ejecutar finally para mantener loading = true durante el reintento
        } else {
          console.error('❌ Máximo número de reintentos alcanzado');
          toast.error('No se pudieron cargar los artículos después de varios intentos.');
          setLoading(false); // Asegurar que loading se desactive
        }
      } else {
        console.log('ℹ️ Petición cancelada, probablemente por una nueva carga');
        setLoading(false); // Asegurar que loading se desactive en caso de cancelación
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const refreshRSSArticles = async () => {
    const loadingToast = toast.loading('Renovando artículos RSS...');

    try {
      // Llamar a la Edge Function para procesar RSS con límite reducido
      const { data, error } = await supabase.functions.invoke('process_rss', {
        body: { 
          action: 'refresh',
          limit: 10  // Reducido de 50 a 10 para optimizar egress
        }
      });

      if (error) {
        console.error('Error procesando RSS:', error);
        toast.error(`Error al renovar artículos RSS: ${error.message}`, { id: loadingToast });
        return;
      }

      console.log('RSS procesado:', data);
      
      // Recargar artículos después de procesar
      await loadArticles();
      
      toast.success(`Artículos RSS renovados exitosamente. ${data?.processed || 0} artículos procesados.`, { id: loadingToast });
    } catch (error: any) {
      console.error('Error inesperado:', error);
      toast.error('Error inesperado al renovar artículos RSS', { id: loadingToast });
    }
  };

  const refreshLocalArticles = async () => {
    const loadingToast = toast.loading('Renovando artículos locales...');

    try {
      // Llamar a la Edge Function para procesar noticias locales con límite reducido
      const { data, error } = await supabase.functions.invoke('process_local_rss', {
        body: { 
          batch: false,  // Cambiar a false para procesar menos artículos
          max: 5  // Reducido de 20 a 5 para optimizar egress
        }
      });

      if (error) {
        console.error('Error procesando noticias locales:', error);
        toast.error(`Error al renovar artículos locales: ${error.message}`, { id: loadingToast });
        return;
      }

      console.log('Noticias locales procesadas:', data);
      
      // Recargar artículos después de procesar
      await loadArticles();
      
      toast.success(`Artículos locales renovados exitosamente. ${data?.processed || 0} artículos procesados.`, { id: loadingToast });
    } catch (error: any) {
      console.error('Error inesperado:', error);
      toast.error('Error inesperado al renovar artículos locales', { id: loadingToast });
    }
  };

  const refreshArticles = async () => {
    // Llamar a la función correspondiente según el tab activo
    if (activeArticleTab === 'rss') {
      await refreshRSSArticles();
    } else if (activeArticleTab === 'local') {
      await refreshLocalArticles();
    } else {
      // Para artículos propios, solo recargar
      const loadingToast = toast.loading('Actualizando artículos...');
      try {
        await loadArticles();
        toast.success('Artículos actualizados exitosamente', { id: loadingToast });
      } catch (error) {
        console.error('Error inesperado:', error);
        toast.error('Error inesperado al actualizar artículos', { id: loadingToast });
      }
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

  const togglePublish = async (article: ExtendedArticle) => {
    // Verificar autenticación
    if (!user || !session) {
      toast.error('Debes estar autenticado para publicar/despublicar artículos');
      console.error('❌ No hay sesión activa');
      return;
    }

    console.log('🔄 togglePublish called:', { 
      articleId: article.id, 
      currentStatus: article.status, 
      userId: user.id,
      userEmail: user.email
    });

    // Determinar el nuevo estado
    const currentIsPublished = isPublished(article);
    const newStatus = currentIsPublished ? 'draft' : 'published';

    console.log('📊 Toggle calculation:', {
      currentIsPublished,
      newStatus,
      tableName: getTableName(article)
    });

    // Optimistic update: actualizar el estado local inmediatamente
    setAiArticles(prev => prev.map(a =>
      a.id === article.id
        ? { ...a, status: newStatus }
        : a
    ));

    try {
      const tableName = getTableName(article);
      const updateData = { status: newStatus };

      console.log('💾 Updating database:', { tableName, articleId: article.id, updateData });

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', article.id);

      if (error) {
        console.error('❌ Database update error:', error);
        
        // Revertir el cambio optimista en caso de error
        setAiArticles(prev => prev.map(a =>
          a.id === article.id
            ? { ...a, status: article.status }
            : a
        ));
        
        toast.error('Error al actualizar el estado del artículo');
        return;
      }

      console.log('✅ Article status updated successfully');
      toast.success(currentIsPublished ? 'Artículo movido a borradores' : 'Artículo publicado exitosamente');
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      
      // Revertir el cambio optimista
      setAiArticles(prev => prev.map(a =>
        a.id === article.id
          ? { ...a, status: article.status }
          : a
      ));
      
      toast.error('Error inesperado al actualizar el artículo');
    }
  };

  const updateArticleCategory = async (article: ExtendedArticle, newCategory: string) => {
    // Optimistic update: actualizar el estado local inmediatamente
    setAiArticles(prev => prev.map(a =>
      a.id === article.id
        ? { ...a, category: newCategory }
        : a
    ));

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
    } catch (error) {
      console.error('Error updating article category:', error);
      toast.error('Error al cambiar la categoría del artículo');

      // Revertir el cambio optimista en caso de error
      setAiArticles(prev => prev.map(a =>
        a.id === article.id
          ? { ...a, category: article.category }
          : a
      ));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="animate-spin text-blue-500">
            <RefreshCw className="h-12 w-12" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              {retryCount > 0 ? 'Reintentando conexión...' : 'Cargando artículos...'}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {retryCount > 0 
                ? `Intento ${retryCount} de 3. Por favor espera.` 
                : 'Por favor espera mientras obtenemos tus artículos.'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="text-slate-400">
            <WifiOff className="mx-auto h-12 w-12" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-700">No se pudieron cargar los artículos</h3>
            <p className="mt-2 text-sm text-slate-500">Verifica tu conexión a internet e intenta nuevamente.</p>
          </div>
          <button
            onClick={() => {
              setErrorMessage(null);
              setRetryCount(0);
              loadArticles();
            }}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Filtrar artículos según el tab activo
  let allArticles: ExtendedArticle[] = [];
  
  if (activeArticleTab === 'own') {
    allArticles = aiArticles;
  } else if (activeArticleTab === 'rss') {
    allArticles = rssArticles;
  } else if (activeArticleTab === 'local') {
    allArticles = localNewsArticles;
  }

  console.log('🎯 Mostrando artículos:', {
    tab: activeArticleTab,
    totalArticles: allArticles.length,
    articlesWithAudio: allArticles.filter(a => a.audio_url).length
  });

  const filteredArticles = allArticles.filter((article) => {
    const matchesSearch =
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (article.description ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredArticles.length / articlesPerPage);
  const startIndex = (currentPage - 1) * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;
  const paginatedArticles = filteredArticles.slice(startIndex, endIndex);

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
            Organiza tus artículos propios y publícalos en minutos desde tu celular.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            onClick={handleCreateArticle}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo artículo IA
          </button>
        </div>
      </header>

      {/* Tabs para tipos de artículos */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => {
              setActiveArticleTab('own');
              setCurrentPage(1);
            }}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition ${
              activeArticleTab === 'own'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Artículos Propios
          </button>
          <button
            onClick={() => {
              setActiveArticleTab('rss');
              setCurrentPage(1);
            }}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition ${
              activeArticleTab === 'rss'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Artículos RSS
          </button>
          <button
            onClick={() => {
              setActiveArticleTab('local');
              setCurrentPage(1);
            }}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition ${
              activeArticleTab === 'local'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Artículos Locales
          </button>
        </nav>
      </div>

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
            <button
              onClick={refreshArticles}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Renovar artículos
            </button>
            <p className="text-xs text-slate-500">
              {filteredCount} de {totalArticles} artículos
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="grid gap-4 md:hidden sm:grid-cols-2">
          {displayedCount === 0
            ? emptyState
            : paginatedArticles.map((article) => {
                const TypeIcon = Sparkles;
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
                          onClick={() => togglePublish(article)}
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
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${typeBadgeClasses(article)}`}
                        >
                          <TypeIcon className="h-3.5 w-3.5" />
                          {getArticleTypeLabel(article)}
                        </span>
                        <select
                          value={article.category || 'Nacionales'}
                          onChange={(e) => updateArticleCategory(article, e.target.value)}
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
                            <AudioPlayer audioUrl={article.audio_url} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2">
                      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <MonitorSmartphone className="h-4 w-4" />
                          {'Artículo propio'}
                        </span>
                        <div className="flex items-center gap-2">
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
                const TypeIcon = Sparkles;
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
                          onClick={() => togglePublish(article)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold backdrop-blur transition ${statusBadgeClasses(article)}`}
                        >
                          {isPublished(article) ? 'Publicado' : 'Borrador'}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-3 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span 
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${typeBadgeClasses(article)}`}
                        >
                          <TypeIcon className="h-3.5 w-3.5" />
                          {getArticleTypeLabel(article)}
                        </span>
                        <select
                          value={article.category || 'Nacionales'}
                          onChange={(e) => updateArticleCategory(article, e.target.value)}
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
                            <AudioPlayer audioUrl={article.audio_url} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <MonitorSmartphone className="h-4 w-4" />
                          {'Artículo propio'}
                        </span>
                        <div className="flex items-center gap-2">
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

      {totalPages > 1 && (
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
