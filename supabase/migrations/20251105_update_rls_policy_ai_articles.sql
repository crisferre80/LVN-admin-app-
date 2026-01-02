-- Actualizar políticas RLS para ai_generated_articles
-- Permitir operaciones completas para usuarios autenticados

-- Eliminar la política existente si existe
DROP POLICY IF EXISTS "Authenticated users full access to AI articles" ON ai_generated_articles;

-- Crear nueva política más permisiva
CREATE POLICY "Authenticated users full access to AI articles" ON ai_generated_articles
  FOR ALL USING (auth.jwt() IS NOT NULL);