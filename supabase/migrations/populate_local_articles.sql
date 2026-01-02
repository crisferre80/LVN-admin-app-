-- SQL para poblar artículos con categoría "regionales" desde fuentes RSS regionales
-- Este script actualiza todos los artículos existentes para que tengan la categoría correcta
-- basada en su fuente RSS, específicamente para fuentes con categoría "regionales"

-- Primero, veamos qué fuentes RSS tienen categoría "regionales"
SELECT
    id,
    name,
    url,
    category,
    is_active
FROM rss_sources
WHERE category = 'regionales' AND is_active = true;

-- Veamos qué artículos existen actualmente con diferentes categorías
SELECT
    a.id,
    a.title,
    a.category as current_category,
    rs.name as rss_source_name,
    rs.category as rss_source_category
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE a.category != rs.category
ORDER BY rs.category, a.created_at DESC;

-- Actualizar artículos para que tengan la categoría correcta de su fuente RSS
-- Solo para fuentes con categoría "regionales"
UPDATE articles
SET category = rss_sources.category
FROM rss_sources
WHERE articles.rss_source_id = rss_sources.id
AND rss_sources.category = 'regionales'
AND articles.category != rss_sources.category;

-- Verificar que la actualización funcionó
SELECT
    COUNT(*) as total_articles,
    COUNT(CASE WHEN category = 'regionales' THEN 1 END) as regional_articles,
    COUNT(DISTINCT rss_source_id) as distinct_sources
FROM articles
WHERE rss_source_id IN (
    SELECT id FROM rss_sources WHERE category = 'regionales' AND is_active = true
);

-- Mostrar algunos artículos locales recientes
SELECT
    a.id,
    a.title,
    a.category,
    a.created_at,
    rs.name as source_name,
    rs.category as source_category
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE rs.category = 'regionales' AND rs.is_active = true
ORDER BY a.created_at DESC
LIMIT 10;