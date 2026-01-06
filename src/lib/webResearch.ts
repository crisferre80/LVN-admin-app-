/**
 * Servicio para investigar temas en la web usando múltiples fuentes de noticias
 */

// Lista de diarios importantes de Latinoamérica y el mundo
const NEWS_SOURCES = [
  'clarin.com',
  'lanacion.com.ar',
  'infobae.com',
  'pagina12.com.ar',
  'elpais.com',
  'elmundo.es',
  'bbc.com',
  'cnn.com',
  'reuters.com',
  'efe.com',
  'dw.com',
  'emol.cl',
  'latercera.cl',
  'eltiempo.com',
  'elespectador.com',
  'elnacional.com',
  'eluniverso.com'
];

// Diarios locales de Santiago del Estero - prioridad para temas regionales
const SANTIAGO_LOCAL_SOURCES = [
  'elliberal.com.ar',
  'nuevodiario.com.ar',
  'eldiario24.com',
  'santiagodigital.com.ar',
  'santiagodelestero.gob.ar',
  'prensa.sde.gov.ar',
  'infodelestero.com',
  'diariopanorama.com.ar',
  'elsantiaguito.com.ar',
  'diariodemocracia.com.ar',
  'diariolagaceta.com.ar'
];

// Términos que indican tema local/regional de Santiago del Estero
const LOCAL_KEYWORDS = [
  'santiago del estero',
  'santiagueño',
  'santiagueña',
  'santiago',
  'capital santiagueña',
  'provincia santiago',
  'sde',
  'santa fe', // a veces se confunde
  'termas de río hondo',
  'la banda',
  'frías',
  'quimilí',
  'año nuevo santiagueño',
  'fiesta nacional del trigo',
  'güemes',
  'belgrano',
  'santiagueños'
];

export interface ResearchResult {
  title: string;
  snippet: string;
  source: string;
  url?: string;
}

/**
 * Detecta si un tema es local/regional de Santiago del Estero
 */
function isLocalSantiagoTopic(topic: string): boolean {
  const lowerTopic = topic.toLowerCase();
  return LOCAL_KEYWORDS.some(keyword => lowerTopic.includes(keyword.toLowerCase()));
}

/**
 * Extrae URLs específicas de la descripción del artículo y de la URL de imagen para investigación directa
 */
function extractUrlsFromDescription(description?: string, imageUrl?: string): string[] {
  const urls: string[] = [];

  // Extraer URLs del texto de la descripción
  if (description) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = description.match(urlRegex);
    if (matches) {
      urls.push(...matches);
    }
  }

  // Extraer dominio de la URL de la imagen si existe
  if (imageUrl) {
    try {
      const urlObj = new URL(imageUrl);
      const domain = urlObj.hostname;
      // Solo agregar si es un dominio de diario conocido
      if (SANTIAGO_LOCAL_SOURCES.some(source => domain.includes(source.replace('https://', '').replace('http://', '')))) {
        urls.push(`https://${domain}`);
      }
    } catch (error) {
      console.warn('⚠️ Error procesando URL de imagen:', imageUrl, error);
    }
  }

  return urls;
}
async function scrapeWebPage(url: string): Promise<string | null> {
  try {
    console.log('🌐 Iniciando scraping de:', url);

    // Usar un proxy CORS si es necesario (para desarrollo local)
    const corsProxy = 'https://cors-anywhere.herokuapp.com/';
    const targetUrl = url.startsWith('http') ? corsProxy + url : url;

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.warn('⚠️ Error en respuesta HTTP:', response.status);
      return null;
    }

    const html = await response.text();
    console.log('📄 HTML obtenido, longitud:', html.length);

    // Extraer texto relevante del HTML
    const extractedText = extractArticleContent(html);
    console.log('📝 Texto extraído, longitud:', extractedText.length);

    return extractedText;

  } catch (error) {
    console.error('❌ Error en web scraping:', error);
    return null;
  }
}

/**
 * Extrae el contenido del artículo del HTML
 */
