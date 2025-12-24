import { enforceGoogleAIRateLimit } from '../lib/googleAI';

// Modelo de Gemini a usar (versión estable más reciente)

export interface GeneratedImageMetadata {
  prompt: string;
  style: string;
  timestamp: number;
  provider: 'google-ai';
}

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  metadata?: GeneratedImageMetadata;
  error?: string;
  fallbackDescription?: string;
}

/**
 * Genera una descripción optimizada para búsqueda de imágenes usando Google Gemini
 */
export async function generateImageDescription(
  title: string,
  description: string,
  category: string,
  customPrompt?: string
): Promise<string> {
  // Aplicar rate limiting
  await enforceGoogleAIRateLimit();

  try {
    const response = await fetch('/.netlify/functions/google-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateImageDescription',
        data: { title, description, category, customPrompt },
        identifier: 'image-description-' + Date.now() // Identificador único para rate limiting
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error);
    }

    return result.description;
  } catch (error) {
    console.error('Error calling Google AI function:', error);
    throw new Error('Error generando descripción de imagen');
  }
}

/**
 * Genera múltiples variaciones de prompts de imagen para mayor diversidad
 */
export async function generateImageVariations(
  title: string,
  description: string,
  category: string,
  count: number = 3
): Promise<string[]> {
  // Aplicar rate limiting
  await enforceGoogleAIRateLimit();

  try {
    const response = await fetch('/.netlify/functions/google-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateImageVariations',
        data: { title, description, category, count },
        identifier: 'image-variations-' + Date.now()
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error);
    }

    return result.variations;
  } catch (error) {
    console.error('Error calling Google AI function:', error);
    throw new Error('Error generando variaciones de imagen');
  }
}

/**
 * Analiza una imagen y sugiere mejoras en su descripción
 */
export async function analyzeImageRelevance(
  imageDescription: string,
  articleTitle: string,
  articleContent: string
): Promise<{ score: number; suggestions: string[] }> {
  // Aplicar rate limiting
  await enforceGoogleAIRateLimit();

  try {
    const response = await fetch('/.netlify/functions/google-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'analyzeImageRelevance',
        data: { imageDescription, articleTitle, articleContent },
        identifier: 'image-analysis-' + Date.now()
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error);
    }

    return { score: result.score, suggestions: result.suggestions };
  } catch (error) {
    console.error('Error calling Google AI function:', error);
    throw new Error('Error analizando relevancia de imagen');
  }
}

/**
 * Genera un prompt optimizado para DALL-E basado en el contexto del artículo
 */
export async function generateDALLEPrompt(
  title: string,
  description: string,
  category: string,
  style: 'photorealistic' | 'illustration' | 'infographic' | 'artistic' = 'photorealistic'
): Promise<string> {
  // Aplicar rate limiting
  await enforceGoogleAIRateLimit();

  try {
    const response = await fetch('/.netlify/functions/google-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateDALLEPrompt',
        data: { title, description, category, style },
        identifier: 'dalle-prompt-' + Date.now()
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error);
    }

    return result.prompt;
  } catch (error) {
    console.error('Error calling Google AI function:', error);
    throw new Error('Error generando prompt para DALL-E');
  }
}

/**
 * Sugiere palabras clave para búsqueda en Pexels/Unsplash
 */
export async function generateSearchKeywords(
  title: string,
  description: string,
  category: string,
  language: 'es' | 'en' = 'es'
): Promise<string[]> {
  // Aplicar rate limiting
  await enforceGoogleAIRateLimit();

  try {
    const response = await fetch('/.netlify/functions/google-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateSearchKeywords',
        data: { title, description, category, language },
        identifier: 'search-keywords-' + Date.now()
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error);
    }

    return result.keywords;
  } catch (error) {
    console.error('Error calling Google AI function:', error);
    throw new Error('Error generando palabras clave');
  }
}

/**
 * Función principal que integra generación de descripción con búsqueda en Pexels
 */
export async function generateAndFindImage(
  title: string,
  description: string,
  category: string,
  customPrompt?: string
): Promise<ImageGenerationResult> {
  try {
    // Generar descripción optimizada con Google AI
    const imageDescription = await generateImageDescription(
      title,
      description,
      category,
      customPrompt
    );

    console.log('Descripción generada por Google AI:', imageDescription);

    // Generar palabras clave en español e inglés
    const keywordsES = await generateSearchKeywords(title, description, category, 'es');
    const keywordsEN = await generateSearchKeywords(title, description, category, 'en');

    console.log('Palabras clave ES:', keywordsES);
    console.log('Palabras clave EN:', keywordsEN);

    // Aquí se integraría con Pexels/Unsplash usando las palabras clave
    // Por ahora retornamos la descripción para uso manual o futuro

    return {
      success: true,
      fallbackDescription: imageDescription,
      metadata: {
        prompt: imageDescription,
        style: 'ai-generated-description',
        timestamp: Date.now(),
        provider: 'google-ai'
      }
    };
  } catch (error) {
    console.error('Error generando imagen con Google AI:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}
