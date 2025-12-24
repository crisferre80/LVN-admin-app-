const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY;
const PEXELS_BASE_URL = 'https://api.pexels.com/v1';

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  liked: boolean;
  alt: string;
}

export interface PexelsResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  next_page?: string;
}

/**
 * Función para buscar imágenes en Pexels usando Netlify Function
 */
export async function searchPexelsImages(query: string, perPage: number = 10): Promise<PexelsPhoto[]> {
  try {
    console.log('📸 Llamando a Netlify Function de Pexels:', { query, perPage });

    const params = new URLSearchParams({
      query,
      perPage: perPage.toString(),
    });

    const response = await fetch(`/.netlify/functions/pexels-api?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ Error en Netlify Function de Pexels:', errorData);
      throw new Error(`Error de Pexels: ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();

    if (data.success && data.data) {
      return data.data.photos || [];
    }

    console.warn('Respuesta de Pexels no contiene fotos válidas:', data);
    return [];
  } catch (error) {
    console.error('Error buscando imágenes en Pexels:', error);
    return [];
  }
}

export async function getRandomPexelsImage(query: string): Promise<PexelsPhoto | null> {
  try {
    const photos = await searchPexelsImages(query, 20);
    if (photos.length === 0) {
      return null;
    }
    // Return a random photo from the results
    const randomIndex = Math.floor(Math.random() * photos.length);
    return photos[randomIndex];
  } catch (error) {
    console.error('Error getting random Pexels image:', error);
    return null;
  }
}

export function generateImageQuery(title: string, category: string, description?: string): string {
  // Generate a search query based on article title, description and category
  const baseQuery = title.toLowerCase().split(' ').slice(0, 3).join(' ');

  // Add description keywords if available
  let descriptionKeywords = '';
  if (description) {
    descriptionKeywords = description.toLowerCase().split(' ').slice(0, 2).join(' ');
  }

  // Add category-specific keywords
  const categoryKeywords: Record<string, string> = {
    'deportes': 'sports stadium athletes',
    'politica': 'government politics parliament',
    'economia': 'business finance money',
    'Espectaculos': 'art culture museum',
    'tecnologia': 'technology computer innovation',
    'salud': 'health medical doctor',
    'educacion': 'education school learning',
    'entretenimiento': 'entertainment movie music',
    'ciencia': 'science research laboratory',
    'medioambiente': 'environment nature ecology',
    'internacional': 'world international global',
    'regionales': 'city local community',
  };

  const categoryKey = category.toLowerCase();
  const categoryAddition = categoryKeywords[categoryKey] || 'news article';

  const queryParts = [baseQuery];
  if (descriptionKeywords) {
    queryParts.push(descriptionKeywords);
  }
  queryParts.push(categoryAddition);

  return queryParts.join(' ');
}