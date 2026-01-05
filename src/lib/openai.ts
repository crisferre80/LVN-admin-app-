import { supabase } from './supabase';

// Obtener la API key de OpenAI desde las variables de entorno
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

/**
 * Función para generar contenido con OpenAI a través de Netlify Function
 * Esto evita problemas de CORS ya que la llamada se hace desde el servidor
 */
export async function generateWithOpenAIEdge(
  prompt: string,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  } = {}
): Promise<string | null> {
  const {
    model = 'gpt-4o', // Modelo más avanzado para mejor fiabilidad
    temperature = 0, // Temperatura reducida para resultados más deterministas
    maxTokens = 2000,
    systemPrompt
  } = options;

  try {
    console.log('🚀 Llamando a Netlify Function de OpenAI:', { model, promptLength: prompt?.length });

    // Siempre usar ruta relativa para evitar problemas de CORS
    const netlifyFunctionUrl = '/.netlify/functions/generate-openai';

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
      console.error('❌ Error en Netlify Function de OpenAI:', errorData);
      throw new Error(`Error de OpenAI: ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();

    if (data?.error) {
      console.error('❌ Error de OpenAI via Netlify:', data.error);
      throw new Error(`Error de OpenAI: ${data.error}`);
    }

    if (!data?.content) {
      console.error('❌ No se recibió contenido de OpenAI');
      throw new Error('No se recibió contenido de OpenAI');
    }

    console.log('✅ Contenido generado exitosamente via Netlify Function');
    return data.content;

  } catch (error: any) {
    console.error('❌ Error generando con OpenAI via Netlify:', error.message);
    throw error;
  }
}

/**
 * Función para generar contenido con OpenAI directamente
 */
export async function generateWithOpenAI(
  prompt: string,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  } = {}
): Promise<string | null> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY.trim() === '') {
    console.warn('API key de OpenAI no configurada');
    return null;
  }

  const {
    model = 'gpt-4o', // Modelo más avanzado para mejor fiabilidad
    temperature = 0, // Temperatura reducida para resultados más deterministas
    maxTokens = 2000,
    systemPrompt
  } = options;

  try {
    const messages: any[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    messages.push({
      role: 'user',
      content: prompt
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (data.choices && data.choices[0]?.message?.content) {
      let text = data.choices[0].message.content;

      // Convert markdown-style formatting to HTML for Quill editor
      // Convert ***text*** to <strong><em>text</em></strong> (bold italic)
      text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      // Convert **text** to <strong>text</strong> (bold)
      text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Convert *text* to <em>text</em> (italic)
      text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

      return text;
    }

    return null;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return null;
  }
}

/**
 * Función para reescribir contenido con OpenAI
 */
export async function rewriteWithOpenAI(
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

  return generateWithOpenAI(rewritePrompt, {
    ...options,
    systemPrompt: 'Eres un periodista experimentado que reescribe artículos para hacerlos más atractivos y profesionales.'
  });
}

/**
 * Función para generar contenido nuevo con OpenAI
 */
export async function generateContentWithOpenAI(
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

  return generateWithOpenAI(generationPrompt, {
    ...options,
    systemPrompt: 'Eres un periodista experimentado que escribe artículos profesionales para un periódico digital.',
    maxTokens: 3000
  });
}