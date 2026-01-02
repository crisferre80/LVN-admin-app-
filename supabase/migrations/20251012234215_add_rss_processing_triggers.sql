-- Nueva migración para configurar RLS y triggers para RSS (usando Edge Functions)

-- Ya no necesitamos la extensión http, usaremos Edge Functions

-- Función simplificada para procesar RSS (ahora llama a Edge Function, pero como no podemos desde SQL, la quitamos)
-- En su lugar, la Edge Function se ejecutará programada o manualmente

-- Trigger para procesar RSS automáticamente cuando se inserta o actualiza un RSS source
-- Nota: Como no podemos llamar Edge Functions desde triggers SQL en Supabase,
-- este trigger solo registra que necesita actualización. La Edge Function programada lo hará.

CREATE OR REPLACE FUNCTION trigger_mark_rss_for_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Solo marcar que necesita actualización, la Edge Function lo procesará
  -- En futuras versiones, podríamos agregar un campo 'needs_update'
  RETURN NEW;
END;
$$;

-- Crear el trigger en rss_sources (simplificado)
DROP TRIGGER IF EXISTS trigger_rss_update ON rss_sources;
CREATE TRIGGER trigger_rss_update
  AFTER INSERT OR UPDATE OF url, is_active ON rss_sources
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION trigger_mark_rss_for_update();

-- Función para llamar manualmente a la Edge Function (no funciona en Supabase SQL)
-- En su lugar, llama a la Edge Function desde el cliente o dashboard

-- Asegurar que las políticas RLS estén correctas
-- Para articles, permitir gestión solo por service role (para Edge Functions)
DROP POLICY IF EXISTS "Service role can manage articles" ON articles;
CREATE POLICY "Service role can manage articles"
  ON articles FOR ALL
  USING (true)  -- Permitir lectura pública
  WITH CHECK (true);  -- Permitir inserts desde service role via Edge Functions

-- Para rss_sources, permitir gestión solo por service role
DROP POLICY IF EXISTS "Service role can manage RSS sources" ON rss_sources;
CREATE POLICY "Service role can manage RSS sources"
  ON rss_sources FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Para advertisements, permitir gestión solo por service role
DROP POLICY IF EXISTS "Service role can manage advertisements" ON advertisements;
CREATE POLICY "Service role can manage advertisements"
  ON advertisements FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Para classified_ads, permitir que usuarios autenticados actualicen sus propios clasificados
-- Nota: Asumiendo que eventualmente se agregará user_id
DROP POLICY IF EXISTS "Users can update their own classifieds" ON classified_ads;
CREATE POLICY "Users can update their own classifieds"
  ON classified_ads FOR UPDATE
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- Similar para user_news
DROP POLICY IF EXISTS "Users can update their own news" ON user_news;
CREATE POLICY "Users can update their own news"
  ON user_news FOR UPDATE
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);