-- ============================================================================
-- DEPRECATED: Políticas RLS para news_api_articles - News API functionality removed
-- ============================================================================
-- Este archivo ya no es necesario ya que se eliminó la funcionalidad de News API
-- ============================================================================

-- 1. Eliminar políticas antiguas si existen
-- DROP POLICY IF EXISTS "Public read access for published News API articles" ON news_api_articles;
-- DROP POLICY IF EXISTS "Authenticated users full access to News API articles" ON news_api_articles;

-- 2. Crear política de lectura pública para artículos publicados
CREATE POLICY "Public read access for published News API articles" 
ON news_api_articles
FOR SELECT 
USING (status = 'published');

-- 3. Crear política de SELECT para usuarios autenticados (ver todos los artículos)
CREATE POLICY "Authenticated users can view all news api articles" 
ON news_api_articles
FOR SELECT 
USING (auth.role() = 'authenticated');

-- 4. Crear política de INSERT para usuarios autenticados
CREATE POLICY "Authenticated users can insert news api articles" 
ON news_api_articles
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 5. Crear política de UPDATE para usuarios autenticados
CREATE POLICY "Authenticated users can update news api articles" 
ON news_api_articles
FOR UPDATE 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 6. Crear política de DELETE para usuarios autenticados
CREATE POLICY "Authenticated users can delete news api articles" 
ON news_api_articles
FOR DELETE 
USING (auth.role() = 'authenticated');

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Ejecuta esto después para verificar que las políticas se crearon:
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'news_api_articles'
ORDER BY policyname;
