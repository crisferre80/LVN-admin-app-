// @ts-expect-error: Deno is available in Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-expect-error: Deno is available in Supabase Edge Functions
import { XMLParser } from 'npm:fast-xml-parser@4.2.5'
// @ts-expect-error: Deno is available in Supabase Edge Functions
import { load as cheerioLoad, CheerioElement } from 'npm:cheerio@1.0.0-rc.12'

interface Article {
  rss_source_id: string
  title: string
  description: string
  url: string
  author: string
  published_at: string
  category: string
  created_at: string
  image_url?: string
  content?: string
}

// Función helper para fetch con retry y timeout
async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3, timeoutMs = 10000): Promise<Response> {
  let lastError: Error

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        return response
      } else if (response.status >= 500) {
        // Retry on server errors
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      } else {
        // Don't retry on client errors
        return response
      }
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
        console.log(`Fetch attempt ${attempt + 1} failed for ${url}, retrying in ${delay}ms:`, error)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError!
}

// Función para categorizar automáticamente basado en título y descripción
function categorizeArticle(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase()

  // Palabras clave para categorías específicas con mayor precisión
  const categoryKeywords = {
    // Internacionales - Países, organismos y términos internacionales
    'Internacionales': [
      // Países principales (expandido)
      'estados unidos', 'eeuu', 'usa', 'united states', 'washington', 'nueva york', 'california', 'texas', 'florida', 'chicago', 'boston', 'las vegas', 'miami',
      'china', 'beijing', 'shanghai', 'rusia', 'moscú', 'putin', 'francia', 'parís', 'macron', 'alemania', 'berlín', 'scholz', 'reino unido', 'londres', 'inglaterra',
      'japón', 'tokio', 'india', 'nueva delhi', 'brasil', 'brasilia', 'sao paulo', 'lula', 'méxico', 'ciudad de méxico', 'españa', 'madrid', 'barcelona',
      'italia', 'roma', 'milán', 'canadá', 'ottawa', 'toronto', 'trudeau', 'australia', 'sidney', 'canberra', 'corea del sur', 'seúl',
      'israel', 'tel aviv', 'jerusalén', 'palestina', 'gaza', 'ucrania', 'kiev', 'zelensky', 'venezuela', 'caracas', 'maduro',
      'colombia', 'bogotá', 'perú', 'lima', 'bolivia', 'la paz', 'ecuador', 'quito', 'paraguay', 'asunción', 'uruguay', 'montevideo',
      // Organismos internacionales
      'onu', 'naciones unidas', 'otan', 'unión europea', 'mercosur', 'g7', 'g20', 'fmi', 'banco mundial', 'oea', 'unesco', 'unicef', 'fifa', 'uefa',
      // Términos internacionales
      'internacional', 'mundial', 'global', 'exterior', 'embajada', 'embajador', 'canciller', 'diplomacia', 'tratado', 'acuerdo internacional', 
      'cumbre internacional', 'conferencia internacional', 'guerra', 'conflicto internacional', 'refugiados', 'migración internacional', 
      'fronteras', 'comercio exterior', 'exportación internacional', 'importación internacional', 'relaciones exteriores',
      // Líderes internacionales conocidos (expandido)
      'biden', 'trump', 'kamala harris', 'putin', 'xi jinping', 'macron', 'scholz', 'trudeau', 'modi', 'lula', 'maduro', 'zelensky',
      'papa francisco', 'vaticano', 'elon musk', 'bill gates'
    ],

    // Deportes - Amplia cobertura deportiva (PRIORIDAD ALTA)
    'Deportes': [
      // Fútbol (expandido)
      'fútbol', 'football', 'soccer', 'gol', 'goles', 'partido', 'liga', 'champions', 'mundial', 'copa', 'selección', 'equipo', 'jugador', 'jugadores',
      'entrenador', 'técnico', 'referee', 'árbitro', 'estadio', 'cancha', 'penales', 'offside', 'tarjeta', 'expulsión',
      'boca', 'river', 'racing', 'independiente', 'san lorenzo', 'estudiantes', 'gimnasia', 'lanús', 'banfield', 'arsenal',
      'barcelona', 'real madrid', 'manchester', 'liverpool', 'chelsea', 'juventus', 'milan', 'inter', 'psg', 'bayern',
      // Messi y figuras del fútbol
      'messi', 'lionel messi', 'cristiano ronaldo', 'neymar', 'mbappé', 'haaland', 'benzema', 'lewandowski', 'modric',
      'scaloni', 'guardiola', 'ancelotti', 'mourinho', 'klopp', 'xavi', 'simeone',
      // Fórmula 1 y automovilismo (PRIORIDAD ALTA)
      'fórmula 1', 'formula 1', 'f1', 'gran premio', 'colapinto', 'franco colapinto', 'verstappen', 'hamilton', 'leclerc', 'sainz', 'norris',
      'red bull', 'ferrari', 'mercedes', 'mclaren', 'williams', 'aston martin', 'alpine', 'circuito', 'pole position', 'podio',
      'automovilismo', 'turismo carretera', 'tc', 'rally', 'motogp', 'rossi', 'márquez',
      // Otros deportes específicos
      'basketball', 'básquet', 'nba', 'lebron james', 'curry', 'jordan', 'ginóbili', 'scola', 'campazzo',
      'tenis', 'wimbledon', 'roland garros', 'us open', 'australian open', 'djokovic', 'nadal', 'federer', 'del potro', 'schwartzman',
      'golf', 'tiger woods', 'natación', 'atletismo', 'maratón', 'sprint', 'salto', 'lanzamiento',
      'boxeo', 'mma', 'ufc', 'canelo', 'pacquiao', 'mayweather', 'rugby', 'pumas', 'all blacks', 'hockey', 'leonas',
      'béisbol', 'mlb', 'volleyball', 'ciclismo', 'tour de france', 'giro', 'vuelta', 'triatlón',
      // Eventos deportivos
      'olimpiadas', 'juegos olímpicos', 'paralímpicos', 'mundial', 'campeonato', 'torneo', 'competencia', 'copa américa', 'eurocopa',
      // Términos generales deportivos
      'deporte', 'deportivo', 'deportes', 'atleta', 'deportista', 'victoria', 'derrota', 'empate', 'récord', 'marca', 'medalla', 'trofeo', 'premio deportivo',
      'entrenamiento', 'lesión', 'recuperación', 'fichaje', 'transferencia', 'contrato deportivo'
    ],

    // Espectáculos - Entretenimiento, celebridades, cultura popular (PRIORIDAD ALTA)
    'Espectaculos': [
      // Entretenimiento general
      'espectáculo', 'espectáculos', 'entretenimiento', 'celebridad', 'celebridades', 'famoso', 'famosa', 'artista', 'cantante', 'cantantes',
      'actor', 'actriz', 'actores', 'director', 'productor', 'estrella', 'galán', 'diva', 'ídolo',
      // Celebridades argentinas e internacionales
      'susana giménez', 'marcelo tinelli', 'mirtha legrand', 'jorge lanata', 'andy kusnetzoff', 'marley', 'guido kaczka',
      'shakira', 'jennifer lopez', 'brad pitt', 'leonardo dicaprio', 'angelina jolie', 'taylor swift', 'beyoncé', 'rihanna',
      'justin bieber', 'ariana grande', 'selena gomez', 'kim kardashian', 'jennifer aniston', 'tom cruise', 'will smith',
      // Medios y eventos
      'hollywood', 'netflix', 'disney', 'marvel', 'dc comics', 'warner', 'universal', 'paramount', 'hbo', 'amazon prime',
      'oscar', 'grammy', 'emmy', 'globos de oro', 'cannes', 'festival de cine', 'alfombra roja', 'premier', 'estreno',
      'showmatch', 'gran hermano', 'masterchef', 'la voz', 'bailando', 'cantando',
      // Música
      'música', 'canción', 'canciones', 'álbum', 'disco', 'single', 'hit', 'chart', 'billboard', 'concierto', 'recital', 'show',
      'gira', 'tour', 'festival musical', 'banda', 'grupo musical', 'solista', 'video musical', 'clip', 'spotify', 'youtube music',
      'reggaeton', 'pop', 'rock', 'trap', 'cumbia', 'tango', 'folclore', 'cuarteto',
      // Cine y TV
      'película', 'film', 'films', 'cine', 'cinema', 'serie', 'series', 'temporada', 'episodio', 'programa de tv', 'reality show',
      'telenovela', 'novela', 'documental', 'animación', 'streaming', 'plataforma', 'taquilla', 'box office',
      // Teatro y artes escénicas
      'teatro', 'obra teatral', 'musical', 'comedia musical', 'danza', 'ballet', 'ópera', 'circo', 'stand up', 'humor',
      // Chismes y vida personal
      'romance', 'noviazgo', 'relación', 'separación', 'divorcio', 'matrimonio', 'boda', 'embarazo', 'bebé', 'familia',
      'escándalo', 'polémica', 'controversia', 'rumor', 'vida privada', 'paparazzi', 'instagram', 'twitter', 'tiktok',
      'redes sociales', 'influencer', 'youtuber', 'tiktoker', 'streaming', 'twitch'
    ],

    // Economía - Finanzas, mercados, empresas (MEJORADO)
    'Economía': [
      // Términos económicos básicos
      'economía', 'económico', 'económica', 'mercado', 'mercados', 'bolsa', 'bursátil', 'wall street', 'nasdaq', 'dow jones',
      'inflación', 'deflación', 'pib', 'producto bruto', 'crecimiento económico', 'recesión', 'crisis económica', 'recuperación económica',
      'estanflación', 'hiperinflación', 'devaluación', 'revaluación',
      // Finanzas
      'finanzas', 'financiero', 'financiera', 'banco', 'bancos', 'banking', 'banca', 'crédito', 'préstamo', 'hipoteca',
      'inversión', 'inversiones', 'inversor', 'inversionista', 'accionista', 'acciones', 'dividendos', 'bonos', 'títulos',
      'fondo de inversión', 'mutual fund', 'etf', 'portfolio', 'cartera',
      // Monedas y valores
      'dólar', 'dólares', 'euro', 'euros', 'peso', 'pesos', 'moneda', 'divisa', 'tipo de cambio', 'cotización', 'forex',
      'bitcoin', 'ethereum', 'criptomoneda', 'criptomonedas', 'crypto', 'oro', 'plata', 'petróleo', 'brent', 'commodities',
      // Empresas y negocios
      'empresa', 'empresas', 'corporación', 'compañía', 'startup', 'unicornio', 'negocio', 'comercio', 'retail', 'manufactura',
      'industria', 'industrial', 'fábrica', 'producción', 'productividad', 'ventas', 'facturación', 'ganancias', 'pérdidas',
      'balance', 'estado financiero', 'activos', 'pasivos', 'patrimonio',
      // Trabajo y empleo
      'empleo', 'desempleo', 'trabajo', 'trabajadores', 'salario', 'salarios', 'sueldo', 'sueldos', 'remuneración',
      'sindicato', 'gremio', 'huelga', 'paro', 'negociación salarial', 'aguinaldo', 'jubilación', 'pensión',
      // Indicadores y organismos
      'ipc', 'índice de precios', 'índice', 'rating', 'calificación', 'riesgo país', 'reservas', 'bcra', 'banco central',
      'exportación', 'exportaciones', 'importación', 'importaciones', 'balanza comercial', 'déficit', 'superávit',
      'presupuesto', 'gasto público', 'recaudación', 'impuestos', 'afip', 'monotributo', 'iva', 'ganancias',
      // Sectores específicos
      'energía', 'petróleo', 'gas', 'electricidad', 'minería', 'agricultura', 'ganadería', 'soja', 'trigo', 'maíz', 'carne',
      'tecnología', 'software', 'fintech', 'startup', 'innovación', 'digitalización'
    ],

    // Nacionales - Política y asuntos argentinos
    'Nacionales': [
      // Gobierno argentino
      'gobierno', 'presidente', 'presidencia', 'casa rosada', 'congreso', 'senado', 'diputados', 'ministro', 'ministerio', 'secretario',
      'gabinete', 'consejo de ministros', 'jefatura de gabinete', 'vicepresidente',
      // Política argentina
      'política', 'político', 'políticos', 'elecciones', 'campaña', 'voto', 'urnas', 'ballotage', 'primarias', 'paso', 'sufragio',
      'oficialismo', 'oposición', 'alianza', 'coalición', 'bloque', 'bancada',
      // Instituciones argentinas
      'conicet', 'inta', 'anses', 'afip', 'bcra', 'banco central', 'indec', 'justicia', 'corte suprema', 'poder judicial',
      'procuración', 'fiscalía', 'defensoría', 'ombudsman', 'auditoría',
      // Partidos políticos argentinos
      'peronismo', 'kirchnerismo', 'macrismo', 'radical', 'ucr', 'pro', 'frente de todos', 'juntos por el cambio', 
      'la libertad avanza', 'milei', 'cristina kirchner', 'macri', 'massa', 'bullrich', 'larreta',
      // Leyes y normativas
      'ley', 'decreto', 'resolución', 'reforma', 'constitución', 'código', 'reglamento', 'norma', 'ordenanza',
      'proyecto de ley', 'sanción', 'promulgación', 'veto',
      // Lugares argentinos específicos
      'argentina', 'argentino', 'argentinos', 'nacional', 'país', 'nación',
      'buenos aires', 'caba', 'capital federal', 'córdoba', 'rosario', 'mendoza', 'tucumán', 'salta', 'jujuy', 
      'santiago del estero', 'catamarca', 'la rioja', 'san juan', 'san luis', 'neuquén', 'río negro', 'chubut',
      'santa cruz', 'tierra del fuego', 'misiones', 'corrientes', 'entre ríos', 'santa fe', 'chaco', 'formosa', 'la pampa'
    ],

    // Regionales - Asuntos locales y provinciales
    'Regionales': [
      // Términos locales
      'región', 'regional', 'provincia', 'provincial', 'local', 'municipio', 'municipal', 'comuna', 'comunal', 
      'intendente', 'alcalde', 'gobernador', 'concejal', 'consejo deliberante',
      // Lugares específicos
      'vecinos', 'barrio', 'ciudad', 'pueblo', 'localidad', 'distrito', 'zona', 'área metropolitana', 'conurbano',
      // Servicios locales
      'servicios públicos', 'transporte público', 'colectivo', 'subte', 'tren', 'agua potable', 'cloacas', 'gas', 
      'electricidad', 'alumbrado', 'recolección', 'residuos', 'basura',
      // Problemas locales
      'baches', 'semáforos', 'tránsito', 'obras públicas', 'pavimentación', 'asfalto', 'limpieza', 'mantenimiento',
      'seguridad', 'policía local', 'bomberos', 'hospital municipal', 'centro de salud'
    ],

    // Medio Ambiente - Ecología, clima, sustentabilidad
    'Medio Ambiente': [
      'medio ambiente', 'ambiental', 'ecología', 'ecológico', 'sustentabilidad', 'sostenible', 'verde', 'clima', 'climático', 
      'calentamiento global', 'cambio climático', 'emisiones', 'carbono', 'co2', 'contaminación', 'polución', 'smog',
      'reciclaje', 'energía renovable', 'solar', 'eólica', 'hidráulica', 'biomasa', 'geotérmica',
      'deforestación', 'biodiversidad', 'extinción', 'conservación', 'parque nacional', 'reserva natural', 'fauna', 'flora',
      'sequía', 'inundación', 'huracán', 'tornado', 'terremoto', 'tsunami', 'desastre natural', 'fenómeno climático',
      'efecto invernadero', 'capa de ozono', 'protocolo de kyoto', 'acuerdo de parís'
    ],

    // Opinión - Artículos de análisis y editorial
    'Opinión': [
      'opinión', 'editorial', 'análisis', 'reflexión', 'comentario', 'perspectiva', 'punto de vista', 'crítica', 'ensayo',
      'columna', 'artículo de opinión', 'debate', 'controversia', 'polémica', 'discusión', 'carta de lectores'
    ]
  }

  // Función para calcular puntuación de categoría con pesos mejorados
  function calculateCategoryScore(keywords: string[]): number {
    let score = 0
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        // Sistema de pesos más sofisticado
        let weight = 1
        if (keyword.length > 15) weight = 4      // Términos muy específicos
        else if (keyword.length > 10) weight = 3 // Términos específicos
        else if (keyword.length > 5) weight = 2  // Términos medios
        
        // Bonus para nombres propios y términos técnicos
        if (keyword.includes(' ') && keyword.length > 8) weight += 1 // Frases específicas
        
        score += weight
      }
    }
    return score
  }

  // Calcular puntuaciones para todas las categorías
  const scores: Array<{category: string, score: number}> = []
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    const score = calculateCategoryScore(keywords)
    if (score > 0) {
      scores.push({ category, score })
    }
  }

  // Ordenar por puntuación descendente
  scores.sort((a, b) => b.score - a.score)

  // LÓGICA DE PRIORIZACIÓN MEJORADA
  if (scores.length > 0) {
    const deportesScore = scores.find(s => s.category === 'Deportes')?.score || 0
    const espectaculosScore = scores.find(s => s.category === 'Espectaculos')?.score || 0
    const internacionalesScore = scores.find(s => s.category === 'Internacionales')?.score || 0
    const nacionalesScore = scores.find(s => s.category === 'Nacionales')?.score || 0
    const economiaScore = scores.find(s => s.category === 'Economía')?.score || 0

    // PRIORIDAD 1: DEPORTES (nombres específicos tienen prioridad absoluta)
    const deportesPrioritarios = [
      'messi', 'colapinto', 'franco colapinto', 'fórmula 1', 'formula 1', 'f1', 'gran premio',
      'verstappen', 'hamilton', 'leclerc', 'champions', 'mundial', 'copa', 'barcelona', 'real madrid',
      'boca', 'river', 'selección argentina', 'scaloni'
    ]
    if (deportesPrioritarios.some(term => text.includes(term))) {
      return 'Deportes'
    }

    // PRIORIDAD 2: ESPECTÁCULOS (celebridades y entretenimiento)
    const espectaculosPrioritarios = [
      'shakira', 'taylor swift', 'netflix', 'disney', 'hollywood', 'oscar', 'grammy',
      'susana giménez', 'tinelli', 'mirtha legrand', 'gran hermano', 'masterchef'
    ]
    if (espectaculosPrioritarios.some(term => text.includes(term))) {
      return 'Espectaculos'
    }

    // PRIORIDAD 3: POLÍTICA ARGENTINA (siempre va a Nacionales, incluso con términos económicos)
    const politicaArgentina = [
      'milei', 'cristina kirchner', 'macri', 'casa rosada', 'congreso', 'peronismo', 
      'gabinete', 'ministro', 'presidente argentino', 'gobierno argentino'
    ]
    if (politicaArgentina.some(term => text.includes(term))) {
      return 'Nacionales'
    }

    // PRIORIDAD 4: ECONOMÍA CON CONTEXTO INTERNACIONAL (solo casos muy específicos)
    // Si tiene términos económicos fuertes + lugares internacionales, sigue siendo economía
    const economiaPrioritarios = [
      'dólar', 'inflación', 'bolsa', 'mercado', 'mercados', 'inversión', 'banco', 'empresa', 'crisis económica',
      'pib', 'recesión', 'wall street', 'nasdaq', 'bitcoin', 'euro', 'economía', 'económico', 'financiero',
      'bursátil', 'dow jones', 'cotización', 'devaluación', 'criptomoneda'
    ]
    const tieneTerminosEconomicos = economiaPrioritarios.some(term => text.includes(term))
    
    // Solo para casos muy específicos de economía internacional (bolsa, crisis, mercados)
    if (tieneTerminosEconomicos && (text.includes('bolsa') || text.includes('crisis económica') || text.includes('mercados')) && (text.includes('londres') || text.includes('europa'))) {
      return 'Economía'
    }

    // PRIORIDAD 5: INTERNACIONAL (países y figuras extranjeras)
    const internacionalesPrioritarios = [
      'estados unidos', 'trump', 'biden', 'china', 'putin', 'washington', 'nueva york',
      'california', 'texas', 'florida', 'beijing', 'moscú', 'londres', 'parís', 'berlín'
    ]
    if (internacionalesPrioritarios.some(term => text.includes(term))) {
      return 'Internacionales'
    }

    // PRIORIDAD 6: ECONOMÍA (otros términos económicos)
    if (tieneTerminosEconomicos) {
      return 'Economía'
    }

    // PRIORIDAD 7: Si tiene puntaje alto, usar la categoría con mayor score
    if (scores[0].score >= 3) {
      return scores[0].category
    }

    // LÓGICA DE DESEMPATE ENTRE NACIONAL E INTERNACIONAL
    if (nacionalesScore > 0 && internacionalesScore > 0) {
      if (internacionalesScore > nacionalesScore) {
        return 'Internacionales'
      }
    }

    return scores[0].category
  }

  // Categoría por defecto basada en análisis secundario
  if (text.includes('argentina') || text.includes('argentino') || text.includes('nacional') || text.includes('país')) {
    return 'Nacionales'
  }
  
  if (text.includes('mundo') || text.includes('global') || text.includes('internacional')) {
    return 'Internacionales'
  }

  return 'Nacionales' // Categoría por defecto para contenido local
}

