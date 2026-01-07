/*
 * Ejemplo: Cómo usar la búsqueda de imágenes de Google en tu aplicación
 *
 * Este archivo muestra cómo integrar la funcionalidad de búsqueda de imágenes de Google
 * en componentes de React.
 */

import { useState } from 'react';
import { searchGoogleImages } from '../lib/imageGeneration';

interface GoogleImageSearchProps {
  onImageSelect?: (imageUrl: string) => void;
}

export function GoogleImageSearch({ onImageSelect }: GoogleImageSearchProps) {
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<{ url: string; title: string; thumbnail: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const results = await searchGoogleImages(query, 10);
      setImages(results);
    } catch (error) {
      console.error('Error searching images:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    onImageSelect?.(imageUrl);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar imágenes en Google..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {images.map((image, index) => (
            <div
              key={index}
              className={`relative cursor-pointer border-2 rounded-lg overflow-hidden ${
                selectedImage === image.url ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleImageClick(image.url)}
            >
              <img
                src={image.thumbnail}
                alt={image.title}
                className="w-full h-32 object-cover"
                loading="lazy"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                {image.title}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedImage && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-800">
            ✅ Imagen seleccionada: <a href={selectedImage} target="_blank" rel="noopener noreferrer" className="underline">Ver imagen completa</a>
          </p>
        </div>
      )}
    </div>
  );
}

/*
 * USO EN TU COMPONENTE:
 *
 * import { GoogleImageSearch } from './components/GoogleImageSearch';
 *
 * function MiComponente() {
 *   const handleImageSelect = (imageUrl: string) => {
 *     console.log('Imagen seleccionada:', imageUrl);
 *     // Aquí puedes usar la URL de la imagen seleccionada
 *   };
 *
 *   return (
 *     <div>
 *       <h2>Buscar imágenes de Google</h2>
 *       <GoogleImageSearch onImageSelect={handleImageSelect} />
 *     </div>
 *   );
 * }
 */