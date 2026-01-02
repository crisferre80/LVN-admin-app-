// =============================================
// Edge Function: process_local_rss
// =============================================
// Esta función procesa feeds RSS de medios locales y extrae:
// - Título de la noticia
// - Resumen/descripción
// - Contenido sustancial
// - Imagen de referencia
// - URL original
// - Fuente

// @ts-expect-error: Deno is available in Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-expect-error: Deno is available in Supabase Edge Functions
import { XMLParser } from 'npm:fast-xml-parser@4.2.5'
// @ts-expect-error: Deno is available in Supabase Edge Functions
import { load as cheerioLoad } from 'npm:cheerio@1.0.0-rc.12'

interface LocalNews {
  title: string
  summary: string
  content: string
  image_url?: string
  url: string
  source: string
  author?: string
  published_at: string
  category: string
  created_at: string
}

// Fuentes RSS de medios locales
const RSS_SOURCES = [
  {
    name: 'Diario Panorama',
    url: 'https://www.diariopanorama.com/rss',
    source: 'diariopanorama.com'
  },
  {
    name: 'Info del Estero',
    url: 'https://infodelestero.com/feed/',
    source: 'infodelestero.com'
  }
]

// Función helper para fetch con retry y timeout
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  timeoutMs = 15000
): Promise<Response> {
  let lastError: Error

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        return response
      } else if (response.status >= 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      } else {
        return response
      }
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        console.log(
          `Fetch attempt ${attempt + 1} failed for ${url}, retrying in ${delay}ms:`,
          error
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError!
}

// Función para extraer contenido completo de la noticia desde la URL
async function fetchFullContent(url: string): Promise<string> {
  try {
    console.log(`Fetching full content from: ${url}`)
    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Diario del Norte Grande RSS Reader/1.0',
      },
    }, 2, 10000) // Solo 2 reintentos para contenido

    if (!response.ok) {
      console.log(`Failed to fetch full content: ${response.status}`)
      return ''
    }

    const html = await response.text()
    return html // Retornar el HTML completo
  } catch (error) {
    console.error(`Error fetching full content from ${url}:`, error)
    return ''
  }
}

// Función para extraer texto del contenido HTML
function extractTextFromHTML(html: string): string {
  const $ = cheerioLoad(html)

  // Intentar extraer el contenido del artículo usando varios selectores comunes
  const selectors = [
    'article .entry-content',
    'article .post-content',
    'article .article-content',
    '.entry-content',
    '.post-content',
    '.article-content',
    'article p',
    '.content p',
    'main p'
  ]

  let content = ''
  for (const selector of selectors) {
    const paragraphs = $(selector)
    if (paragraphs.length > 0) {
      paragraphs.each((_, elem) => {
        const text = $(elem).text().trim()
        if (text.length > 50) { // Solo párrafos significativos
          content += text + '\n\n'
        }
      })
      if (content.length > 200) break // Si encontramos buen contenido, salir
    }
  }

  // Limpiar y limitar el contenido
  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()

  // Limitar a ~2000 caracteres para no sobrecargar la BD
  if (content.length > 2000) {
    content = content.substring(0, 2000) + '...'
  }

  return content
}

