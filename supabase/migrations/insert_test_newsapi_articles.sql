-- ============================================================================
-- Insertar artículos de prueba en news_api_articles
-- ============================================================================
-- Este script inserta directamente en la tabla bypass RLS
-- ============================================================================

-- Insertar artículos de prueba
INSERT INTO news_api_articles (title, description, content, image_url, url, author, category, status, source_name, source_country, published_at)
VALUES 
  (
    'Argentina gana el Mundial de Fútbol 2022',
    'La selección argentina se consagra campeona del mundo tras vencer a Francia en la final',
    'Un partido épico que quedará en la historia del fútbol mundial. Argentina se impuso en los penales tras empatar 3-3 en el tiempo reglamentario y suplementario.',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800',
    'https://ejemplo.com/argentina-mundial-2022',
    'Redacción Deportes',
    'Deportes',
    'draft',
    'Test Source',
    'Argentina',
    NOW()
  ),
  (
    'Nueva ley de economía del conocimiento beneficia a trabajadores IT',
    'El gobierno anuncia incentivos fiscales para el sector tecnológico argentino',
    'La nueva normativa incluye beneficios impositivos y facilidades para la exportación de servicios tecnológicos.',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
    'https://ejemplo.com/economia-conocimiento-2024',
    'Redacción Economía',
    'Economía',
    'draft',
    'Test Source',
    'Argentina',
    NOW()
  ),
  (
    'Santiago del Estero inaugura nuevo centro de salud',
    'El hospital contará con tecnología de última generación para atender a la comunidad',
    'La nueva infraestructura sanitaria beneficiará a más de 50.000 habitantes de la región.',
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800',
    'https://ejemplo.com/nuevo-hospital-sde',
    'Redacción Regionales',
    'Regionales',
    'draft',
    'Test Source',
    'Argentina',
    NOW()
  ),
  (
    'Descubren nueva especie de ave en la región del Chaco',
    'Científicos argentinos identifican un ave endémica nunca antes documentada',
    'El hallazgo representa un importante aporte a la biodiversidad regional y mundial.',
    'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=800',
    'https://ejemplo.com/nueva-especie-ave',
    'Redacción Ciencia',
    'Ciencia',
    'draft',
    'Test Source',
    'Argentina',
    NOW()
  ),
  (
    'Concierto gratuito en Plaza de Mayo por el Día de la Independencia',
    'Artistas nacionales se presentarán en un show especial para celebrar la fecha patria',
    'El evento contará con la participación de reconocidos músicos argentinos y se espera una gran convocatoria.',
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    'https://ejemplo.com/concierto-9-julio',
    'Redacción Espectáculos',
    'Espectaculos',
    'draft',
    'Test Source',
    'Argentina',
    NOW()
  )
ON CONFLICT (url) DO NOTHING;

-- Verificar que se insertaron
SELECT COUNT(*) as total_articles FROM news_api_articles;
SELECT title, category, status FROM news_api_articles ORDER BY created_at DESC LIMIT 10;
