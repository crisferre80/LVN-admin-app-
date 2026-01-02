-- Script para corregir las categorías en inglés a español en la base de datos
-- Este script actualiza las categorías de los artículos para que estén en español

-- Actualizar categoría 'General' a 'Nacionales'
UPDATE articles
SET category = 'Nacionales'
WHERE category = 'General';

-- Actualizar categoría 'local' a 'Regionales'
UPDATE articles
SET category = 'Regionales'
WHERE category = 'local';

-- Actualizar categoría 'World' a 'Internacionales'
UPDATE articles
SET category = 'Internacionales'
WHERE category = 'World';

-- Actualizar categoría 'Business' a 'Economía'
UPDATE articles
SET category = 'Economía'
WHERE category = 'Business';

-- Las categorías 'Deportes' y 'Espectaculos' ya están en español, no necesitan cambios

-- Actualizar también las fuentes RSS si tienen categorías en inglés
UPDATE rss_sources
SET category = 'Nacionales'
WHERE category = 'General';

UPDATE rss_sources
SET category = 'Regionales'
WHERE category = 'local';

UPDATE rss_sources
SET category = 'Internacionales'
WHERE category = 'World';

UPDATE rss_sources
SET category = 'Economía'
WHERE category = 'Business';

-- CORREGIR TAMBIÉN ARTÍCULOS GENERADOS POR IA
UPDATE ai_generated_articles
SET category = 'Nacionales'
WHERE category = 'General';

UPDATE ai_generated_articles
SET category = 'Regionales'
WHERE category = 'local';

UPDATE ai_generated_articles
SET category = 'Internacionales'
WHERE category = 'World';

UPDATE ai_generated_articles
SET category = 'Economía'
WHERE category = 'Business';

-- Verificar los cambios realizados
SELECT
  'Artículos RSS actualizados' as tipo,
  COUNT(*) as cantidad
FROM articles
WHERE category IN ('Nacionales', 'Regionales', 'Internacionales', 'Economía', 'Deportes', 'Espectaculos')

UNION ALL

SELECT
  'Fuentes RSS actualizadas' as tipo,
  COUNT(*) as cantidad
FROM rss_sources
WHERE category IN ('Nacionales', 'Regionales', 'Internacionales', 'Economía', 'Deportes', 'Espectaculos')

UNION ALL

SELECT
  'Artículos AI actualizados' as tipo,
  COUNT(*) as cantidad
FROM ai_generated_articles
WHERE category IN ('Nacionales', 'Regionales', 'Internacionales', 'Economía', 'Deportes', 'Espectaculos');

-- Mostrar resumen de categorías actuales en artículos RSS
SELECT
  category,
  COUNT(*) as cantidad_articulos
FROM articles
GROUP BY category
ORDER BY cantidad_articulos DESC;

-- Mostrar resumen de categorías actuales en artículos AI
SELECT
  category,
  COUNT(*) as cantidad_articulos_ai
FROM ai_generated_articles
GROUP BY category
ORDER BY cantidad_articulos_ai DESC;