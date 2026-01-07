import React, { useState } from 'react';
import { searchGoogleImages } from '../lib/imageGeneration';

const GoogleImageSearchExample: React.FC = () => {
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const results = await searchGoogleImages(query, 8);
      setImages(results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Búsqueda de Imágenes de Google - Ejemplo</h2>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar imágenes..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {images.map((image, index) => (
          <div key={index} className="aspect-square overflow-hidden rounded-lg border">
            <img
              src={image.thumbnail}
              alt={image.title}
              className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
              onClick={() => window.open(image.link, '_blank')}
            />
          </div>
        ))}
      </div>

      {images.length === 0 && !loading && !error && (
        <p className="text-gray-500 text-center mt-8">
          Ingresa una consulta y haz clic en "Buscar" para ver imágenes
        </p>
      )}
    </div>
  );
};

export default GoogleImageSearchExample;