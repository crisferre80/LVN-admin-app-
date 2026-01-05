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

export interface ResearchResult {
  title: string;
  snippet: string;
  source: string;
  url?: string;
}

/**
 * Busca información sobre un tema usando la API de búsqueda de Google Custom Search
 */
export async function searchWebForTopic(topic: string): Promise<string> {
  try {
    console.log('🔍 Iniciando investigación web para tema:', topic);
    
    // Primero intentar con NewsAPI (más confiable para noticias)
    console.log('📰 Intentando NewsAPI...');
    const newsApiResults = await searchWithNewsAPI(topic);
    
    if (newsApiResults.length > 0) {
      console.log(`✅ NewsAPI encontró ${newsApiResults.length} resultados`);
      return formatResearchResults(newsApiResults);
    }
    console.log('❌ NewsAPI no encontró resultados o no está configurado');

    // Si no hay NewsAPI, usar Google Custom Search
    console.log('🔍 Intentando Google Custom Search...');
    const googleResults = await searchWithGoogleCustomSearch(topic);
    
    if (googleResults.length > 0) {
      console.log(`✅ Google Custom Search encontró ${googleResults.length} resultados`);
      return formatResearchResults(googleResults);
    }
    console.log('❌ Google Custom Search no encontró resultados o no está configurado');

    // Si no hay Google Custom Search, usar DuckDuckGo como fallback
    console.log('🦆 Intentando DuckDuckGo...');
    const duckDuckGoResults = await searchWithDuckDuckGo(topic);
    console.log(`✅ DuckDuckGo encontró ${duckDuckGoResults.length} resultados`);
    return formatResearchResults(duckDuckGoResults);

  } catch (error) {
    console.error('❌ Error en investigación web:', error);
    return '';
  }
}

/**
 * Busca usando Google Custom Search API
 */
async function searchWithGoogleCustomSearch(topic: string): Promise<ResearchResult[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY;
  const searchEngineId = import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    console.log('Google Custom Search no configurado, usando fallback');
    return [];
  }

  try {
    // Construir query con filtro de sitios de noticias y Argentina
    const siteQuery = NEWS_SOURCES.map(s => `site:${s}`).join(' OR ');
    const query = `${topic} Argentina (${siteQuery})`;

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=5`;

    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Error en Google Custom Search:', response.status);
      return [];
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return [];
    }

    return data.items.map((item: any) => ({
      title: item.title,
      snippet: item.snippet,
      source: new URL(item.link).hostname,
      url: item.link
    }));

  } catch (error) {
    console.error('Error en Google Custom Search:', error);
    return [];
  }
}

/**
 * Busca usando DuckDuckGo (sin necesidad de API key)
 */
async function searchWithDuckDuckGo(topic: string): Promise<ResearchResult[]> {
  try {
    // DuckDuckGo Instant Answer API
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(topic + ' Argentina noticias')}&format=json&no_redirect=1`;

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
function formatResearchResults(results: ResearchResult[]): string {
  if (results.length === 0) {
    return '';
  }

  // Limitar a los 3 resultados más relevantes para no saturar el prompt
  const topResults = results.slice(0, 3);
  
  let formatted = '📰 INFORMACIÓN DE CONTEXTO (resumida de medios reconocidos):\n\n';

  topResults.forEach((result, index) => {
    formatted += `${index + 1}. ${result.source}: ${result.snippet}\n\n`;
  });

  formatted += '⚠️ IMPORTANTE: Esta información es solo CONTEXTO y REFERENCIA. Debes:\n';
  formatted += '- Escribir el artículo con tus propias palabras\n';
  formatted += '- Verificar y expandir la información\n';
  formatted += '- Mantener objetividad periodística\n';
  formatted += '- Enfocarte en el tema principal solicitado\n';

  return formatted;
}

/**
 * Busca usando NewsAPI (requiere API key)
 */
export async function searchWithNewsAPI(topic: string): Promise<ResearchResult[]> {
  const apiKey = import.meta.env.VITE_NEWS_API_KEY;

  if (!apiKey) {
    console.log('NewsAPI no configurado');
    return [];
  }

  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(topic + ' Argentina')}&language=es&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Error en NewsAPI:', response.status);
      return [];
    }

    const data = await response.json();

    if (!data.articles || data.articles.length === 0) {
      return [];
    }

    return data.articles.map((article: any) => ({
      title: article.title,
      snippet: article.description || article.content?.substring(0, 200),
      source: article.source.name,
      url: article.url
    }));

  } catch (error) {
    console.error('Error en NewsAPI:', error);
    return [];
  }
}