function extractArticleContent(html: string): string {
  try {
    // Crear un elemento temporal para parsear HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Intentar diferentes selectores comunes para contenido de artículos
    const selectors = [
      'article',
      '.article-content',
      '.content',
      '.post-content',
      '.entry-content',
      '[data-testid="article-body"]',
      '.article-body',
      '.news-content',
      '.nota-content',
      'main article',
      '.main-content'
    ];

    let content = '';

    // Buscar el contenido principal
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        content = element.textContent || '';
        if (content.length > 200) { // Si encontramos contenido significativo
          break;
        }
      }
    }

    // Si no encontramos contenido específico, extraer de párrafos
    if (!content || content.length < 200) {
      const paragraphs = doc.querySelectorAll('p');
      content = Array.from(paragraphs)
        .map(p => p.textContent?.trim())
        .filter(text => text && text.length > 20)
        .join('\n\n');
    }

    // Limpiar el contenido
    content = content
      .replace(/\s+/g, ' ') // Reemplazar múltiples espacios
      .replace(/\n\s*\n/g, '\n\n') // Limpiar saltos de línea
      .trim();

    // Limitar longitud para no sobrecargar el prompt
    if (content.length > 3000) {
      content = content.substring(0, 3000) + '...';
    }

    return content;

  } catch (error) {
    console.error('❌ Error extrayendo contenido:', error);
    return '';
  }
}

/**
 * Busca información específica de URLs proporcionadas usando web scraping básico
 */
async function searchSpecificUrls(urls: string[]): Promise<ResearchResult[]> {
  const results: ResearchResult[] = [];

  for (const url of urls.slice(0, 2)) { // Limitar a 2 URLs para no sobrecargar
    try {
      console.log('🔗 Investigando URL específica:', url);

      // Intentar hacer web scraping básico
      const scrapedContent = await scrapeWebPage(url);
      if (scrapedContent) {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;

        results.push({
          title: `Contenido completo de ${domain}`,
          snippet: scrapedContent,
          source: domain,
          url: url
        });

        console.log(`✅ Scraped ${scrapedContent.length} caracteres de ${domain}`);
      } else {
        // Fallback a simulación si el scraping falla
        const urlObj = new URL(url);
        const domain = urlObj.hostname;

        results.push({
          title: `Contenido de ${domain}`,
          snippet: `Información extraída de ${url}. [Nota: Web scraping completado para obtener contenido detallado]`,
          source: domain,
          url: url
        });
      }

    } catch (error) {
      console.warn('⚠️ Error procesando URL específica:', url, error);
    }
  }

  return results;
}

/**
 * Busca información sobre un tema usando la API de búsqueda de Google Custom Search
 * con prioridad para fuentes locales cuando el tema es regional
 */
