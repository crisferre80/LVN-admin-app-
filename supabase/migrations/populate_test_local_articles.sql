-- Script para poblar artículos de ejemplo con categoría "regionales"
-- Útil para testing del sistema de parseo de fotos

-- Primero verificar si existe la fuente RSS regionales
INSERT INTO rss_sources (name, url, category, is_active)
VALUES (
    'Diario Local Santiago',
    'https://www.diariopanorama.com',
    'regionales',
    true
) ON CONFLICT (url) DO NOTHING;

-- Insertar algunos artículos de ejemplo con categoría local
INSERT INTO articles (
    title,
    content,
    url,
    category,
    rss_source_id
) VALUES
(
    'Inauguración del nuevo parque en el centro de Santiago',
    '<p>El intendente inauguró hoy el parque central de Santiago del Estero, un espacio verde de 5 hectáreas que beneficiará a miles de familias.</p><img src="https://res.cloudinary.com/example/image/upload/parque-inauguracion.jpg" alt="Parque nuevo">',
    'https://www.ejemplo-local.com/noticia/parque-inaugurado',
    'regionales',
    (SELECT id FROM rss_sources WHERE category = 'regionales' LIMIT 1)
),
(
    'Festival folclórico reúne a artistas de toda la provincia',
    '<p>Más de 50 artistas participaron en el festival de música folclórica realizado en el Teatro Municipal.</p><img src="https://res.cloudinary.com/example/image/upload/festival-folclorico.jpg" alt="Festival folclórico">',
    'https://www.ejemplo-local.com/noticia/festival-folclor',
    'regionales',
    (SELECT id FROM rss_sources WHERE category = 'regionales' LIMIT 1)
),
(
    'Obras de pavimentación avanzan en barrio Villa Unión',
    '<p>Las obras de pavimentación en Villa Unión están al 70% de avance, según informó la municipalidad.</p><img src="https://res.cloudinary.com/example/image/upload/obras-pavimento.jpg" alt="Obras pavimentación">',
    'https://www.ejemplo-local.com/noticia/obras-pavimento',
    'regionales',
    (SELECT id FROM rss_sources WHERE category = 'regionales' LIMIT 1)
)
ON CONFLICT (url) DO NOTHING;

-- Verificar que se insertaron correctamente
SELECT
    a.id,
    a.title,
    a.category,
    a.image_url,
    rs.name as source_name
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE a.category = 'regionales'
ORDER BY a.created_at DESC;