// Función para categorizar noticias locales
function categorizeLocalNews(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase()

  // Categorías específicas para noticias locales
  const categoryKeywords = {
    'Deportes': [
      'fútbol', 'deporte', 'deportes', 'gol', 'partido', 'liga', 'torneo',
      'quimilí', 'mitre', 'central norte', 'gimnasia', 'racing',
      'campeonato', 'copa', 'atleta', 'entrenador'
    ],
    'Policiales': [
      'policía', 'policial', 'robo', 'hurto', 'asalto', 'delito', 'crimen',
      'arresto', 'detenido', 'investigación policial', 'comisaría', 'fiscal',
      'accidente', 'choque', 'vuelco', 'ruta', 'tránsito', 'bomberos'
    ],
    'Política': [
      'intendente', 'municipio', 'concejal', 'gobernador', 'diputado',
      'senador', 'legislatura', 'elecciones', 'política', 'gobierno',
      'zamora', 'provincia', 'legislador', 'ministro'
    ],
    'Salud': [
      'hospital', 'salud', 'médico', 'enfermera', 'clínica', 'paciente',
      'vacuna', 'vacunación', 'enfermedad', 'tratamiento', 'pandemia',
      'covid', 'coronavirus', 'dengue', 'centro de salud'
    ],
    'Educación': [
      'escuela', 'colegio', 'educación', 'docente', 'maestro', 'profesor',
      'estudiante', 'alumno', 'universidad', 'capacitación', 'clases'
    ],
    'Cultura': [
      'cultura', 'cultural', 'festival', 'folklore', 'arte', 'artista',
      'música', 'teatro', 'libro', 'exposición', 'museo', 'patrimonio'
    ],
    'Economía': [
      'economía', 'comercio', 'empresa', 'trabajo', 'empleo', 'salario',
      'precio', 'inflación', 'dólar', 'banco', 'mercado', 'producción'
    ]
  }

  // Calcular puntuaciones
  const scores: Array<{ category: string; score: number }> = []
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    let score = 0
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += keyword.length > 10 ? 3 : keyword.length > 5 ? 2 : 1
      }
    }
    if (score > 0) {
      scores.push({ category, score })
    }
  }

  // Ordenar por puntuación
  scores.sort((a, b) => b.score - a.score)

  // Retornar la categoría con mayor puntuación o 'Regionales' por defecto
  return scores.length > 0 ? scores[0].category : 'Regionales'
}

