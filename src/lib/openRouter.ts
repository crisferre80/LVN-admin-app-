/*
 * Archivo: src/lib/openRouter.ts
 * Descripción: Funciones para integración con OpenRouter API
 *
 * OpenRouter permite acceder a múltiples modelos de IA a través de una sola API
 */

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

/**
 * Función para generar contenido con OpenRouter a través de Netlify Function
 */
export async function generateWithOpenRouter(
  prompt: string,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  } = {}
): Promise<string | null> {
  const {
    model = 'openai/gpt-4o-mini',
    temperature = 0.7,
    maxTokens = 2000,
    systemPrompt
  } = options;

  try {
    console.log('🔄 Llamando a Netlify Function de OpenRouter:', { model, promptLength: prompt?.length });

    // Usar Netlify Function para evitar exponer la API key
    const netlifyFunctionUrl = '/.netlify/functions/openrouter-ai';

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
      console.error('❌ Error en Netlify Function de OpenRouter:', errorData);
      throw new Error(`Error de OpenRouter: ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();

    if (data.success && data.content) {
      return data.content;
    }

    console.warn('Respuesta de OpenRouter no contiene contenido válido:', data);
    return null;
  } catch (error) {
    console.error('Error generando contenido con OpenRouter:', error);
    return null;
  }
}

/**
 * Función para reescribir contenido con OpenRouter
 */
export async function rewriteWithOpenRouter(
  content: string,
  title: string,
  category: string,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string | null> {
  const rewritePrompt = `Reescribe el siguiente artículo de manera más atractiva, profesional y engaging para un periódico digital. Mantén la información factual pero mejora el lenguaje, agrega transiciones suaves y hazlo más interesante para los lectores.

Título original: "${title}"
Categoría: ${category}

Contenido original:
${content.replace(/<[^>]*>/g, '')}  // Remover HTML tags para el prompt

Reescribe el artículo completo manteniendo toda la información importante pero mejorando:
- El lenguaje y estilo periodístico
- La estructura y fluidez
- La atracción para el lector
- La claridad y concisión

Responde solo con el contenido reescrito, sin el título.`;

  return generateWithOpenRouter(rewritePrompt, {
    ...options,
    systemPrompt: 'Eres un periodista experimentado que reescribe artículos para hacerlos más atractivos y profesionales.'
  });
}

/**
 * Función para generar contenido nuevo con OpenRouter
 */
export async function generateContentWithOpenRouter(
  topic: string,
  style: {
    systemPrompt: string;
    userPromptTemplate: string;
    minWords: number;
    maxWords: number;
  },
  options: {
    model?: string;
    temperature?: number;
  } = {}
): Promise<string | null> {
  const generationPrompt = `${style.systemPrompt}

${style.userPromptTemplate.replace('{topic}', topic).replace('{additionalContext}', '')}

Genera el artículo completo en formato Markdown. El artículo debe tener entre ${style.minWords} y ${style.maxWords} palabras.`;

  return generateWithOpenRouter(generationPrompt, {
    ...options,
    systemPrompt: 'Eres un periodista experimentado que escribe artículos profesionales para un periódico digital.',
    maxTokens: 3000
  });
}