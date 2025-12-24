/*
 * Archivo: src/lib/googleAI.ts
 * Descripción: Funciones para integración con Google AI (Gemini)
 *
 * Funcionalidades:
 * - callGoogleAI: Llama a Google Gemini para generación de texto
 * - generateImageWithAI: Genera descripciones de imágenes con Google AI
 */

// Re-exportar la función de generación de imágenes desde el nuevo módulo
export { generateArticleImage, generateImageWithProvider, type ImageProvider, type GeneratedImageResult } from './imageGeneration';

/**
 * Función helper para rate limiting de Google AI
 */
export const enforceGoogleAIRateLimit = async (): Promise<void> => {
  // Rate limiting: máximo 10 llamadas por minuto
  const now = Date.now();
  const callsKey = 'google_ai_calls';
  const callsData = localStorage.getItem(callsKey);
  let calls: number[] = callsData ? JSON.parse(callsData) : [];

  // Filtrar llamadas de más de 1 minuto
  calls = calls.filter(callTime => now - callTime < 60000);

  if (calls.length >= 10) {
    const waitTime = 60000 - (now - calls[0]);
    console.warn(`Rate limit alcanzado. Esperando ${Math.ceil(waitTime / 1000)} segundos...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    // Recargar después de esperar
    calls = JSON.parse(localStorage.getItem(callsKey) || '[]').filter(callTime => Date.now() - callTime < 60000);
  }

  // Agregar la nueva llamada
  calls.push(now);
  localStorage.setItem(callsKey, JSON.stringify(calls));
};

/**
 * Función auxiliar para usar la nueva API de Google AI
 */
export const callGoogleAI = async (prompt: string): Promise<string | null> => {
  // API key validation moved to server-side

  // Aplicar rate limiting
  await enforceGoogleAIRateLimit();

  try {
    const response = await fetch('/.netlify/functions/google-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateContent',
        data: { prompt, modelName: 'gemini-1.5-flash-latest' },
        identifier: 'google-ai-call-' + Date.now()
      }),
    });

    if (!response.ok) {
      console.error('Error calling Google AI function:', response.status);
      return null;
    }

    const result = await response.json();

    if (result.content) {
      let text = result.content;

      // Convert markdown-style formatting to HTML for Quill editor
      // Convert ***text*** to <strong><em>text</em></strong> (bold italic)
      text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      // Convert **text** to <strong>text</strong> (bold)
      text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Convert *text* to <em>text</em> (italic)
      text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

      // Process paragraph separation: split by double line breaks and wrap in <p> tags
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      if (paragraphs.length > 1) {
        text = paragraphs.map(p => `<p>${p}</p>`).join('');
      }

      return text;
    } else {
      console.error('Error from Google AI function:', result.error);
      return null;
    }
  } catch (error) {
    console.error('Error calling Google AI function:', error);
    return null;
  }
};

/**
 * Función para generar imágenes con Google AI (descripciones)
 */
export const generateImageWithAI = async (title: string, description: string, category: string): Promise<string | null> => {
  const prompt = `Genera una descripción detallada en inglés para crear una imagen sobre:
    Título: "${title}"
    Categoría: "${category}"
    Descripción: "${description}"

    La descripción debe ser para una imagen realista, profesional y apropiada para un artículo de noticias.
    Responde solo con la descripción de la imagen, sin texto adicional.`;

  try {
    const result = await callGoogleAI(prompt);
    if (result) {
      // Aquí podrías integrar con DALL-E, Midjourney, o cualquier generador de imágenes
      console.log('Descripción para imagen generada:', result);
      return result; // Por ahora retornamos la descripción
    }

    return null;
  } catch (error) {
    console.error('Error generando descripción de imagen:', error);
    return null;
  }
};