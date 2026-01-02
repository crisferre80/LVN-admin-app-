-- Script ultra-simple para corregir artículos regionales
-- Versión compatible con el esquema actual (sin updated_at)

-- Verificar antes
SELECT 'Artículos regionales ANTES:' as estado, COUNT(*) as cantidad
FROM articles WHERE category = 'regionales';

-- Corregir categorías
UPDATE articles
SET category = 'regionales'
WHERE rss_source_id IN (
    SELECT id FROM rss_sources
    WHERE category = 'regionales' AND is_active = true
);

-- Verificar después
SELECT 'Artículos regionales DESPUÉS:' as estado, COUNT(*) as cantidad
FROM articles WHERE category = 'regionales';

-- Mostrar algunos artículos regionales
SELECT
    a.title as titulo,
    rs.name as fuente,
    a.created_at::date as fecha
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE rs.category = 'regionales' AND rs.is_active = true
ORDER BY a.created_at DESC
LIMIT 5;