// @ts-expect-error: Deno is available in Supabase Edge Functions
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  console.log(`=== RSS PROCESSING STARTED at ${new Date().toISOString()} ===`)

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all active RSS sources
    const { data: rssSources, error: sourcesError } = await supabase
      .from('rss_sources')
      .select('id, url, category, source_type, scrape_selector, title_selector, description_selector, link_selector, date_selector, base_url')
      .eq('is_active', true)

    if (sourcesError) {
      console.error('Database error getting RSS sources:', sourcesError)
      return new Response(JSON.stringify({ 
        success: false,
        error: `Failed to get RSS sources: ${sourcesError.message}` 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }
      })
    }

    console.log(`Found ${rssSources?.length || 0} active RSS sources`)

    if (!rssSources || rssSources.length === 0) {
      console.log('No active RSS sources found')
      return new Response(JSON.stringify({
        success: true,
        total_articles_processed: 0,
        total_articles_inserted: 0,
        sources_processed: 0,
        message: 'No active RSS sources found'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    let totalArticlesProcessed = 0
    let totalArticlesInserted = 0
    let sourcesProcessed = 0

    for (const rssSource of rssSources) {
      console.log(`\n=== Processing RSS Source: ${rssSource.id} ===`)
      console.log(`URL: ${rssSource.url}`)
      console.log(`Category: ${rssSource.category}`)

      // Skip if processed recently (within last 2 hours) to reduce egress
      const lastUpdated = new Date(rssSource.updated_at || '1970-01-01')
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      if (lastUpdated > twoHoursAgo) {
        console.log(`Skipping ${rssSource.id} - processed recently at ${lastUpdated.toISOString()}`)
        continue
      }

      try {
        // Fetch RSS feed with retry
        const response = await fetchWithRetry(rssSource.url, {
          headers: {
            'User-Agent': 'Diario del Norte Grande RSS Reader/1.0'
          }
        })

        if (!response.ok) {
          console.log(`Failed to fetch RSS for ${rssSource.url}: ${response.status}`)
          continue
        }

        const rssText = await response.text()

        // Parse content based on source type
        const articles = rssSource.source_type === 'web'
          ? await scrapeWebsite(rssSource)
          : await parseRSS(rssText, rssSource.id, rssSource.category)

        console.log(`Parsed ${articles.length} articles from ${rssSource.url}`)
        totalArticlesProcessed += articles.length

        if (articles.length > 0) {
          // STEP 1: Upsert new articles (update existing, insert new)
          console.log(`Upserting ${articles.length} articles for ${rssSource.url}`)
          const { error: upsertError } = await supabase
            .from('articles')
            .upsert(articles, { onConflict: 'url' })

          if (upsertError) {
            console.error(`Failed to upsert articles for ${rssSource.url}:`, upsertError)
          } else {
            console.log(`✅ Successfully upserted articles for ${rssSource.url}`)
            totalArticlesInserted += articles.length
            sourcesProcessed++
          }
        } else {
          console.log(`No articles found for ${rssSource.url}, skipping upsert`)
          sourcesProcessed++
        }

        // Update RSS source timestamp
        await supabase
          .from('rss_sources')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', rssSource.id)

      } catch (error) {
        console.error(`Error processing RSS ${rssSource.url}:`, error)
      }
    }

    const result = {
      success: true,
      total_articles_processed: totalArticlesProcessed,
      total_articles_inserted: totalArticlesInserted,
      sources_processed: sourcesProcessed,
      message: `Processed ${sourcesProcessed} sources, replaced with ${totalArticlesInserted} articles`
    }

    console.log(`\n=== RSS PROCESSING COMPLETED ===`)
    console.log(result)

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  } catch (error) {
    console.error('Unexpected error in Edge Function:', error)
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: (error as Error).message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }
})


async function parseRSS(rssText: string, rssSourceId: string, category: string): Promise<Article[]> {
  console.log(`\n--- Parsing RSS for source ${rssSourceId} with category '${category}' ---`)

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  })

  let parsed
  try {
    parsed = parser.parse(rssText)
  } catch (error) {
    console.log(`XML parsing error: ${(error as Error).message}`)
    return []
  }

  // Find items in different possible structures
  type RSSItem = {
    title?: string
    description?: string
    'content:encoded'?: string
    link?: string
    guid?: string | { '#text'?: string; '@_isPermaLink'?: string }
    author?: string
    'dc:creator'?: string
    pubDate?: string
    enclosure?: { '@_url'?: string; '@_type'?: string }
    'media:content'?: { '@_url'?: string; '@_type'?: string }
    [key: string]: unknown
  }
  let items: RSSItem[] = []
  if (parsed.rss?.channel?.item) {
    items = Array.isArray(parsed.rss.channel.item) ? parsed.rss.channel.item : [parsed.rss.channel.item]
  } else if (parsed.channel?.item) {
    items = Array.isArray(parsed.channel.item) ? parsed.channel.item : [parsed.channel.item]
  } else if (parsed.item) {
    items = Array.isArray(parsed.item) ? parsed.item : [parsed.item]
  }

  console.log(`Found ${items.length} items in RSS feed`)

  const articles: Article[] = []

  for (let index = 0; index < items.length && index < 50; index++) {
    const item = items[index] // Limit to 50 articles per source
    const title = item.title
    const description = item.description || item['content:encoded']
    let link = item.link
    if (!link && item.guid) {
      link = typeof item.guid === 'string' ? item.guid : item.guid['#text'] || item.guid['@_isPermaLink']
    }
    const author = item.author || item['dc:creator']
    const pubDate = item.pubDate

    // Extract image URL from enclosure or media:content
    let imageUrl: string | undefined
    if (item.enclosure && typeof item.enclosure === 'object' && item.enclosure['@_type']?.startsWith('image/')) {
      imageUrl = item.enclosure['@_url']
    } else if (item['media:content'] && typeof item['media:content'] === 'object' && item['media:content']['@_type']?.startsWith('image/')) {
      imageUrl = item['media:content']['@_url']
    }

    // Create content summary from description or content:encoded
    const fullContent = item['content:encoded'] || description || ''
    const content = fullContent.replace(/<[^>]*>/g, '').substring(0, 200) + (fullContent.length > 200 ? '...' : '')

    console.log(`Item ${index}: title="${title}", link="${link}", image="${imageUrl}"`)

    if (title && link) {
      try {
        let publishedAt = new Date().toISOString()
        if (pubDate) {
          const parsedDate = new Date(pubDate)
          if (!isNaN(parsedDate.getTime())) {
            publishedAt = parsedDate.toISOString()
          }
        }

        const article: Article = {
          rss_source_id: rssSourceId,
          title,
          description: description || '',
          url: link,
          author: author || '',
          published_at: publishedAt,
          category: categorizeArticle(title, description || ''), // Usar nueva función de categorización
          created_at: new Date().toISOString(),
          image_url: imageUrl,
          content
        }

        articles.push(article)
      } catch (articleError) {
        console.error(`Error processing article "${title}":`, articleError)
        // Continue with next article instead of failing completely
      }
    }
  }

  console.log(`Successfully parsed ${articles.length} articles with category '${category}' for source ${rssSourceId}`)
  return articles
}