// Función principal para parsear RSS
async function parseRSS(
  rssText: string,
  source: string
): Promise<LocalNews[]> {
  console.log(`\n--- Parsing RSS for source ${source} ---`)

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  })

  let parsed
  try {
    parsed = parser.parse(rssText)
  } catch (error) {
    console.log(`XML parsing error: ${(error as Error).message}`)
    return []
  }

  // Encontrar items en diferentes estructuras posibles
  type RSSItem = {
    title?: string
    description?: string
    'content:encoded'?: string
    link?: string
    guid?: string | { '#text'?: string }
    author?: string
    'dc:creator'?: string
    pubDate?: string
    enclosure?: { '@_url'?: string; '@_type'?: string } | Array<{ '@_url'?: string; '@_type'?: string }>
    'media:content'?: { '@_url'?: string; '@_type'?: string } | Array<{ '@_url'?: string; '@_type'?: string }>
    'media:thumbnail'?: { '@_url'?: string }
    [key: string]: unknown
  }

  let items: RSSItem[] = []
  if (parsed.rss?.channel?.item) {
    items = Array.isArray(parsed.rss.channel.item)
      ? parsed.rss.channel.item
      : [parsed.rss.channel.item]
  } else if (parsed.feed?.entry) {
    items = Array.isArray(parsed.feed.entry)
      ? parsed.feed.entry
      : [parsed.feed.entry]
  }

  console.log(`Found ${items.length} items in RSS feed`)

  const localNews: LocalNews[] = []

  // Procesar hasta 10 noticias por fuente (reducido desde 50)
  for (let index = 0; index < items.length && index < 10; index++) {
    const item = items[index]

    // Extraer campos básicos
    const title = item.title
    const description = item.description || item['content:encoded'] || ''
    let link = item.link
    if (!link && item.guid) {
      link = typeof item.guid === 'string' ? item.guid : item.guid['#text']
    }
    const author = item.author || item['dc:creator'] || ''
    const pubDate = item.pubDate

    // Extraer imagen
    let imageUrl: string | undefined

    // 1. Intentar con enclosure
    if (item.enclosure) {
      const enclosures = Array.isArray(item.enclosure) ? item.enclosure : [item.enclosure]
      for (const enc of enclosures) {
        if (enc['@_type']?.startsWith('image/') && enc['@_url']) {
          imageUrl = enc['@_url']
          break
        }
      }
    }

    // 2. Intentar con media:content
    if (!imageUrl && item['media:content']) {
      const mediaContents = Array.isArray(item['media:content'])
        ? item['media:content']
        : [item['media:content']]
      for (const media of mediaContents) {
        if (media['@_url'] && (media['@_type']?.startsWith('image/') || media['@_url'].match(/\.(jpg|jpeg|png|gif|webp)/i))) {
          imageUrl = media['@_url']
          break
        }
      }
    }

    // 3. Intentar con media:thumbnail
    if (!imageUrl && item['media:thumbnail'] && typeof item['media:thumbnail'] === 'object') {
      imageUrl = item['media:thumbnail']['@_url']
    }

    // 4. Extraer desde el contenido HTML (content:encoded o description)
    if (!imageUrl) {
      const htmlContent = item['content:encoded'] || description
      if (htmlContent) {
        // Usar regex para encontrar la primera imagen en el HTML
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/i
        const match = htmlContent.match(imgRegex)
        if (match && match[1]) {
          imageUrl = match[1]
          // Limpiar espacios y caracteres extraños
          imageUrl = imageUrl.trim()
        }
      }
    }

    if (!title || !link) {
      console.log(`Skipping item ${index}: missing title or link`)
      continue
    }

    try {
      // Procesar fecha de publicación
      let publishedAt = new Date().toISOString()
      if (pubDate) {
        const parsedDate = new Date(pubDate)
        if (!isNaN(parsedDate.getTime())) {
          publishedAt = parsedDate.toISOString()
        }
      }

      // Crear resumen desde la descripción
      const descriptionText = description.replace(/<[^>]*>/g, '').trim()
      const summary = descriptionText.substring(0, 300) + (descriptionText.length > 300 ? '...' : '')

      // Intentar extraer imagen primero (antes de procesar contenido completo)
      // para evitar hacer fetch dos veces
      let needsPageFetch = !imageUrl

      // Extraer contenido completo y/o imagen
      let content = descriptionText
      if (needsPageFetch && link) {
        try {
          const pageHTML = await fetchFullContent(link)
          if (pageHTML) {
            // Extraer texto del contenido
            const extractedText = extractTextFromHTML(pageHTML)
            if (extractedText.length > content.length) {
              content = extractedText
            }

            // Si aún no tenemos imagen, extraerla del HTML de la página
            if (!imageUrl) {
              const $ = cheerioLoad(pageHTML)
              
              // Intentar con meta tags Open Graph
              const ogImage = $('meta[property="og:image"]').attr('content')
              if (ogImage) {
                imageUrl = ogImage
              } else {
                // Intentar con la primera imagen del artículo
                const firstImg = $('article img, .entry-content img, .post-content img, .article-content img').first().attr('src')
                if (firstImg) {
                  imageUrl = firstImg
                  // Hacer la URL absoluta si es relativa
                  if (imageUrl && !imageUrl.startsWith('http')) {
                    const baseUrl = new URL(link).origin
                    imageUrl = new URL(imageUrl, baseUrl).href
                  }
                }
              }
            }
          }
        } catch (error) {
          console.log(`Could not fetch full content for ${link}, using description`)
        }
      }

      // Categorizar la noticia
      const category = categorizeLocalNews(title, description)

      const localNewsItem: LocalNews = {
        title,
        summary,
        content,
        image_url: imageUrl,
        url: link,
        source,
        author: author || undefined,
        published_at: publishedAt,
        category,
        created_at: new Date().toISOString(),
      }

      localNews.push(localNewsItem)
      console.log(
        `✓ Processed: "${title.substring(0, 60)}..." [${category}] - Image: ${imageUrl ? 'Yes' : 'No'}`
      )
    } catch (error) {
      console.error(`Error processing article "${title}":`, error)
    }
  }

  console.log(`Successfully parsed ${localNews.length} local news items from ${source}`)
  return localNews
}

