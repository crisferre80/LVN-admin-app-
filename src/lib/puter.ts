const PUTER_API_KEY = import.meta.env.VITE_PUTER_API_KEY;

/**
 * Función para generar contenido con Puter AI a través de Netlify Function
 */
export async function generateWithPuter(
  prompt: string,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  } = {}
): Promise<string | null> {
  const {
    model = 'gpt-4o-mini',
    temperature = 0.7,
    maxTokens = 2000,
    systemPrompt
  } = options;

  try {
    console.log('🤖 Llamando a Netlify Function de Puter AI:', { model, promptLength: prompt?.length });

    // Usar Netlify Function para evitar exponer la API key
    const netlifyFunctionUrl = '/.netlify/functions/puter-ai';

    const response = await fetch(netlifyFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        systemPrompt,
        model,
        temperature,
        maxTokens
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ Error en Netlify Function de Puter AI:', errorData);
      throw new Error(`Error de Puter AI: ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();

    if (data.success && data.content) {
      return data.content;
    }

    console.warn('Respuesta de Puter AI no contiene contenido válido:', data);
    return null;
  } catch (error) {
    console.error('Error generando contenido con Puter AI:', error);
    return null;
  }
}

/**
 * Función para reescribir contenido con Puter AI
 */
export async function rewriteWithPuter(
  content: string,
  title: string,
  category: string,
  style?: string
): Promise<string | null> {
  const systemPrompt = `Eres un periodista profesional especializado en reescribir artículos de manera atractiva y periodística. Tu tarea es reescribir el contenido proporcionado manteniendo la información esencial pero mejorando el estilo, la estructura y el atractivo para los lectores.

INSTRUCCIONES ESPECÍFICAS:
- Mantén TODA la información factual importante
- Mejora la estructura: título atractivo, entradilla impactante, cuerpo bien organizado
- Usa lenguaje periodístico profesional pero accesible
- Incluye elementos de formato: **negritas** para énfasis, *cursivas* cuando sea apropiado
- Evita párrafos demasiado cortos
- Asegúrate de que fluya naturalmente
- Categoría del artículo: ${category}

ESTILO: ${style || 'noticia-objetiva'}

Responde ÚNICAMENTE con el artículo reescrito, sin explicaciones adicionales.`;

  const userPrompt = `Título original: "${title}"

Contenido original:
${content}

Por favor reescribe este artículo completo siguiendo las instrucciones.`;

  return await generateWithPuter(userPrompt, {
    systemPrompt,
    temperature: 0.7,
    maxTokens: 3000
  });
}

/**
 * Función para generar contenido completo con Puter AI
 */
export async function generateContentWithPuter(
  title: string,
  description: string,
  category: string,
  style?: string
): Promise<string | null> {
  const systemPrompt = `Eres un periodista profesional especializado en escribir artículos completos y atractivos. Tu tarea es crear un artículo completo basado en el título y descripción proporcionados.

INSTRUCCIONES ESPECÍFICAS:
- Crea un artículo completo y bien estructurado
- Incluye: título atractivo, entradilla impactante, desarrollo completo con varios párrafos
- Mantén la información consistente con el título y descripción
- Usa lenguaje periodístico profesional
- Incluye elementos de formato: **negritas** para énfasis, *cursivas* cuando sea apropiado
- Categoría del artículo: ${category}
- Longitud apropiada: entre 400-800 palabras

ESTILO: ${style || 'noticia-objetiva'}

Responde ÚNICAMENTE con el artículo completo, sin explicaciones adicionales.`;

  const userPrompt = `Título: "${title}"
Descripción/Resumen: "${description}"
Categoría: "${category}"

Escribe un artículo completo y atractivo basado en esta información.`;

  return await generateWithPuter(userPrompt, {
    systemPrompt,
    temperature: 0.8,
    maxTokens: 4000
  });
}