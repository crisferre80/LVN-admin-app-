-- ============================================================================
-- VERIFICACIÓN: RLS Policies para Gallery Images
-- ============================================================================
-- 
-- Ejecuta este script DESPUÉS de aplicar el fix para verificar que
-- las políticas RLS fueron creadas correctamente.
--
-- ============================================================================

-- Verificar que las políticas existen
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('gallery_images', 'ai_gallery_images')
ORDER BY tablename, policyname;

-- ============================================================================
-- EXPECTED OUTPUT:
-- ============================================================================
--
-- 8 filas deberían aparecer:
--
-- Tabla: gallery_images
-- 1. Anyone can view gallery images (SELECT) - USING: true
-- 2. Authenticated users can insert gallery images (INSERT) - WITH CHECK: auth.role() = 'authenticated'
-- 3. Users can update gallery images (UPDATE)
-- 4. Users can delete gallery images (DELETE)
--
-- Tabla: ai_gallery_images
-- 5. Anyone can view ai gallery images (SELECT) - USING: true
-- 6. Authenticated users can insert ai gallery images (INSERT) - WITH CHECK: auth.role() = 'authenticated'
-- 7. Users can update ai gallery images (UPDATE)
-- 8. Users can delete ai gallery images (DELETE)
--
-- ============================================================================

-- Verificar que las tablas existen y están bien formadas
SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN ('gallery_images', 'ai_gallery_images');

-- ============================================================================
-- Verificar que las constraints existen
-- ============================================================================
SELECT
  tablename,
  constraintname,
  constrainttype
FROM pg_constraints
WHERE tablename IN ('gallery_images', 'ai_gallery_images');

-- ============================================================================
-- TEST: Intentar insertar una imagen de prueba (como usuario authenticated)
-- ============================================================================
-- 
-- NOTA: Este test solo funciona si estás logueado
-- 
-- INSERT INTO gallery_images (
--   article_id, 
--   image_url, 
--   alt_text, 
--   position, 
--   template_type
-- ) VALUES (
--   'YOUR_ARTICLE_UUID_HERE',  -- Reemplaza con un article_id real
--   'https://example.com/test.jpg',
--   'Test image',
--   0,
--   'list'
-- );
-- 
-- Si funciona: ✅ RLS está bien configurado
-- Si falla con 42501: ❌ Todavía hay problemas con RLS
--
-- ============================================================================
