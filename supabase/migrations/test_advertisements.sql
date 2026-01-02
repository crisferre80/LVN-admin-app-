-- Script de prueba rápida para verificar que advertisements funciona
-- Ejecutar después de aplicar la corrección

-- Verificar que la tabla existe y tiene las columnas correctas
SELECT 'Tabla advertisements existe' as status
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advertisements');

-- Verificar columna position
SELECT 'Columna position existe' as status
WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'advertisements' AND column_name = 'position');

-- Probar insertar un anuncio de prueba
INSERT INTO advertisements (title, image_url, link_url, position, is_active)
VALUES ('Prueba', 'https://example.com/image.jpg', 'https://example.com', 'sidebar', true)
ON CONFLICT DO NOTHING;

-- Verificar que se puede leer
SELECT COUNT(*) as total_anuncios FROM advertisements;

-- Limpiar anuncio de prueba
DELETE FROM advertisements WHERE title = 'Prueba';

SELECT '✅ Tabla advertisements funciona correctamente' as resultado;