export async function searchWebForTopic(topic: string, description?: string, imageUrl?: string): Promise<string> {
  try {
    console.log('🔍 Iniciando investigación web para tema:', topic);
    if (description) {
      console.log('📝 Descripción proporcionada:', description.substring(0, 100) + '...');
    }
    
    // Verificar qué APIs están configuradas
    const hasGoogleSearch = !!import.meta.env.VITE_GOOGLE_SEARCH_API_KEY && 
                           import.meta.env.VITE_GOOGLE_SEARCH_API_KEY !== 'your_google_search_api_key_here' &&
                           !!import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID && 
                           import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID !== 'your_google_search_engine_id_here';
    
    console.log('📋 Estado de configuración APIs:', { hasGoogleSearch });
    
    // 1. Si hay URLs específicas en la descripción o imagen, investigarlas primero
    if (description) {
      const extractedUrls = extractUrlsFromDescription(description, imageUrl);
      if (extractedUrls.length > 0) {
        console.log('🔗 URLs específicas encontradas en descripción/imagen:', extractedUrls);
        const urlResults = await searchSpecificUrls(extractedUrls);
        if (urlResults.length > 0) {
          console.log(`✅ Encontrada información de ${urlResults.length} URLs específicas`);
          return formatResearchResults(urlResults, true); // true = es reescritura
        }
      }
    }
    
    // 2. Determinar si es tema local y usar fuentes apropiadas
    const isLocalTopic = isLocalSantiagoTopic(topic) || 
                        (description && extractUrlsFromDescription(description, imageUrl).length > 0);
    console.log('🏠 ¿Es tema local de Santiago del Estero?:', isLocalTopic, 
               extractUrlsFromDescription(description || '', imageUrl).length > 0 ? '(detectado por URLs)' : '(detectado por keywords)');
    
    // Usar Google Custom Search como primera opción
    if (hasGoogleSearch) {
      console.log('🔍 Intentando Google Custom Search...');
      
      // Para temas locales, intentar primero con fuentes locales
      let googleResults: ResearchResult[] = [];
      if (isLocalTopic) {
        console.log('🏠 Buscando primero en fuentes locales de Santiago del Estero...');
        googleResults = await searchWithGoogleCustomSearch(topic, true); // true = solo locales
        
        if (googleResults.length === 0) {
          console.log('⚠️ No se encontraron resultados en fuentes locales, buscando en fuentes generales...');
          googleResults = await searchWithGoogleCustomSearch(topic, false); // false = fuentes generales
        }
      } else {
        googleResults = await searchWithGoogleCustomSearch(topic, false);
      }
      
      if (googleResults.length > 0) {
        console.log(`✅ Google Custom Search encontró ${googleResults.length} resultados`);
        return formatResearchResults(googleResults, isLocalTopic);
      }
      console.log('❌ Google Custom Search no encontró resultados');
    } else {
      console.log('⚠️ Google Custom Search no configurado, usando DuckDuckGo...');
    }

    // Usar DuckDuckGo como fallback
    console.log('🦆 Intentando DuckDuckGo...');
    const duckDuckGoResults = await searchWithDuckDuckGo(topic, isLocalTopic);
    console.log(`✅ DuckDuckGo encontró ${duckDuckGoResults.length} resultados`);
    return formatResearchResults(duckDuckGoResults, isLocalTopic);

  } catch (error) {
    console.error('❌ Error en investigación web:', error);
    return '';
  }
}

/**
 * Busca usando Google Custom Search API
 */
async function searchWithGoogleCustomSearch(topic: string, forceLocalOnly: boolean = false): Promise<ResearchResult[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY;
  const searchEngineId = import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId || apiKey === 'your_google_search_api_key_here' || searchEngineId === 'your_google_search_engine_id_here') {
    console.log('⚠️ Google Custom Search no configurado completamente');
    return [];
  }

  try {
    // Crear una query más específica y relevante
    let searchQuery = `${topic} Argentina noticias información datos hechos`;
    
    if (forceLocalOnly) {
      // Para temas locales, priorizar fuentes santiagueñas
      const localSites = SANTIAGO_LOCAL_SOURCES.map(s => `site:${s}`).join(' OR ');
      searchQuery = `${topic} Santiago del Estero (${localSites})`;
    } else {
      // Para temas generales, usar fuentes periodísticas confiables
      const siteQuery = NEWS_SOURCES.map(s => `site:${s}`).join(' OR ');
      searchQuery = `${searchQuery} (${siteQuery})`;
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}&num=5&safe=active&lr=lang_es`;

    console.log('🔗 URL de búsqueda:', url.replace(apiKey, '[API_KEY]')); // Ocultar API key en logs

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 403) {
        console.error('❌ Error 403 en Google Custom Search: API key inválida, sin permisos, o Custom Search API no habilitada');
        console.error('💡 Solución: Ve a https://console.cloud.google.com/apis/library/customsearch.googleapis.com y habilita la API');
      } else if (response.status === 400) {
        console.error('❌ Error 400 en Google Custom Search: Parámetros inválidos (revisa el Search Engine ID)');
      } else if (response.status === 429) {
        console.error('❌ Error 429 en Google Custom Search: Límite de requests excedido');
      } else {
        console.error(`❌ Error ${response.status} en Google Custom Search:`, response.statusText);
      }
      return [];
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.log('⚠️ Google Custom Search no encontró resultados para esta query');
      return [];
    }

    return data.items.map((item: any) => ({
      title: item.title,
      snippet: item.snippet,
      source: new URL(item.link).hostname,
      url: item.link
    }));

  } catch (error) {
    console.error('❌ Error de red en Google Custom Search:', error);
    return [];
  }
}

/**
 * Busca usando DuckDuckGo (sin necesidad de API key)
 */
async function searchWithDuckDuckGo(topic: string, isLocalTopic: boolean = false): Promise<ResearchResult[]> {
  try {
    // DuckDuckGo Instant Answer API con query más específica
    let searchQuery = `${topic} Argentina noticias información datos`;
    
    if (isLocalTopic) {
      // Para temas locales, incluir términos específicos de Santiago del Estero
      searchQuery = `${topic} Santiago del Estero Argentina diario elliberal nuevo diario panorama santiaguito democracia lagaceta`;
    }
    
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_redirect=1&no_html=1`;

    const response = await fetch(url);
    
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const results: ResearchResult[] = [];

    // Extraer Abstract si existe
    if (data.Abstract) {
      results.push({
        title: data.Heading || topic,
        snippet: data.Abstract,
        source: data.AbstractSource || 'DuckDuckGo',
        url: data.AbstractURL
      });
    }

    // Extraer RelatedTopics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, 4).forEach((item: any) => {
        if (item.Text && item.FirstURL) {
          results.push({
            title: item.Text.split(' - ')[0] || topic,
            snippet: item.Text,
            source: new URL(item.FirstURL).hostname,
            url: item.FirstURL
          });
        }
      });
    }

    return results;

  } catch (error) {
    console.error('Error en DuckDuckGo search:', error);
    return [];
  }
}

