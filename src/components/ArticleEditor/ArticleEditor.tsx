import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';

// Hook para debouncing
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface ArticleEditorState {
  id: string;
  isEditing: boolean;
  user: { id: string } | null;
  formData: {
    title: string;
    content: string;
    description: string;
    category: string;
    image_url: string;
    gallery_urls: string[];
  };
  isOnline: boolean;
  lastSaved: Date | null;
  saving: boolean;
  savingProgress: string;
}

const useArticleEditor = (id: string): ArticleEditorState => {
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    description: '',
    category: '',
    image_url: '',
    gallery_urls: [],
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const debouncedContent = useDebounce(formData.content, 1500); // 1.5 segundos de delay

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleAutoSave = useCallback(async () => {
    if (!isEditing || !user) return;

    // No guardamos si no hay contenido o título
    if (!formData.title && !formData.content) return;

    console.log('Iniciando autoguardado...');
    setSaving(true);
    setSavingProgress('Autoguardando borrador...');

    try {
      const { data, error } = await supabase
        .from('article_autosaves')
        .select('id')
        .eq('article_id', id)
        .single();

      const saveData = {
        article_id: id,
        user_id: user.id,
        content: formData.content,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        image_url: formData.image_url,
        // No guardamos la galería completa para no sobrecargar, quizás solo las URLs
        gallery_urls: formData.gallery_urls,
        last_saved_at: new Date().toISOString(),
      };

      if (error && error.code === 'PGRST116') { // No row found
        await supabase.from('article_autosaves').insert(saveData);
      } else if (data) {
        await supabase.from('article_autosaves').update(saveData).eq('id', data.id);
      } else if (error) {
        throw error;
      }
      
      setLastSaved(new Date());
      console.log('Autoguardado completado.');

    } catch (error) {
      console.error('Error en autoguardado:', error);
      toast.error('Error durante el autoguardado.');
    } finally {
      setSaving(false);
      setSavingProgress('');
    }
  }, [isEditing, id, user, formData]);


  // Efecto para el autoguardado
  useEffect(() => {
    if (isEditing && user) {
      const timer = setTimeout(() => {
        handleAutoSave();
      }, 30000); // Autoguarda cada 30 segundos de inactividad
      return () => clearTimeout(timer);
    }
  }, [debouncedContent, formData.title, formData.description, formData.category, formData.image_url, handleAutoSave, isEditing, user]);


  const loadArticle = useCallback(async () => {
    if (!id) {
      console.log('No se encontró el artículo.');
      return;
    }

    try {
      const { data } = await supabase
        .from('articles')
        .select('*')
        .eq('id', id)
        .single();

      if (data) {
        setFormData({
          title: data.title,
          content: data.content,
          description: data.description,
          category: data.category,
          image_url: data.image_url,
          gallery_urls: data.gallery_urls,
        });
        setIsEditing(true);
      } else {
        console.log('No se encontró el artículo.');
      }
    } catch (error) {
      console.error('Error al cargar el artículo:', error);
      toast.error('Error durante la carga del artículo.');
    }
  }, [id]);

  return {
    id,
    isEditing,
    user,
    formData,
    isOnline,
    lastSaved,
    saving,
    savingProgress,
  };
};

export default useArticleEditor;