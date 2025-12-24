/**
 * Librería para generar imágenes con DALL-E 3 vía Netlify Functions
 */

export interface DalleImageOptions {
  size?: '1024x1024' | '1024x1792' | '1792x1024';
  quality?: 'standard' | 'hd';
  style?: 'natural' | 'vivid';
}

export interface DalleImageResult {
  imageUrl: string;
  revisedPrompt: string;
}

/**
 * Genera una imagen usando DALL-E 3
 */
export async function generateImage(
  prompt: string,
  options: DalleImageOptions = {}
): Promise<DalleImageResult | null> {
  const {
    size = '1024x1024',
    quality = 'standard',
    style = 'natural'
  } = options;

  try {
    console.log('🎨 Generando imagen con DALL-E 3:', { size, quality, style });

    const configuredBaseUrl = (import.meta.env.VITE_NETLIFY_FUNCTIONS_URL || '').trim();
    const fallbackBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const normalizedBaseUrl = (configuredBaseUrl || fallbackBaseUrl).replace(/\/$/, '');
    const netlifyFunctionUrl = normalizedBaseUrl
      ? `${normalizedBaseUrl}/.netlify/functions/generate-image`
      : '/.netlify/functions/generate-image';

    const response = await fetch(netlifyFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        size,
        quality,
        style
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ Error generando imagen:', errorData);
      throw new Error(`Error de DALL-E: ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();

    if (!data?.imageUrl) {
      throw new Error('No se recibió URL de imagen');
    }

    console.log('✅ Imagen generada exitosamente');
    
    return {
      imageUrl: data.imageUrl,
      revisedPrompt: data.revisedPrompt
    };

  } catch (error: any) {
    console.error('❌ Error generando imagen con DALL-E:', error.message);
    throw error;
  }
}

/**
 * Genera un prompt optimizado para crear imágenes periodísticas
 */
export function createJournalisticImagePrompt(
  articleTitle: string,
  articleSummary: string,
  category: string
): string {
  return `Create a professional, realistic journalistic photograph for a news article. 
Article title: "${articleTitle}"
Summary: "${articleSummary}"
Category: ${category}

Style: Photojournalistic, high-quality news photography, professional composition, 
natural lighting, suitable for publication in a digital newspaper. 
The image should be informative and relevant to the article content.
Avoid text, logos, or watermarks in the image.`;
}

/**
 * Genera automáticamente una imagen para un artículo
 */
export async function generateArticleImage(
  articleTitle: string,
  articleSummary: string,
  category: string,
  options: DalleImageOptions & { customPrompt?: string } = {}
): Promise<DalleImageResult | null> {
  // Si hay un prompt personalizado, usarlo directamente
  const prompt = options.customPrompt || createJournalisticImagePrompt(articleTitle, articleSummary, category);
  return generateImage(prompt, options);
}
