-- Script de prueba para web scraping
-- Verifica que las fuentes estén configuradas correctamente

-- Ver configuración actual
SELECT
    '=== CONFIGURACIÓN DE FUENTES ===' as seccion,
    name as fuente,
    source_type as tipo,
    category as categoria,
    base_url as url_base,
    is_active::text as activo
FROM rss_sources
WHERE category = 'regionales'

UNION ALL

-- Ver campos de scraping
SELECT
    '=== SELECTORES DE SCRAPING ===' as seccion,
    name as fuente,
    scrape_selector as tipo,
    title_selector as categoria,
    '' as url_base,
    'N/A' as activo
FROM rss_sources
WHERE category = 'regionales' AND source_type = 'web'

UNION ALL

-- Contar artículos por fuente
SELECT
    '=== ARTÍCULOS POR FUENTE ===' as seccion,
    rs.name as fuente,
    COUNT(a.id)::text as tipo,
    '' as categoria,
    '' as url_base,
    'N/A' as activo
FROM rss_sources rs
LEFT JOIN articles a ON rs.id = a.rss_source_id
WHERE rs.category = 'regionales'
GROUP BY rs.name

ORDER BY seccion, fuente;