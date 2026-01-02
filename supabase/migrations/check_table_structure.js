import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Función para verificar la estructura de la tabla articles
async function checkArticlesTableStructure() {
  try {
    console.log('🔍 Verificando estructura de la tabla articles...\n');

    // Intentar obtener un artículo para ver las columnas disponibles
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error obteniendo datos:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('📋 Columnas disponibles en la tabla articles:');
      Object.keys(data[0]).forEach((col, index) => {
        console.log(`${index + 1}. ${col}`);
      });
      console.log(`\n✅ Total de columnas: ${Object.keys(data[0]).length}`);
    } else {
      console.log('⚠️ La tabla articles existe pero está vacía');
      console.log('💡 Puedes poblar datos de prueba ejecutando: npm run populate-test-articles');
    }

  } catch (error) {
    console.error('❌ Error en la verificación:', error);
  }
}

// Ejecutar la función
checkArticlesTableStructure();