// Handler principal de la Edge Function
// @ts-expect-error: Deno is available in Supabase Edge Functions
Deno.serve(async (req) => {
  // Manejar CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  console.log(`=== LOCAL RSS PROCESSING STARTED at ${new Date().toISOString()} ===`)

  try {
    // Leer parámetros del query string o body
    let maxArticlesPerSource = 10 // Límite reducido por defecto
    let batchMode = false
    let sourceIndex = 0
    
    try {
      const url = new URL(req.url)
      const maxParam = url.searchParams.get('max')
      const batchParam = url.searchParams.get('batch')
      const sourceParam = url.searchParams.get('source')
      
      if (maxParam) maxArticlesPerSource = parseInt(maxParam, 10)
      if (batchParam === 'true') batchMode = true
      if (sourceParam) sourceIndex = parseInt(sourceParam, 10)
    } catch (e) {
      console.log('Using default parameters')
    }

    console.log(`Batch mode: ${batchMode}, Max articles: ${maxArticlesPerSource}, Source index: ${sourceIndex}`)

    // Inicializar cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let totalNewsProcessed = 0
    let totalNewsInserted = 0
    let sourcesProcessed = 0

    // En modo batch, solo procesar una fuente a la vez
    const sourcesToProcess = batchMode && sourceIndex < RSS_SOURCES.length
      ? [RSS_SOURCES[sourceIndex]]
      : RSS_SOURCES

    // Procesar cada fuente RSS
    for (const rssSource of sourcesToProcess) {
      console.log(`\n=== Processing RSS Source: ${rssSource.name} ===`)
      console.log(`URL: ${rssSource.url}`)

      try {
        // Obtener el feed RSS
        const response = await fetchWithRetry(rssSource.url, {
          headers: {
            'User-Agent': 'Diario del Norte Grande RSS Reader/1.0',
          },
        })

        if (!response.ok) {
          console.log(
            `Failed to fetch RSS for ${rssSource.url}: ${response.status}`
          )
          continue
        }

        const rssText = await response.text()

        // Parsear el RSS con límite de artículos
        const localNews = await parseRSS(rssText, rssSource.source)
        
        // Limitar artículos procesados
        const limitedNews = localNews.slice(0, maxArticlesPerSource)

        console.log(`Parsed ${limitedNews.length} news items from ${rssSource.name} (limited from ${localNews.length})`)
        totalNewsProcessed += limitedNews.length

        if (limitedNews.length > 0) {
          // En modo batch, no eliminar noticias existentes, solo agregar nuevas
          if (!batchMode) {
            console.log(`Deleting existing news for source ${rssSource.source}`)
            const { error: deleteError } = await supabase
              .from('local_news')
              .delete()
              .eq('source', rssSource.source)

            if (deleteError) {
              console.error(
                `Failed to delete news for ${rssSource.source}:`,
                deleteError
              )
              continue
            }

            console.log(`Successfully deleted existing news for ${rssSource.source}`)
          }

          // Insertar nuevas noticias en lotes más pequeños (5 a la vez)
          const batchSize = 5
          for (let i = 0; i < limitedNews.length; i += batchSize) {
            const batch = limitedNews.slice(i, i + batchSize)
            console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)`)
            
            const { error: insertError } = await supabase
              .from('local_news')
              .insert(batch)

            if (insertError) {
              console.error(
                `Failed to insert batch for ${rssSource.name}:`,
                insertError
              )
            } else {
              console.log(
                `✅ Successfully inserted batch of ${batch.length} news items`
              )
              totalNewsInserted += batch.length
            }
            
            // Pequeño delay entre lotes para no sobrecargar
            if (i + batchSize < limitedNews.length) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }
          
          sourcesProcessed++
        } else {
          console.log(`No news found for ${rssSource.name}`)
          sourcesProcessed++
        }
      } catch (error) {
        console.error(`Error processing RSS ${rssSource.url}:`, error)
      }
    }

    const result = {
      success: true,
      total_news_processed: totalNewsProcessed,
      total_news_inserted: totalNewsInserted,
      sources_processed: sourcesProcessed,
      total_sources: RSS_SOURCES.length,
      batch_mode: batchMode,
      current_source_index: sourceIndex,
      has_more: batchMode && sourceIndex < RSS_SOURCES.length - 1,
      message: `Processed ${sourcesProcessed} sources, inserted ${totalNewsInserted} local news items`,
    }

    console.log(`\n=== LOCAL RSS PROCESSING COMPLETED ===`)
    console.log(result)

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    })
  } catch (error) {
    console.error('Unexpected error in Edge Function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: (error as Error).message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type',
        },
      }
    )
  }
})
