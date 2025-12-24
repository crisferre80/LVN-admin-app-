/*
 * Archivo: src/lib/imageGeneration.ts
 * Descripción: Funciones para generar imágenes usando diferentes proveedores de IA
 *
 * Proveedores soportados:
 * - Google Gemini (generación de imágenes)
 * - Banana (generación de imágenes)
 * - Pexels (búsqueda de imágenes)
 */

import { getRandomPexelsImage, generateImageQuery } from './pexels';
import { enforceGoogleAIRateLimit } from './googleAI';

export type ImageProvider = 'pexels' | 'gemini' | 'banana' | 'auto' | 'placeholder' | 'banana-force' | 'gemini-native';

export interface GeneratedImageResult {
  url: string;
  provider: ImageProvider;
  description?: string;
}

/**
 * Genera una imagen usando el proveedor especificado
 */
export async function generateImageWithProvider(
  title: string,
  description: string,
  category: string,
  provider: ImageProvider,
  customPrompt?: string
): Promise<GeneratedImageResult | null> {
  try {
    switch (provider) {
      case 'pexels':
        return await generateWithPexels(title, description, category, customPrompt);

      case 'gemini':
        return await generateWithGemini(title, description, category, customPrompt);

      case 'gemini-native':
        return await generateWithGeminiNative(title, description, category, customPrompt);

      case 'banana':
        return await generateWithBanana(title, description, category, customPrompt);

      case 'banana-force':
        console.log('Forzando uso de Banana AI (ignorando configuración)...');
        const forceBananaResult = await generateWithBanana(title, description, category, customPrompt);
        if (forceBananaResult) {
          return forceBananaResult;
        }
        // Si Banana falla, fallback a auto
        console.log('Banana falló, intentando auto fallback...');
        return await generateImageWithProvider(title, description, category, 'auto', customPrompt);

      case 'auto':
        // Intentar en orden: Gemini Native -> Gemini (búsqueda) -> Banana (si configurado correctamente) -> Pexels directo -> Placeholder
        console.log('Intentando generación automática de imágenes...');

        // Intentar Gemini Native primero (tecnología más avanzada)
        const geminiNativeResult = await generateWithGeminiNative(title, description, category, customPrompt);
        if (geminiNativeResult) {
          console.log('✅ Imagen generada con Gemini Native');
          return geminiNativeResult;
        }

        // Verificar si Banana está configurado
        // Nota: Las verificaciones de API keys se hacen server-side
        const bananaApiKey = import.meta.env.VITE_BANANA_API_KEY;

        if (bananaApiKey && bananaApiKey.trim() !== '') {
          console.log('Banana API configurado, intentando generación...');
          const bananaResult = await generateWithBanana(title, description, category, customPrompt);
          if (bananaResult) {
            console.log('✅ Imagen generada con Banana AI');
            return bananaResult;
          }
        }

        const geminiResult = await generateWithGemini(title, description, category, customPrompt);
        if (geminiResult) {
          console.log('✅ Imagen generada con Gemini (búsqueda)');
          return geminiResult;
        }

        const pexelsResult = await generateWithPexels(title, description, category, customPrompt);
        if (pexelsResult) {
          console.log('✅ Imagen obtenida de Pexels');
          return pexelsResult;
        }

        // Si todo falla, devolver una imagen placeholder genérica
        console.log('⚠️ Todas las opciones fallaron, usando imagen placeholder');
        return getPlaceholderImage(category);

      default:
        throw new Error(`Proveedor de imágenes no soportado: ${provider}`);
    }
  } catch (error) {
    console.error(`Error generando imagen con ${provider}:`, error);
    // En modo auto, si el proveedor específico falla, intentar fallback
    if (provider !== 'auto') {
      console.log(`Intentando fallback automático después del error con ${provider}`);
      return await generateImageWithProvider(title, description, category, 'auto', customPrompt);
    }
    return getPlaceholderImage(category);
  }
}

/**
 * Genera imagen usando Pexels (búsqueda)
 */
async function generateWithPexels(
  title: string,
  description: string,
  category: string,
  customQuery?: string
): Promise<GeneratedImageResult | null> {
  try {
    const searchQuery = customQuery || generateImageQuery(title, category, description);
    console.log('Buscando imagen en Pexels con consulta:', searchQuery);

    const photo = await getRandomPexelsImage(searchQuery);

    if (photo) {
      return {
        url: photo.src.large,
        provider: 'pexels',
        description: `Imagen de Pexels: ${photo.alt}`
      };
    }

    return null;
  } catch (error) {
    console.error('Error con Pexels:', error);
    return null;
  }
}

/**
 * Genera imagen usando Google Gemini (genera prompt optimizado y busca en Pexels)
 */
