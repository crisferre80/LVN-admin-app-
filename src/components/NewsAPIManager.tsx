import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface NewsAPIArticle {
  id: string;
  title: string;
  description: string;
  content?: string;
  image_url: string;
  published_at: string;
  url: string;
  author: string;
  category: string;
  status: string;
  source_name: string;
  source_country: string;
}

export const NewsAPIManager: React.FC = () => {
  const [articles, setArticles] = useState<NewsAPIArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<NewsAPIArticle | null>(null);
  const [editing, setEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Nacionales');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [author, setAuthor] = useState('');

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('news_api_articles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setArticles(data || []);
    } catch (err) {
      console.error('Error loading News API articles:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert('Error al cargar artículos: ' + message);
    }
  };

  const handleEditArticle = (article: NewsAPIArticle) => {
    setSelectedArticle(article);
    setTitle(article.title);
    setCategory(article.category);
    setDescription(article.description || '');
    setContent(article.content || '');
    setImageUrl(article.image_url || '');
    setAuthor(article.author || '');
    setEditing(true);
  };

  const handleUpdateArticle = async () => {
    if (!selectedArticle || !title) {
      alert('Completa todos los campos requeridos.');
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('news_api_articles')
        .update({
          title,
          category,
          description,
          content,
          image_url: imageUrl,
          author,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedArticle.id);

      if (error) throw error;

      alert('Artículo actualizado exitosamente!');
      await loadArticles();
      setSelectedArticle(null);
      setEditing(false);
      setTitle('');
      setCategory('Nacionales');
      setDescription('');
      setContent('');
      setImageUrl('');
      setAuthor('');
    } catch (err) {
      console.error('Error updating News API article:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert('Error al actualizar el artículo: ' + message);
    } finally {
      setUpdating(false);
    }
  };

  const handlePublishArticle = async (article: NewsAPIArticle) => {
    try {
      // Verificar si ya existe en articles
      const { data: existingArticle } = await supabase
        .from('articles')
        .select('id')
        .eq('url', article.url)
        .single();

      if (existingArticle) {
        alert('Este artículo ya ha sido publicado en el diario.');
        return;
      }

      // Insertar en articles
      const { error: insertError } = await supabase
        .from('articles')
        .insert({
          title: article.title,
          description: article.description,
          content: article.content,
          url: article.url,
          image_url: article.image_url,
          author: article.author,
          category: article.category,
          published_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      // Actualizar status en news_api_articles
      const { error: updateError } = await supabase
        .from('news_api_articles')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', article.id);

      if (updateError) throw updateError;

      alert('Artículo publicado exitosamente en el diario!');
      await loadArticles();
    } catch (err) {
      console.error('Error publishing News API article:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert('Error al publicar el artículo: ' + message);
    }
  };

  const handleUnpublishArticle = async (article: NewsAPIArticle) => {
    try {
      const { error } = await supabase
        .from('news_api_articles')
        .update({
          status: 'draft',
          updated_at: new Date().toISOString()
        })
        .eq('id', article.id);

      if (error) throw error;

      alert('Artículo movido a borrador!');
      await loadArticles();
    } catch (err) {
      console.error('Error unpublishing News API article:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert('Error al mover a borrador: ' + message);
    }
  };

  const handleCancelEdit = () => {
    setSelectedArticle(null);
    setEditing(false);
    setTitle('');
    setCategory('Nacionales');
    setDescription('');
    setContent('');
    setImageUrl('');
    setAuthor('');
  };

  return (
    <div className="p-4 md:p-6">
      <h2 className="text-xl md:text-2xl font-bold mb-4">Gestión de Artículos de News API</h2>

      <div className="mb-4 flex gap-2">
        <button
          onClick={loadArticles}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Recargar Artículos
        </button>
        <div className="text-sm text-gray-600 flex items-center">
          {articles.length > 0 ? (
            <span className="text-green-600">✓ {articles.length} artículos cargados</span>
          ) : (
            <span className="text-red-600">⚠ No hay artículos. Ejecuta insert_test_newsapi_articles.sql en Supabase</span>
          )}
        </div>
      </div>

      {articles.length > 0 && (
        <div className="space-y-4">
          {articles.map((article) => (
            <div key={article.id} className="border p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{article.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{article.description}</p>
                  <div className="text-xs text-gray-500 mt-2">
                    <p>Categoría: {article.category}</p>
                    <p>Fuente: {article.source_name} ({article.source_country})</p>
                    <p>Estado: <span className={article.status === 'published' ? 'text-green-600' : 'text-yellow-600'}>{article.status}</span></p>
                    <p>Creado: {new Date(article.published_at).toLocaleString()}</p>
                  </div>
                </div>
                {article.image_url && (
                  <img
                    src={article.image_url}
                    alt={article.title}
                    className="w-24 h-24 object-cover rounded ml-4"
                  />
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleEditArticle(article)}
                  className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 text-sm"
                >
                  Editar
                </button>
                {article.status === 'draft' ? (
                  <button
                    onClick={() => handlePublishArticle(article)}
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                  >
                    Publicar
                  </button>
                ) : (
                  <button
                    onClick={() => handleUnpublishArticle(article)}
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
                  >
                    Mover a Borrador
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {articles.length === 0 && (
        <p className="text-sm text-gray-600">No hay artículos de News API. Los artículos se cargan automáticamente desde la API.</p>
      )}

      {editing && selectedArticle && (
        <div className="mt-6 border p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Editando Artículo</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Título:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border rounded"
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
              
              <option value="Tecnologia">Tecnologia</option>
              <option value="Salud">Salud</option>
              <option value="Ciencia">Ciencia</option>
              <option value="Medio Ambiente">Medio Ambiente</option>
              <option value="Agro">Agro</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Descripción:</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border rounded"
              rows={3}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Contenido:</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-2 border rounded"
              rows={5}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">URL de Imagen:</label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Autor:</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>

          <button
            onClick={handleUpdateArticle}
            disabled={updating || !title}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 mr-2"
          >
            {updating ? 'Actualizando...' : 'Actualizar'}
          </button>

          <button
            onClick={handleCancelEdit}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
};

export default NewsAPIManager;