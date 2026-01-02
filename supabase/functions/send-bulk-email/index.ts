/**
 * Edge Function para envío masivo de emails usando Resend
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
// @deno-types="https://esm.sh/@supabase/supabase-js@2"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { templateId, subject, contactIds } = await req.json()

    console.log('🚀 Envío masivo iniciado:', { templateId, subject, contactIds: contactIds.length })

    // Crear cliente de Supabase usando SERVICE ROLE para operaciones seguras en server
    // preferimos service role porque las operaciones de inserción de tracking pueden ser bloqueadas por RLS
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      supabaseServiceKey,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Obtener plantilla
    const { data: template, error: templateError } = await supabaseClient
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      throw new Error('Plantilla no encontrada')
    }

    console.log('✅ Plantilla obtenida:', template.name)

    // Obtener contactos
    const { data: contacts, error: contactsError } = await supabaseClient
      .from('email_contacts')
      .select('*')
      .in('id', contactIds)

    if (contactsError || !contacts) {
      throw new Error('Error obteniendo contactos')
    }

    console.log('✅ Contactos obtenidos:', contacts.length)

    let successCount = 0
    let errorCount = 0
    const errors: any[] = []

    // Enviar a cada contacto
    for (const contact of contacts) {
      try {
        console.log(`📤 Enviando a ${contact.email}...`)

        const result = await resend.emails.send({
          from: 'La Voz del Norte Diario<noreply@lavozdelnortediario.com.com.ar>',
          to: contact.email,
          subject,
          html: template.html_content,
        })

        console.log(`✅ Enviado a ${contact.email}:`, result)
        successCount++

        // Registrar envío (no dependemos de campaign_id cuando se envía por template)
        const { data: _insertData, error: insertError } = await supabaseClient
          .from('email_sends')
          .insert({
            template_id: templateId,
            contact_id: contact.id,
            email: contact.email,
            status: 'sent',
            resend_id: result?.id,
            sent_at: new Date().toISOString(),
          })
          .select();
        if (insertError) {
          console.error('❌ Error al insertar email_sends (sent):', insertError);
        }
      } catch (error) {
        console.error(`❌ Error enviando a ${contact.email}:`, error)
        errorCount++
        errors.push({ email: contact.email, error: error.message })

        // Registrar fallo
        const { data: _insertFailData, error: insertFailError } = await supabaseClient
          .from('email_sends')
          .insert({
            template_id: templateId,
            contact_id: contact.id,
            email: contact.email,
            status: 'failed',
            error_message: error.message,
            sent_at: new Date().toISOString(),
          })
          .select();
        if (insertFailError) {
          console.error('❌ Error al insertar email_sends (failed):', insertFailError);
        }
      }
    }

    console.log(`📊 Resumen: ${successCount} exitosos, ${errorCount} fallidos`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: contacts.length,
        successCount,
        errorCount,
        errors
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('❌ Error en envío masivo:', error)
    
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
