import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { prompt, systemPrompt, model = 'gpt-4o-mini', temperature = 0.7, maxTokens = 2000 } = JSON.parse(event.body || '{}');

    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Prompt es requerido' })
      };
    }

    const openaiApiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API key de OpenAI no configurada' })
      };
    }

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
        'Authorization': `Bearer ${openaiApiKey}`,
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
      const errorData = await response.text();
      console.error('Error de OpenAI:', response.status, errorData);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `Error de OpenAI: ${response.status} - ${errorData}`
        })
      };
    }

    const data = await response.json();
    const generatedContent = data.choices?.[0]?.message?.content;

    if (!generatedContent) {
      console.error('No se recibió contenido de OpenAI:', data);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'No se pudo generar contenido' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        content: generatedContent,
        usage: data.usage,
        model: data.model
      })
    };
  } catch (error: any) {
    console.error('Error en Netlify Function generate-openai:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: `Error interno del servidor: ${error.message}` 
      })
    };
  }
};

export { handler };
