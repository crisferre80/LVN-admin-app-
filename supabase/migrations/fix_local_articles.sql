-- Script de corrección completo para artículos regionales
-- Este script asegura que todos los artículos tengan la categoría correcta

-- Paso 1: Ver estado actual antes de la corrección
SELECT
    '=== ESTADO ANTES DE CORRECCIÓN ===' as fase,
    'Fuentes RSS regionales' as tipo,
    COUNT(*) as cantidad
FROM rss_sources
WHERE category = 'regionales' AND is_active = true

UNION ALL

SELECT
    '=== ESTADO ANTES DE CORRECCIÓN ===' as fase,
    'Artículos regionales actuales' as tipo,
    COUNT(*) as cantidad
FROM articles
WHERE category = 'regionales'

UNION ALL

SELECT
    '=== ESTADO ANTES DE CORRECCIÓN ===' as fase,
    'Artículos que necesitan corrección' as tipo,
    COUNT(*) as cantidad
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE a.category != rs.category AND rs.category = 'regionales';

-- Paso 2: Corregir categorías de artículos regionales
UPDATE articles
SET category = rss_sources.category
FROM rss_sources
WHERE articles.rss_source_id = rss_sources.id
AND rss_sources.category = 'regionales'
AND articles.category != rss_sources.category;

-- Paso 3: Ver estado después de la corrección
SELECT
    '=== ESTADO DESPUÉS DE CORRECCIÓN ===' as fase,
    'Fuentes RSS regionales' as tipo,
    COUNT(*) as cantidad
FROM rss_sources
WHERE category = 'regionales' AND is_active = true

UNION ALL

SELECT
    '=== ESTADO DESPUÉS DE CORRECCIÓN ===' as fase,
    'Artículos regionales corregidos' as tipo,
    COUNT(*) as cantidad
FROM articles
WHERE category = 'regionales'

UNION ALL

SELECT
    '=== ESTADO DESPUÉS DE CORRECCIÓN ===' as fase,
    'Artículos por fuente regional' as tipo,
    COUNT(DISTINCT a.id) as cantidad
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE rs.category = 'regionales' AND rs.is_active = true;

-- Paso 4: Mostrar artículos locales corregidos
SELECT
    a.title as titulo,
    rs.name as fuente,
    a.category as categoria,
    a.created_at as fecha_creacion
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE rs.category = 'regionales' AND rs.is_active = true
ORDER BY a.created_at DESC
LIMIT 10;