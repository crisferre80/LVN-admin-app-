// Deno Edge Function - Los errores de TypeScript son normales en VS Code
// Este archivo se ejecuta en Deno, no en Node.js
// @ts-nocheck para desarrollo, Deno tiene sus propios tipos

// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @deno-types="https://esm.sh/@supabase/supabase-js@2"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutomationConfig {
  id: string;
  enabled: boolean;
  schedule_time: string;
  categories: string[];
  articles_per_category: number;
  auto_publish: boolean;
}

interface RSSArticle {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  image_url?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Crear cliente de Supabase con service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🤖 Iniciando automatización...');

    // Obtener configuración activa
    const { data: configs, error: configError } = await supabase
      .from('automation_config')
      .select('*')
      .eq('enabled', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (configError) {
      throw new Error(`Error obteniendo configuración: ${configError.message}`);
    }

    if (!configs || configs.length === 0) {
      console.log('⏸️  No hay configuración activa');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No hay configuración activa',
          executed: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = configs[0] as AutomationConfig;
    console.log('⚙️  Configuración encontrada:', config);

    // Verificar si es hora de ejecutar
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Permitir un margen de 5 minutos
    const scheduledTime = config.schedule_time;
    const timeDiff = Math.abs(
      (parseInt(currentTime.split(':')[0]) * 60 + parseInt(currentTime.split(':')[1])) -
      (parseInt(scheduledTime.split(':')[0]) * 60 + parseInt(scheduledTime.split(':')[1]))
    );

    // Si la diferencia es mayor a 5 minutos y no es una ejecución forzada, no ejecutar
    const isForced = req.method === 'POST' && new URL(req.url).searchParams.get('force') === 'true';
    
    if (!isForced && timeDiff > 5) {
      console.log(`⏰ No es hora de ejecutar. Actual: ${currentTime}, Programado: ${scheduledTime}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `No es hora de ejecutar. Programado para ${scheduledTime}`,
          executed: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Hora correcta o ejecución forzada. Iniciando procesamiento...');

    // Registrar inicio de ejecución
    await supabase
      .from('automation_logs')
      .insert([{
        status: 'running',
        message: 'Iniciando procesamiento automático',
        articles_generated: 0
      }]);

    // 1. Procesar RSS primero
    console.log('📡 Procesando fuentes RSS...');
    try {
      const rssResponse = await fetch(`${supabaseUrl}/functions/v1/process_rss`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!rssResponse.ok) {
        console.warn('⚠️  Error procesando RSS, continuando con artículos existentes...');
      } else {
        console.log('✅ RSS procesado exitosamente');
      }
    } catch (rssError) {
      console.warn('⚠️  Error al llamar process_rss:', rssError);
    }

    // Esperar un momento para que se procesen los artículos
    await new Promise(resolve => setTimeout(resolve, 2000));

    let totalGenerated = 0;
    const errors: string[] = [];

    // 2. Generar artículos para cada categoría
    for (const category of config.categories) {
      console.log(`📝 Procesando categoría: ${category}`);

      try {
        // Obtener artículos RSS de esta categoría
        const { data: rssArticles, error: fetchError } = await supabase
          .from('articles')
          .select('id, title, description, content, category, image_url')
          .eq('category', category)
          .not('rss_source_id', 'is', null)
          .order('published_at', { ascending: false })
          .limit(config.articles_per_category);

        if (fetchError) {
          throw new Error(`Error obteniendo artículos RSS: ${fetchError.message}`);
        }

        if (!rssArticles || rssArticles.length === 0) {
          const msg = `No hay artículos RSS disponibles en ${category}`;
          console.log(`⚠️  ${msg}`);
          errors.push(msg);
          continue;
        }

        console.log(`📰 Encontrados ${rssArticles.length} artículos RSS en ${category}`);

        // Generar artículos con IA
        for (const rssArticle of rssArticles as RSSArticle[]) {
          try {
            console.log(`🤖 Generando artículo desde: "${rssArticle.title.substring(0, 50)}..."`);

            // Crear prompt de reescritura
            const rewritePrompt = `Eres un periodista experimentado de La Voz del Norte Diario, un periódico regional argentino con más de 50 años de trayectoria.
Tu estilo periodístico se caracteriza por:
- Lenguaje claro, preciso y accesible para todo público
- Tono neutral pero cercano, evitando sensacionalismo
- Enfoque en hechos verificables y contexto regional
- Estructura clásica de noticia con pirámide invertida
- Uso de fuentes locales y nacionales cuando corresponde
- Lenguaje formal pero no rebuscado

IMPORTANTE: Usa formato Markdown para resaltar elementos importantes:
- **Negritas** para nombres propios, lugares y datos clave
- *Cursivas* para énfasis sutil o citas textuales
- Mantén el formato periodístico profesional

Reescribe el siguiente contenido con el estilo periodístico profesional de La Voz del Norte Diario:

**Título original:** ${rssArticle.title}
**Contenido a reescribir:**
${rssArticle.content || rssArticle.description}

**Instrucciones específicas:**
1. **Mantén TODA la información factual** del contenido original
2. **Conserva el enfoque y ángulo** del artículo original
3. **Mejora el lenguaje periodístico** sin cambiar el significado
4. **Estructura en pirámide invertida**: lo más importante primero
5. **Agrega contexto regional** cuando sea relevante (Argentina, Santiago del Estero, regiones)
6. **Usa lenguaje claro y accesible** para todo público
7. **Elimina redundancias** y mejora la fluidez
8. **Mantén el tono neutral** pero informativo

**Resultado esperado:**
- Artículo reescrito con estilo profesional de periódico regional
- Longitud similar al original (mantén la extensión aproximada)
- Estructura periodística clásica
- Lenguaje apropiado para un diario de referencia regional

Responde ÚNICAMENTE con el artículo reescrito en formato Markdown, sin introducción ni comentarios adicionales. El formato debe ser:

**Título Atractivo**

*Entradilla impactante que resume lo esencial.*

Cuerpo del artículo con párrafos coherentes y bien estructurados. Usa **negritas** para elementos importantes y *cursivas* para énfasis cuando sea necesario. Evita párrafos demasiado cortos o separados.`;

            // Llamar a OpenAI o Gemini (configurable según tu preferencia)
            const aiProvider = Deno.env.get('AI_PROVIDER') || 'gemini';
            let rewrittenContent = '';

            if (aiProvider === 'gemini') {
              const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
              if (!geminiApiKey) {
                throw new Error('GEMINI_API_KEY no configurada');
              }

              const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${geminiApiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: rewritePrompt }] }]
                  })
                }
              );

              if (!geminiResponse.ok) {
                throw new Error(`Gemini API error: ${geminiResponse.statusText}`);
              }

              const geminiData = await geminiResponse.json();
              rewrittenContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            } else {
              // Usar OpenAI
              const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
              if (!openaiApiKey) {
                throw new Error('OPENAI_API_KEY no configurada');
              }

              const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openaiApiKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  model: 'gpt-3.5-turbo',
                  messages: [{ role: 'user', content: rewritePrompt }]
                })
              });

              if (!openaiResponse.ok) {
                throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
              }

              const openaiData = await openaiResponse.json();
              rewrittenContent = openaiData.choices?.[0]?.message?.content || '';
            }

            if (!rewrittenContent) {
              throw new Error('No se pudo generar contenido');
            }

            // Limpiar contenido generado por IA
            const cleanAIGeneratedContent = (content: string): string => {
              if (!content) return '';
              return content
                .replace(/^Claro, aquí tienes[^\n]*\n?/i, '')
                .replace(/^Aquí tienes[^\n]*\n?/i, '')
                .replace(/^Te presento[^\n]*\n?/i, '')
                .replace(/^Esta es una[^\n]*\n?/i, '')
                .replace(/^Basado en[^\n]*\n?/i, '')
                .replace(/^Según la información[^\n]*\n?/i, '')
                .replace(/^---.*$/gm, '')
                .replace(/\n\*\*.*\*\*\s*$/, '')
                .replace(/\n¿Quieres que[^\n]*\?/i, '')
                .replace(/\n¿Te gustaría[^\n]*\?/i, '')
                .replace(/\n¿Necesitas[^\n]*\?/i, '')
                .replace(/\nSi tienes[^\n]*\./i, '')
                .replace(/\nPara cualquier[^\n]*\./i, '')
                .replace(/\n\s*\n\s*\n/g, '\n\n')
                .replace(/([.!?])\s*\n(?!\n)/g, '$1\n')
                .replace(/\n\s+/g, '\n')
                .trim();
            };

            const markdownToHtml = (markdown: string): string => {
              if (!markdown) return '';
              const cleanedMarkdown = markdown.replace(/\n{3,}/g, '\n\n').trim();
              
              // Dividir en párrafos primero
              const paragraphs = cleanedMarkdown.split(/\n\s*\n/).filter(p => p.trim());
              
              if (paragraphs.length === 0) return '<p><br></p>';
              
              // Convertir cada párrafo a HTML
              const htmlParagraphs = paragraphs.map(paragraph => {
                // Conversión manual básica de Markdown a HTML
                let html = paragraph
                  // Encabezados
                  .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                  .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                  .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                  // Negritas
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  // Cursivas
                  .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                  // Convertir saltos de línea simples en <br>
                  .replace(/\n/g, '<br>');
                
                // Si ya es un encabezado, devolverlo tal cual
                if (html.startsWith('<h')) {
                  return html;
                }
                
                // Envolver en párrafo
                return `<p>${html}</p>`;
              });
              
              return htmlParagraphs.join('');
            };

            const cleanedContent = cleanAIGeneratedContent(rewrittenContent);
            const htmlContent = markdownToHtml(cleanedContent);

            // Extraer título del contenido
            const textContent = htmlContent.replace(/<[^>]*>/g, '');
            let extractedTitle = rssArticle.title; // Usar título original como fallback
            
            // Buscar título en negritas al inicio
            const titleMatch = cleanedContent.match(/^\*\*(.+?)\*\*/m);
            if (titleMatch && titleMatch[1].trim().length > 5) {
              extractedTitle = titleMatch[1].trim();
            } else {
              // Fallback: primera línea significativa
              const lines = textContent.split('\n').filter(line => line.trim());
              if (lines[0]?.length > 5) {
                extractedTitle = lines[0];
              }
            }

            // Extraer descripción breve (entradilla)
            let extractedSummary = '';
            const summaryMatch = cleanedContent.match(/^\*(.+?)\*/m);
            if (summaryMatch && summaryMatch[1].trim().length > 10) {
              extractedSummary = summaryMatch[1].trim();
            }

            // Remover título y entradilla del contenido antes de convertir a HTML
            let contentWithoutTitleAndSummary = cleanedContent;
            if (titleMatch) {
              contentWithoutTitleAndSummary = contentWithoutTitleAndSummary.replace(/^\*\*.+?\*\*\s*/, '');
            }
            if (summaryMatch) {
              contentWithoutTitleAndSummary = contentWithoutTitleAndSummary.replace(/^\*.+?\*\s*/, '');
            }

            // Convertir el contenido limpio a HTML
            const finalHtmlContent = markdownToHtml(contentWithoutTitleAndSummary);

            // Guardar artículo generado
            const { error: insertError } = await supabase
              .from('ai_generated_articles')
              .insert([{
                title: extractedTitle,
                content: finalHtmlContent,
                category: category,
                status: config.auto_publish ? 'published' : 'draft',
                source_rss_id: null,
                prompt_used: rewritePrompt,
                image_url: rssArticle.image_url || null,
                summary: extractedSummary,
                image_caption: '',
                author: 'La Voz del Norte Diario',
                published_at: config.auto_publish ? new Date().toISOString() : null
              }]);

            if (insertError) {
              throw new Error(`Error insertando artículo: ${insertError.message}`);
            }

            totalGenerated++;
            console.log(`✅ Artículo generado exitosamente`);

          } catch (articleError) {
            const errorMsg = `Error en ${category}: ${rssArticle.title.substring(0, 50)}... - ${articleError instanceof Error ? articleError.message : 'Error desconocido'}`;
            console.error(`❌ ${errorMsg}`);
            errors.push(errorMsg);
          }
        }
      } catch (categoryError) {
        const errorMsg = `Error procesando ${category}: ${categoryError instanceof Error ? categoryError.message : 'Error desconocido'}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Registrar resultado final
    const finalStatus = errors.length > 0 ? 'error' : 'success';
    const finalMessage = errors.length > 0
      ? `Generados ${totalGenerated} artículos con ${errors.length} errores`
      : `${totalGenerated} artículos generados exitosamente`;

    await supabase
      .from('automation_logs')
      .insert([{
        status: finalStatus,
        message: finalMessage,
        articles_generated: totalGenerated
      }]);

    console.log(`🎉 Automatización completada: ${finalMessage}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: finalMessage,
        articlesGenerated: totalGenerated,
        errors: errors.length > 0 ? errors : undefined,
        executed: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Error en automatización:', error);

    // Intentar registrar el error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase
        .from('automation_logs')
        .insert([{
          status: 'error',
          message: error instanceof Error ? error.message : 'Error desconocido',
          articles_generated: 0
        }]);
    } catch (logError) {
      console.error('Error registrando log:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