async function scrapeWebsite(rssSource: {
  id: string;
  url: string;
  category: string;
  source_type: string;
  scrape_selector: string;
  title_selector: string;
  description_selector: string;
  link_selector: string;
  date_selector: string;
  base_url: string;
}): Promise<Article[]> {
  console.log(`\n--- Web Scraping ${rssSource.base_url} with category '${rssSource.category}' ---`)

  try {
    // Fetch the webpage with retry
    const response = await fetchWithRetry(rssSource.base_url, {
      headers: {
        'User-Agent': 'Diario del Norte Grande RSS Reader/1.0'
      }
    })

    if (!response.ok) {
      console.log(`Failed to fetch webpage ${rssSource.base_url}: ${response.status}`)
      return []
    }

    const htmlText = await response.text()
    const $ = cheerioLoad(htmlText)

    const articles: Article[] = []

    // Collect article data first (synchronous)
    const articleData: Array<{title: string, description: string, link: string, dateText: string, imageUrl?: string, content: string}> = []

    $(rssSource.scrape_selector).each((index: number, element: CheerioElement) => {
      if (index >= 50) return false // Limit to 50 articles

      const $el = $(element)

      // Extract title
      const title = $el.find(rssSource.title_selector).first().text().trim() ||
                   $el.find('h1, h2, h3').first().text().trim() ||
                   $el.text().trim().split('\n')[0]?.trim()

      // Extract description
      const description = $el.find(rssSource.description_selector).first().text().trim() ||
                         $el.find('p').first().text().trim() ||
                         $el.text().trim()

      // Extract link
      let link = $el.find(rssSource.link_selector).first().attr('href') ||
                $el.find('a').first().attr('href')

      // Make link absolute if relative
      if (link && !link.startsWith('http')) {
        link = new URL(link, rssSource.base_url).href
      }

      // Extract date
      const dateText = $el.find(rssSource.date_selector).first().text().trim() ||
                      $el.find('time').first().attr('datetime') ||
                      $el.find('.date, .published').first().text().trim()

      // Extract image URL
      let imageUrl = $el.find('img').first().attr('src')
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = new URL(imageUrl, rssSource.base_url).href
      }

      // Create content summary
      const fullText = $el.text().trim()
      const content = fullText.substring(0, 200) + (fullText.length > 200 ? '...' : '')

      if (title && link) {
        articleData.push({ title, description: description || '', link, dateText, imageUrl, content })
      }
    })

    // Process articles asynchronously
    for (const data of articleData) {
      try {
        console.log(`Processing article: title="${data.title.substring(0, 50)}", link="${data.link}", image="${data.imageUrl}"`)

        let publishedAt = new Date().toISOString()
        if (data.dateText) {
          const parsedDate = new Date(data.dateText)
          if (!isNaN(parsedDate.getTime())) {
            publishedAt = parsedDate.toISOString()
          }
        }

        const article: Article = {
          rss_source_id: rssSource.id,
          title: data.title,
          description: data.description,
          url: data.link,
          author: '',
          published_at: publishedAt,
          category: categorizeArticle(data.title, data.description), // Usar nueva función de categorización
          created_at: new Date().toISOString(),
          image_url: data.imageUrl,
          content: data.content
        }

        articles.push(article)
      } catch (error) {
        console.error(`Error processing article "${data.title}":`, error)
      }
    }

    console.log(`Successfully scraped ${articles.length} articles from ${rssSource.base_url}`)
    return articles

  } catch (error) {
    console.error(`Error scraping website ${rssSource.base_url}:`, error)
    return []
  }
}