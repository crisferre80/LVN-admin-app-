-- Script simple para actualizar artículos regionales
-- Actualiza todos los artículos de fuentes RSS con categoría "regionales"

UPDATE articles
SET category = 'regionales'
WHERE rss_source_id IN (
    SELECT id FROM rss_sources
    WHERE category = 'regionales' AND is_active = true
);

-- Verificar resultado
SELECT
    'Total artículos regionales' as info,
    COUNT(*) as count
FROM articles
WHERE category = 'regionales'

UNION ALL

SELECT
    'Fuentes RSS regionales activas' as info,
    COUNT(*) as count
FROM rss_sources
WHERE category = 'regionales' AND is_active = true

UNION ALL

SELECT
    'Artículos por fuente regional' as info,
    COUNT(a.*) as count
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE rs.category = 'regionales' AND rs.is_active = true;