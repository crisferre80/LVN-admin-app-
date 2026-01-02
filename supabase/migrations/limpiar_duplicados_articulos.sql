-- Script para limpiar artículos duplicados entre articles y ai_generated_articles
-- Ejecutar en Supabase SQL Editor

-- 1. Identificar duplicados (mismo ID en ambas tablas)
SELECT 
  '1. Artículos duplicados encontrados' as paso,
  a.id,
  a.title as titulo_articles,
  ai.title as titulo_ai_generated,
  a.created_at as creado_articles,
  ai.created_at as creado_ai_generated,
  a.published_at as publicado_articles,
  ai.published_at as publicado_ai_generated,
  ai.updated_at as actualizado_ai_generated
FROM articles a
INNER JOIN ai_generated_articles ai ON a.id = ai.id
ORDER BY ai.created_at DESC;

-- 2. Contar duplicados
SELECT 
  '2. Total de duplicados' as paso,
  COUNT(*) as total_duplicados
FROM articles a
INNER JOIN ai_generated_articles ai ON a.id = ai.id;

-- 3. LIMPIAR DUPLICADOS - Eliminar de articles los que ya están en ai_generated_articles
-- IMPORTANTE: Esto eliminará de articles todos los artículos que existan en ai_generated_articles
-- Si estás seguro de proceder, descomenta y ejecuta la siguiente línea:

-- DELETE FROM articles
-- WHERE id IN (
--   SELECT a.id 
--   FROM articles a
--   INNER JOIN ai_generated_articles ai ON a.id = ai.id
-- );

-- 4. Alternativa más segura: Ver qué se eliminaría antes de hacerlo
SELECT 
  '4. Artículos que serían eliminados de articles' as paso,
  a.id,
  a.title,
  a.category,
  a.created_at,
  'Existe en ai_generated_articles' as razon
FROM articles a
WHERE a.id IN (
  SELECT ai.id 
  FROM ai_generated_articles ai
)
ORDER BY a.created_at DESC;

-- 5. Verificar artículos huérfanos en articles (que no están en ai_generated_articles)
SELECT 
  '5. Artículos solo en articles (RSS originales)' as paso,
  COUNT(*) as total
FROM articles a
WHERE NOT EXISTS (
  SELECT 1 
  FROM ai_generated_articles ai 
  WHERE ai.id = a.id
);

-- 6. Verificar artículos solo en ai_generated_articles (artículos propios)
SELECT 
  '6. Artículos solo en ai_generated_articles' as paso,
  COUNT(*) as total
FROM ai_generated_articles ai
WHERE NOT EXISTS (
  SELECT 1 
  FROM articles a 
  WHERE a.id = ai.id
);

-- INSTRUCCIONES:
-- 1. Ejecuta los pasos 1-6 para ver el estado actual
-- 2. Si hay duplicados y quieres limpiarlos, descomenta el DELETE en el paso 3
-- 3. Ejecuta nuevamente los pasos 1-6 para verificar que se limpiaron los duplicados

-- RESULTADO ESPERADO DESPUÉS DE LA LIMPIEZA:
-- - Paso 1 y 2: No debe haber duplicados (0 registros)
-- - Paso 4: Lista vacía
-- - Paso 5: Artículos RSS que no han sido editados
-- - Paso 6: Todos los artículos propios del diario
