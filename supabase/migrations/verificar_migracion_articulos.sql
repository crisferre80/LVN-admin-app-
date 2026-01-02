-- Script SQL para verificar el estado de la migración de artículos
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar que existe el ID de La Voz del Norte en rss_sources
SELECT 
  '1. Verificación de fuente La Voz del Norte' as paso,
  id, 
  name, 
  url
FROM rss_sources
WHERE id = '550e8400-e29b-41d4-a716-446655440000'
   OR name ILIKE '%voz%norte%';

-- 2. Contar artículos en cada tabla
SELECT 
  '2. Conteo de artículos por tabla' as paso,
  'articles (RSS originales)' as tabla,
  COUNT(*) as total
FROM articles
UNION ALL
SELECT 
  '2. Conteo de artículos por tabla' as paso,
  'ai_generated_articles (propios)' as tabla,
  COUNT(*) as total
FROM ai_generated_articles;

-- 3. Verificar artículos propios con fuente La Voz del Norte
SELECT 
  '3. Artículos propios de La Voz del Norte' as paso,
  COUNT(*) as total,
  status,
  author
FROM ai_generated_articles
WHERE source_rss_id = '550e8400-e29b-41d4-a716-446655440000'
GROUP BY status, author
ORDER BY status;

-- 4. Buscar posibles duplicados (mismo título en ambas tablas)
SELECT 
  '4. Posibles duplicados' as paso,
  a.id as id_articles,
  ai.id as id_ai_articles,
  a.title,
  a.created_at as created_articles,
  ai.created_at as created_ai
FROM articles a
INNER JOIN ai_generated_articles ai ON a.title = ai.title
ORDER BY a.created_at DESC
LIMIT 10;

-- 5. Artículos recientes en ai_generated_articles
SELECT 
  '5. Últimos artículos propios' as paso,
  id,
  title,
  author,
  status,
  source_rss_id,
  created_at,
  CASE 
    WHEN source_rss_id = '550e8400-e29b-41d4-a716-446655440000' 
    THEN 'La Voz del Norte Diario'
    ELSE 'Otra fuente'
  END as fuente
FROM ai_generated_articles
ORDER BY created_at DESC
LIMIT 10;

-- 6. Verificar que no hay artículos editados que quedaron en articles
-- (artículos que deberían haber sido migrados)
SELECT 
  '6. Artículos RSS potencialmente editados' as paso,
  COUNT(*) as total
FROM articles
WHERE 
  updated_at IS NOT NULL 
  AND updated_at > created_at + interval '1 minute';

-- 7. Estadísticas por fuente en ai_generated_articles
SELECT 
  '7. Distribución por fuente' as paso,
  CASE 
    WHEN source_rss_id = '550e8400-e29b-41d4-a716-446655440000' 
    THEN 'La Voz del Norte Diario'
    WHEN source_rss_id IS NULL 
    THEN 'Sin fuente'
    ELSE 'Otras fuentes RSS'
  END as fuente_tipo,
  COUNT(*) as total,
  status
FROM ai_generated_articles
GROUP BY fuente_tipo, status
ORDER BY fuente_tipo, status;

-- 8. Campos importantes de la tabla ai_generated_articles
SELECT 
  '8. Estructura de ai_generated_articles' as paso,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'ai_generated_articles'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- RESULTADO ESPERADO:
-- ✅ Paso 1: Debe mostrar la fuente La Voz del Norte
-- ✅ Paso 2: Debe mostrar conteos de ambas tablas
-- ✅ Paso 3: Debe mostrar artículos con fuente La Voz del Norte
-- ✅ Paso 4: No debe haber duplicados (o muy pocos)
-- ✅ Paso 5: Debe mostrar últimos artículos con autor correcto
-- ✅ Paso 6: Debe mostrar 0 o muy pocos artículos editados en articles
-- ✅ Paso 7: Debe mostrar distribución correcta de fuentes
-- ✅ Paso 8: Debe mostrar campos source_rss_id, author, etc.
