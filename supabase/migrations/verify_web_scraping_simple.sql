-- Script simple de verificación de web scraping
-- Versión sin UNION para evitar problemas de compatibilidad

-- 1. Configuración de fuentes regionales
SELECT '=== FUENTES REGIONALES CONFIGURADAS ===' as info;
SELECT
    name,
    source_type,
    base_url,
    category,
    is_active
FROM rss_sources
WHERE category = 'regionales'
ORDER BY name;

-- 2. Selectores de scraping
SELECT '=== SELECTORES DE SCRAPING ===' as info;
SELECT
    name as fuente,
    scrape_selector,
    title_selector,
    description_selector,
    link_selector,
    date_selector
FROM rss_sources
WHERE category = 'regionales' AND source_type = 'web'
ORDER BY name;

-- 3. Estadísticas de artículos
SELECT '=== ESTADÍSTICAS DE ARTÍCULOS ===' as info;
SELECT
    rs.name as fuente,
    rs.source_type as tipo,
    COUNT(a.id) as total_articulos,
    COUNT(CASE WHEN a.created_at >= CURRENT_DATE THEN 1 END) as articulos_hoy
FROM rss_sources rs
LEFT JOIN articles a ON rs.id = a.rss_source_id
WHERE rs.category = 'regionales'
GROUP BY rs.id, rs.name, rs.source_type
ORDER BY rs.name;

-- 4. Artículos regionales recientes
SELECT '=== ARTÍCULOS REGIONALES RECIENTES ===' as info;
SELECT
    a.title as titulo,
    rs.name as fuente,
    a.created_at::date as fecha,
    LENGTH(a.description) as longitud_descripcion
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE rs.category = 'regionales' AND rs.is_active = true
ORDER BY a.created_at DESC
LIMIT 10;