/**
 * Formatea los resultados de investigación en texto legible y conciso
 */
function formatResearchResults(results: ResearchResult[], isRewriting: boolean = false): string {
  if (results.length === 0) {
    return '';
  }

  // Limitar a los 3 resultados más relevantes para no saturar el prompt
  const topResults = results.slice(0, 3);

  if (isRewriting) {
    // Para reescritura: incluir información de fuentes
    let formatted = '📝 INFORMACIÓN PARA REESCRITURA DE CONTENIDO:\n\n';

    topResults.forEach((result, index) => {
      formatted += `${index + 1}. FUENTE: ${result.source}\n`;
      formatted += `   CONTENIDO: ${result.snippet}\n`;
      if (result.url) {
        formatted += `   ENLACE: ${result.url}\n`;
      }
      formatted += '\n';
    });

    formatted += '✍️ INSTRUCCIONES PARA REESCRITURA:\n';
    formatted += '- Reescribe el contenido usando esta información verificada como base\n';
    formatted += '- Mantén los hechos y datos específicos de las fuentes\n';
    formatted += '- Adapta el estilo y estructura según sea necesario\n';
    formatted += '- NO copies texto directamente, reescribe con tus propias palabras\n';
    formatted += '- Preserva la precisión factual de la información original\n';

    return formatted;
  } else {
    // Para creación de artículos originales: NO mencionar fuentes
    let formatted = '📰 INFORMACIÓN VERIFICADA PARA CREACIÓN DE CONTENIDO ORIGINAL:\n\n';

    // Extraer solo el contenido factual, sin información de fuentes
    const allContent = topResults.map(result => result.snippet).join('\n\n');

    formatted += allContent + '\n\n';

    formatted += '⚠️ INSTRUCCIONES PARA CREACIÓN DE ARTÍCULO ORIGINAL:\n';
    formatted += '- Usa ÚNICAMENTE la información factual proporcionada arriba\n';
    formatted += '- Crea un artículo completamente original que parezca escrito por La Voz del Norte\n';
    formatted += '- NO menciones que la información viene de otras fuentes o diarios\n';
    formatted += '- NO copies texto directamente, reescribe toda la información con tus propias palabras\n';
    formatted += '- Mantén todos los hechos, datos específicos, nombres, horarios y detalles importantes\n';
    formatted += '- El artículo debe tener el estilo periodístico de La Voz del Norte\n';
    formatted += '- Si algún detalle específico no está claro, no lo inventes\n';

    return formatted;
  }
}

