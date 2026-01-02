// Edge Function para extraer resultados de lotería desde lotemovil.com.ar
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts';

const LOTTERY_URL = 'https://sde.lotemovil.com.ar';

// Mapeo de códigos de imputación a tipos de juego
const GAME_TYPE_MAP: Record<string, string> = {
  '0': 'tombola',
  '1': 'monofechas',
  '2': 'lotoplus',
  '3': 'pozo',
  '4': 'loto5plus',
  '5': 'quini6',
  '6': 'loteriaimpresa',
  '7': 'monobingo',
  '8': 'telekino',
};

interface LotteryResult {
  draw_date: string;
  game_type: string;
  draw_time: string | null;
  numbers: number[];
  additional_data?: Record<string, any>;
  source_url: string;
}

// Función para extraer números del HTML usando deno_dom
function extractNumbersFromDOM(element: any): number[] {
  const numbers: number[] = [];
  
  if (!element) return numbers;
  
  // Buscar todos los elementos que contienen números
  // Los números están en divs con clase "ball" dentro de divs con clase "numero"
  const ballElements = element.querySelectorAll('.ball, .bola');
  
  for (const el of ballElements) {
    const text = el.textContent?.trim();
    if (text) {
      // Eliminar ceros a la izquierda y convertir a número
      const num = parseInt(text, 10);
      if (!isNaN(num) && num >= 0 && num <= 99) {
        numbers.push(num);
      }
    }
  }
  
  // Si no encontramos con .ball, intentar con otros selectores
  if (numbers.length === 0) {
    const altElements = element.querySelectorAll('.numero div, [class*="numero"] div');
    for (const el of altElements) {
      const text = el.textContent?.trim();
      if (text) {
        const num = parseInt(text, 10);
        if (!isNaN(num) && num >= 0 && num <= 99) {
          numbers.push(num);
        }
      }
    }
  }
  
  // Eliminar duplicados y retornar
  return Array.from(new Set(numbers));
}

// Función para extraer la fecha de un elemento
function extractDateFromDOM(element: any): string {
  if (!element) return new Date().toISOString().split('T')[0];
  
  // Buscar elementos con fecha
  const dateSelectors = [
    '.fecha', '.date', '[class*="fecha"]', '[class*="date"]'
  ];
  
  for (const selector of dateSelectors) {
    const dateElement = element.querySelector(selector);
    if (dateElement) {
      const text = dateElement.textContent?.trim();
      if (text) {
        // Intentar parsear DD/MM/YYYY
        const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) {
          const [_, day, month, year] = match;
          return `${year}-${month}-${day}`;
        }
      }
    }
  }
  
  // Buscar en atributos data-fecha, data-date
  const dataDate = element.getAttribute?.('data-fecha') || element.getAttribute?.('data-date');
  if (dataDate) {
    const match = dataDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      const [_, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
  }
  
  // Si no se encuentra, usar fecha actual
  return new Date().toISOString().split('T')[0];
}

