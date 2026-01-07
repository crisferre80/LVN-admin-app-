import { supabase } from './supabase';

/**
 * Gestiona el estado destacado de artículos automáticamente.
 * Marca nuevos artículos como destacados y desmarca artículos destacados de días anteriores.
 */
export const manageFeaturedStatus = async () => {
  try {
    console.log('🎯 Gestionando estado destacado de artículos...');

    // Obtener la fecha actual (sin hora)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // Función auxiliar para desmarcar artículos de días anteriores
    const unmarkOldFeatured = async (tableName: string) => {
      try {
        const { data: featuredArticles, error: fetchError } = await supabase
          .from(tableName)
          .select('id, title, created_at, is_featured')
          .eq('is_featured', true);

        if (fetchError) {
          // Si la columna no existe, continuar sin error
          if (fetchError.code === '42703') {
            console.log(`ℹ️ La tabla ${tableName} no tiene columna is_featured, omitiendo`);
            return 0;
          }
          console.error(`Error al buscar artículos destacados en ${tableName}:`, fetchError);
          return 0;
        }

        // Filtrar artículos que no sean de hoy
        const articlesToUnmark = featuredArticles?.filter(article => {
          const articleDate = new Date(article.created_at).toISOString().split('T')[0];
          return articleDate !== todayISO;
        }) || [];

        if (articlesToUnmark.length > 0) {
          const articleIds = articlesToUnmark.map(article => article.id);
          const { error: updateError } = await supabase
            .from(tableName)
            .update({ is_featured: false })
            .in('id', articleIds);

          if (updateError) {
            console.error(`Error al desmarcar artículos destacados en ${tableName}:`, updateError);
            return 0;
          } else {
            console.log(`✅ Desmarcados ${articleIds.length} artículos destacados de días anteriores en ${tableName}`);
            return articleIds.length;
          }
        }
        return 0;
      } catch (error) {
        console.error(`Error procesando tabla ${tableName}:`, error);
        return 0;
      }
    };

    // Desmarcar artículos destacados de días anteriores en todas las tablas
    const tables = ['ai_generated_articles', 'articles', 'local_news'];
    let totalUnmarked = 0;

    for (const table of tables) {
      try {
        const unmarked = await unmarkOldFeatured(table);
        totalUnmarked += unmarked;
      } catch (error) {
        console.error(`Error procesando tabla ${table}:`, error);
      }
    }

    if (totalUnmarked === 0) {
      console.log('✅ No hay artículos destacados de días anteriores para desmarcar');
    } else {
      console.log(`🎯 Total de artículos desmarcados: ${totalUnmarked}`);
    }
  } catch (error) {
    console.error('Error en manageFeaturedStatus:', error);
  }
};