async function generateWithGemini(
  title: string,
  description: string,
  category: string,
  customPrompt?: string
): Promise<GeneratedImageResult | null> {
  try {
    // API key validation moved to server-side

    // Crear prompt para generar una descripción optimizada para búsqueda de imágenes
    const promptPrompt = customPrompt ||
      `Crea una descripción detallada en inglés para buscar una imagen profesional de alta calidad para un artículo de noticias.
      Título: "${title}"
      Categoría: "${category}"
      Descripción: "${description}"

      La descripción debe ser específica, visual y optimizada para búsqueda de imágenes. Incluye detalles sobre composición, estilo, colores y elementos visuales. Máximo 50 palabras.`;

    console.log('Generando prompt optimizado con Gemini:', promptPrompt);

    // Usar Netlify function para generar descripción
    try {
      const response = await fetch('/.netlify/functions/google-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generateImageDescription',
          data: { title, description, category, customPrompt: promptPrompt },
          identifier: 'image-gen-' + Date.now()
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      optimizedPrompt = result.description;
    } catch (error: any) {
      console.error('Error calling Google AI function:', error);
      throw error;
    }

    console.log('Prompt optimizado generado:', optimizedPrompt);

    // Intentar múltiples estrategias de búsqueda de imágenes
    let photo = null;

    // Estrategia 1: Buscar con el prompt optimizado
    try {
      photo = await getRandomPexelsImage(optimizedPrompt);
    } catch (error) {
      console.warn('Pexels falló con prompt optimizado:', error);
    }

    // Estrategia 2: Si falló, intentar con el título original
    if (!photo) {
      try {
        const fallbackQuery = generateImageQuery(title, category, description);
        console.log('Intentando búsqueda alternativa con:', fallbackQuery);
        photo = await getRandomPexelsImage(fallbackQuery);
      } catch (error) {
        console.warn('Pexels falló con búsqueda alternativa:', error);
      }
    }

    // Estrategia 3: Si todavía no hay imagen, devolver una imagen genérica de la categoría
    if (!photo) {
      try {
        const categoryQuery = `${category} news article professional`;
        console.log('Intentando búsqueda genérica con:', categoryQuery);
        photo = await getRandomPexelsImage(categoryQuery);
      } catch (error) {
        console.warn('Pexels falló con búsqueda genérica:', error);
      }
    }

    if (photo) {
      return {
        url: photo.src.large,
        provider: 'gemini',
        description: `Prompt optimizado con Gemini: ${optimizedPrompt}`
      };
    }

    return null;
  } catch (error) {
    console.error('Error generando imagen con Gemini:', error);
    return null;
  }
}

/**
 * Genera imagen usando Google Gemini 2.5 Flash con generación nativa de imágenes
 */
async function generateWithGeminiNative(
  title: string,
  description: string,
  category: string,
  customPrompt?: string
): Promise<GeneratedImageResult | null> {
  // Temporarily disabled to avoid API key exposure in client bundle
  // TODO: Move to Netlify function
  console.log('Gemini Native image generation disabled for security');
  return null;
}

/**
 * Genera imagen usando Banana (servicio de IA)
 */
async function generateWithBanana(
  title: string,
  description: string,
  category: string,
  customPrompt?: string
): Promise<GeneratedImageResult | null> {
  try {
    const apiKey = import.meta.env.VITE_BANANA_API_KEY;

    if (!apiKey) {
      console.warn('Banana API key no configurada');
      return null;
    }

    if (apiKey === googleApiKey) {
      console.warn('Banana API key es igual a Google API key - esto no funcionará. Banana requiere su propia API key.');
      return null;
    }

    // Crear prompt para generación de imagen
    const imagePrompt = customPrompt || `Professional news article image for: ${title}. Category: ${category}. Description: ${description}. High quality, realistic, journalistic style.`;

    console.log('Generando imagen con Banana (server-side):', imagePrompt);

    // Usar Netlify Function para evitar exponer la API key
    const response = await fetch('/.netlify/functions/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: imagePrompt,
        provider: 'banana',
        modelKey: import.meta.env.VITE_BANANA_MODEL_KEY || 'sdxl'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ Error en Netlify Function de Banana:', errorData);
      throw new Error(`Error de Banana: ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (data.success && data.imageUrl) {
      return {
        url: data.imageUrl,
        provider: 'banana',
        description: `Imagen generada con Banana AI: ${imagePrompt.substring(0, 100)}...`
      };
    }

    console.warn('Respuesta de server no contiene URL de imagen válida:', data);
    return null;
  } catch (error) {
    console.error('Error generando imagen con Banana:', error);
    return null;
  }
}

/**
 * Función de compatibilidad con la implementación anterior
 */
export async function generateArticleImage(
  title: string,
  description: string,
  category: string,
  customQuery?: string
): Promise<string | null> {
  const result = await generateImageWithProvider(title, description, category, 'auto', customQuery);
  return result ? result.url : null;
}

/**
 * Genera una imagen placeholder cuando todos los proveedores fallan
 */
function getPlaceholderImage(category: string): GeneratedImageResult {
  // URLs de imágenes placeholder genéricas por categoría
  const placeholderUrls: Record<string, string> = {
    'Nacionales': 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&h=600&fit=crop',
    'Internacionales': 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=800&h=600&fit=crop',
    'Deportes': 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&h=600&fit=crop',
    'Economía': 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=600&fit=crop',
    'Política': 'https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=800&h=600&fit=crop',
    'Tecnología': 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=600&fit=crop',
    'Salud': 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&h=600&fit=crop',
    'Educación': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop',
    'default': 'https://images.unsplash.com/photo-1504711331083-9c895941bf81?w=800&h=600&fit=crop'
  };

  const url = placeholderUrls[category] || placeholderUrls.default;

  return {
    url,
    provider: 'placeholder',
    description: `Imagen placeholder para categoría: ${category}`
  };
}