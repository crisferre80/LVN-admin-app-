/**
 * Edge Function para generación de contenido con OpenAI GPT-4o-mini
 * Versión simplificada para evitar problemas de bundling
 */

// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400', // 24 horas
}

serve(async (req) => {
  console.log(`📡 ${req.method} request to generate-openai`);

  // Handle CORS preflight - responder a cualquier petición OPTIONS
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request');
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Length': '0',
      }
    });
  }

  try {
    const { prompt, systemPrompt, model = 'gpt-4o-mini', temperature = 0.7, maxTokens = 2000 } = await req.json()

    console.log('🤖 Generando contenido con OpenAI:', { model, promptLength: prompt?.length })

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt es requerido' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY no configurada')
      return new Response(
        JSON.stringify({ error: 'API key de OpenAI no configurada en el servidor' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const messages = []

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      })
    }

    messages.push({
      role: 'user',
      content: prompt
    })

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
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Error de OpenAI:', response.status, errorData)
      return new Response(
        JSON.stringify({
          error: `Error de OpenAI: ${response.status} - ${errorData}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: response.status,
        }
      )
    }

    const data = await response.json()
    const generatedContent = data.choices?.[0]?.message?.content

    if (!generatedContent) {
      console.error('No se recibió contenido de OpenAI:', data)
      return new Response(
        JSON.stringify({ error: 'No se pudo generar contenido' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    console.log('✅ Contenido generado exitosamente con OpenAI')

    return new Response(
      JSON.stringify({
        success: true,
        content: generatedContent,
        usage: data.usage,
        model: data.model
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error en Edge Function generate-openai:', error)
    return new Response(
      JSON.stringify({ error: `Error interno del servidor: ${error.message}` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})