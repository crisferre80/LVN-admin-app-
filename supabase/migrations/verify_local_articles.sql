-- Script de verificación para artículos regionales
-- Ejecuta esto después de actualizar las categorías para verificar que funciona

-- 1. Verificar fuentes RSS regionales
SELECT
    '=== FUENTES RSS REGIONALES ===' as info,
    name as detalle1,
    url as detalle2,
    category as detalle3,
    CASE WHEN is_active THEN 'ACTIVA' ELSE 'INACTIVA' END as estado
FROM rss_sources
WHERE category = 'regionales';

-- 2. Contar artículos por categoría
SELECT
    '=== ARTÍCULOS POR CATEGORÍA ===' as info,
    category as detalle1,
    COUNT(*)::text as detalle2,
    '' as detalle3,
    '' as estado
FROM articles
GROUP BY category
ORDER BY total_articles DESC;

-- 3. Artículos regionales recientes
SELECT
    '=== ARTÍCULOS REGIONALES RECIENTES ===' as info,
    LEFT(a.title, 50) as detalle1,
    rs.name as detalle2,
    a.created_at::date::text as detalle3,
    a.category as estado
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE rs.category = 'regionales' AND rs.is_active = true
ORDER BY a.created_at DESC
LIMIT 5;