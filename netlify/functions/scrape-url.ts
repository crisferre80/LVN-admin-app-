import { Handler } from '@netlify/functions';
import axios from 'axios';
import * as cheerio from 'cheerio';

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const { url } = JSON.parse(event.body || '{}');

  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'URL is required' }),
    };
  }

  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    const $ = cheerio.load(data);

    // Intenta encontrar el contenido principal del artículo.
    // Estas son heurísticas comunes y pueden necesitar ajustes para sitios específicos.
    $('script, style, nav, footer, header, .ad, .ads, .sidebar, .comments, .related-posts').remove();
    
    let mainContent = $('article').text() || $('main').text() || $('.post-content').text() || $('.entry-content').text() || $('.article-body').text();

    if (!mainContent) {
      // Como último recurso, toma todo el body y límpialo.
      mainContent = $('body').text();
    }

    // Limpieza del texto
    const cleanedText = mainContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    return {
      statusCode: 200,
      body: JSON.stringify({ content: cleanedText }),
    };
  } catch (error: any) {
    console.error('Error scraping URL:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Failed to scrape URL: ${error.message}` }),
    };
  }
};

export { handler };
