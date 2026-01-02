-- Script SQL para gestionar y verificar artículos regionales con fotos
-- Ejecutar después del script de parseo de imágenes

-- Ver estadísticas de artículos regionales
SELECT
    COUNT(*) as total_regional_articles,
    COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) as with_images,
    COUNT(CASE WHEN image_url IS NULL THEN 1 END) as without_images,
    CASE
        WHEN COUNT(*) > 0 THEN ROUND(
            (COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) * 100.0) / COUNT(*),
            2
        )
        ELSE 0
    END as percentage_with_images
FROM articles
WHERE category = 'regionales';

-- Mostrar artículos regionales recientes con imágenes
SELECT
    a.id,
    a.title,
    a.image_url,
    a.created_at,
    rs.name as source_name
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE a.category = 'regionales'
AND a.image_url IS NOT NULL
ORDER BY a.created_at DESC
LIMIT 10;

-- Mostrar artículos regionales sin imágenes (para debugging)
SELECT
    a.id,
    a.title,
    a.url,
    a.created_at,
    rs.name as source_name
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE a.category = 'regionales'
AND a.image_url IS NULL
ORDER BY a.created_at DESC
LIMIT 10;

-- Verificar que las URLs de imágenes sean válidas (básico)
SELECT
    a.id,
    a.title,
    a.image_url,
    CASE
        WHEN a.image_url LIKE 'http%' THEN 'URL válida'
        WHEN a.image_url LIKE '//%' THEN 'URL sin protocolo'
        WHEN a.image_url LIKE '/%' THEN 'URL relativa'
        ELSE 'URL inválida'
    END as url_status
FROM articles a
WHERE a.category = 'regionales'
AND a.image_url IS NOT NULL
ORDER BY a.created_at DESC
LIMIT 20;

-- Limpiar URLs de imágenes inválidas (opcional - ejecutar con cuidado)
-- UPDATE articles
-- SET image_url = NULL
-- WHERE category = 'regionales'
-- AND image_url NOT LIKE 'http%';

-- Estadísticas por fuente RSS
SELECT
    rs.name as source_name,
    rs.url as source_url,
    COUNT(a.id) as total_articles,
    COUNT(CASE WHEN a.image_url IS NOT NULL THEN 1 END) as with_images,
    CASE
        WHEN COUNT(a.id) > 0 THEN ROUND(
            (COUNT(CASE WHEN a.image_url IS NOT NULL THEN 1 END) * 100.0) / COUNT(a.id),
            2
        )
        ELSE 0
    END as success_rate
FROM rss_sources rs
LEFT JOIN articles a ON rs.id = a.rss_source_id
WHERE rs.category = 'regionales'
AND rs.is_active = true
GROUP BY rs.id, rs.name, rs.url
ORDER BY success_rate DESC;