// Función mejorada para parsear la página usando deno_dom
async function scrapeLotteryResults(): Promise<LotteryResult[]> {
  try {
    console.log('Descargando página de lotería...');
    const response = await fetch(LOTTERY_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    console.log(`Página descargada, tamaño: ${html.length} bytes`);

    // Parsear el HTML con deno_dom
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('No se pudo parsear el HTML');
    }

    const results: LotteryResult[] = [];
    const today = new Date().toISOString().split('T')[0];

    console.log('Parseando HTML con deno_dom...');

    // Intentar extraer Tómbola
    try {
      const tombolaSection = doc.querySelector('#section-tombola');
      if (tombolaSection) {
        console.log('Sección de Tómbola encontrada');
        const numbers = extractNumbersFromDOM(tombolaSection);
        const date = extractDateFromDOM(tombolaSection) || today;
        
        if (numbers.length > 0) {
          results.push({
            draw_date: date,
            game_type: 'tombola',
            draw_time: 'nocturna',
            numbers: numbers.slice(0, 20), // Tómbola tiene 20 números
            source_url: LOTTERY_URL,
            additional_data: {
              numbers_found: numbers.length,
              extraction_method: 'deno_dom',
            },
          });
          console.log(`✓ Tómbola: ${numbers.length} números encontrados`);
        } else {
          console.log('⚠ Tómbola: sección encontrada pero sin números');
        }
      } else {
        console.log('⚠ Sección de Tómbola no encontrada');
      }
    } catch (err) {
      console.error('Error extrayendo Tómbola:', err);
    }

    // Intentar extraer MonoFechas
    try {
      const monofechasSection = doc.querySelector('#section-monofechas');
      if (monofechasSection) {
        console.log('Sección de MonoFechas encontrada');
        const numbers = extractNumbersFromDOM(monofechasSection);
        const date = extractDateFromDOM(monofechasSection) || today;
        
        if (numbers.length > 0) {
          results.push({
            draw_date: date,
            game_type: 'monofechas',
            draw_time: null,
            numbers: numbers,
            source_url: LOTTERY_URL,
            additional_data: {
              numbers_found: numbers.length,
              extraction_method: 'deno_dom',
            },
          });
          console.log(`✓ MonoFechas: ${numbers.length} números encontrados`);
        }
      }
    } catch (err) {
      console.error('Error extrayendo MonoFechas:', err);
    }

    // Intentar extraer Loto Plus
    try {
      const lotoplusSection = doc.querySelector('#section-lotoplus');
      if (lotoplusSection) {
        console.log('Sección de Loto Plus encontrada');
        const numbers = extractNumbersFromDOM(lotoplusSection);
        const date = extractDateFromDOM(lotoplusSection) || today;
        
        if (numbers.length > 0) {
          results.push({
            draw_date: date,
            game_type: 'lotoplus',
            draw_time: null,
            numbers: numbers,
            source_url: LOTTERY_URL,
            additional_data: {
              numbers_found: numbers.length,
              extraction_method: 'deno_dom',
            },
          });
          console.log(`✓ Loto Plus: ${numbers.length} números encontrados`);
        }
      }
    } catch (err) {
      console.error('Error extrayendo Loto Plus:', err);
    }

    // Intentar extraer Quini6
    try {
      const quini6Section = doc.querySelector('#section-quini6');
      if (quini6Section) {
        console.log('Sección de Quini6 encontrada');
        const numbers = extractNumbersFromDOM(quini6Section);
        const date = extractDateFromDOM(quini6Section) || today;
        
        if (numbers.length > 0) {
          results.push({
            draw_date: date,
            game_type: 'quini6',
            draw_time: null,
            numbers: numbers.slice(0, 6), // Quini6 tiene 6 números
            source_url: LOTTERY_URL,
            additional_data: {
              numbers_found: numbers.length,
              extraction_method: 'deno_dom',
            },
          });
          console.log(`✓ Quini6: ${numbers.length} números encontrados`);
        }
      }
    } catch (err) {
      console.error('Error extrayendo Quini6:', err);
    }

    // Intentar extraer TeleKino
    try {
      const telekinoSection = doc.querySelector('#section-telekino');
      if (telekinoSection) {
        console.log('Sección de TeleKino encontrada');
        const numbers = extractNumbersFromDOM(telekinoSection);
        const date = extractDateFromDOM(telekinoSection) || today;
        
        if (numbers.length > 0) {
          results.push({
            draw_date: date,
            game_type: 'telekino',
            draw_time: null,
            numbers: numbers,
            source_url: LOTTERY_URL,
            additional_data: {
              numbers_found: numbers.length,
              extraction_method: 'deno_dom',
            },
          });
          console.log(`✓ TeleKino: ${numbers.length} números encontrados`);
        }
      }
    } catch (err) {
      console.error('Error extrayendo TeleKino:', err);
    }

    console.log(`Total de resultados extraídos: ${results.length}`);
    
    if (results.length === 0) {
      console.log('⚠ ADVERTENCIA: No se encontraron resultados');
      console.log('El sitio puede cargar datos dinámicamente con JavaScript');
      console.log('Revise los selectores CSS o considere usar Puppeteer');
    }
    
    return results;
  } catch (error) {
    console.error('Error scraping lottery results:', error);
    throw error;
  }
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Obtener credenciales de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Iniciando extracción de resultados de lotería...');
    
    // Extraer resultados
    const results = await scrapeLotteryResults();

    if (results.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No se pudieron extraer resultados. El sitio web parece cargar los datos dinámicamente con JavaScript.',
          results_inserted: 0,
          technical_details: {
            site_url: LOTTERY_URL,
            parser_used: 'deno_dom',
            issue: 'No se encontraron números en las secciones HTML. Es probable que los datos se carguen dinámicamente con JavaScript.',
            next_steps: [
              'Verificar si el sitio está funcionando correctamente',
              'Revisar los selectores CSS utilizados',
              'Considerar implementar un navegador headless (Puppeteer/Playwright)',
              'Buscar una API oficial alternativa',
            ],
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Insertar resultados en la base de datos
    let insertedCount = 0;
    const errors: any[] = [];

    for (const result of results) {
      try {
        // Usar upsert para evitar duplicados
        const { error } = await supabase
          .from('lottery_results')
          .upsert(
            {
              draw_date: result.draw_date,
              game_type: result.game_type,
              draw_time: result.draw_time,
              numbers: result.numbers,
              additional_data: result.additional_data || {},
              source_url: result.source_url,
            },
            {
              onConflict: 'draw_date,game_type,draw_time',
            }
          );

        if (error) {
          console.error('Error insertando resultado:', error);
          errors.push({
            game: result.game_type,
            date: result.draw_date,
            error: error.message,
          });
        } else {
          insertedCount++;
          console.log(`✓ ${result.game_type} ${result.draw_time || ''} - ${result.draw_date}`);
        }
      } catch (err) {
        console.error('Error procesando resultado:', err);
        errors.push({
          game: result.game_type,
          error: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    }

    console.log(`Proceso completado: ${insertedCount} resultados insertados/actualizados`);

    return new Response(
      JSON.stringify({
        success: true,
        results_inserted: insertedCount,
        total_results: results.length,
        errors: errors.length > 0 ? errors : undefined,
        results: results.map((r) => ({
          game: r.game_type,
          time: r.draw_time,
          date: r.draw_date,
          numbers_count: r.numbers.length,
        })),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error en fetch_lottery:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
