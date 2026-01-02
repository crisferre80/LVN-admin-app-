import { supabase } from '../lib/supabase';

export async function testSupabaseConnection() {
  console.log('🔍 Probando conexión a Supabase...');

  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('articles')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Error de conexión básica:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Conexión básica exitosa. Artículos encontrados:', data);

    // Test AI articles table
    const { data: aiData, error: aiError } = await supabase
      .from('ai_generated_articles')
      .select('count', { count: 'exact', head: true });

    if (aiError) {
      console.warn('⚠️ Tabla ai_generated_articles no disponible:', aiError.message);
    } else {
      console.log('✅ Tabla AI disponible. Artículos AI encontrados:', aiData);
    }

    // Test local news table
    const { data: localData, error: localError } = await supabase
      .from('local_news')
      .select('count', { count: 'exact', head: true });

    if (localError) {
      console.warn('⚠️ Tabla local_news no disponible:', localError.message);
    } else {
      console.log('✅ Tabla local_news disponible. Noticias locales encontradas:', localData);
    }

    return { success: true };

  } catch (error: any) {
    console.error('❌ Error inesperado en test de conexión:', error);
    return { success: false, error: error.message };
  }
}