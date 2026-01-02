-- Script de verificación simple para artículos regionales
-- Ejecuta esto para ver rápidamente el estado de los artículos regionales

-- Fuentes RSS regionales activas
SELECT 'Fuentes RSS regionales:' as info, COUNT(*) as cantidad
FROM rss_sources
WHERE category = 'regionales' AND is_active = true

UNION ALL

-- Total de artículos regionales
SELECT 'Artículos con categoría regionales:' as info, COUNT(*) as cantidad
FROM articles
WHERE category = 'regionales'

UNION ALL

-- Artículos por fuente regional
SELECT 'Artículos por fuente regional:' as info, COUNT(DISTINCT a.id) as cantidad
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE rs.category = 'regionales' AND rs.is_active = true;

-- Lista de artículos regionales recientes (últimos 3)
SELECT
    a.title as titulo,
    rs.name as fuente,
    a.created_at::date as fecha
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE rs.category = 'regionales' AND rs.is_active = true
ORDER BY a.created_at DESC
LIMIT 3;