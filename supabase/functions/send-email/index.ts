/**
 * Edge Function para envío de emails individuales usando Resend
 * 
 * NOTA: Los errores de TypeScript en VS Code son NORMALES y no afectan el funcionamiento.
 * Este código se ejecuta en Deno (runtime de Supabase), no en Node.js.
 * Las importaciones desde URLs son el estándar de Deno.
 * 
 * Para más info, ver: supabase/functions/README_TYPESCRIPT_ERRORS.md
 */

// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @deno-types="npm:resend@6.5.2"
import { Resend } from 'npm:resend@6.5.2'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, from, fromName } = await req.json()

    console.log('📧 Enviando email:', { to, subject, from })

    const result = await resend.emails.send({
      from: from || `${fromName || 'La Voz del Norte Diario'} <noreply@lavozdelnortediario.com.com.ar>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    })

    console.log('✅ Email enviado:', result)

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('❌ Error enviando email:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Error desconocido'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
