-- Script para configurar web scraping para diarios locales
-- Actualiza las fuentes RSS para usar web scraping en lugar de RSS

-- Configurar El Liberal para web scraping
UPDATE rss_sources
SET
  source_type = 'web',
  base_url = 'https://www.elliberal.com.ar',
  scrape_selector = 'article, .noticia, .post',
  title_selector = 'h1, h2, .title, .headline',
  description_selector = '.excerpt, .summary, p',
  link_selector = 'a[href]',
  date_selector = '.date, .published, time, .fecha'
WHERE name = 'El Liberal' AND is_active = true;

-- Configurar Nuevo Diario para web scraping
UPDATE rss_sources
SET
  source_type = 'web',
  base_url = 'https://www.nuevodiarioweb.com.ar/',
  scrape_selector = 'article, .noticia, .post, .entry',
  title_selector = 'h1, h2, h3, .title, .headline',
  description_selector = '.excerpt, .summary, .content p:first-child',
  link_selector = 'a[href]',
  date_selector = '.date, .published, time, .fecha, .post-date'
WHERE name = 'Nuevo Diario' AND is_active = true;

-- Configurar FM Aries para web scraping
UPDATE rss_sources
SET
  source_type = 'web',
  base_url = 'https://www.diariopanorama.com/',
  scrape_selector = 'article, .noticia, .post, .news-item',
  title_selector = 'h1, h2, h3, .title, .headline',
  description_selector = '.excerpt, .summary, p, .content',
  link_selector = 'a[href]',
  date_selector = '.date, .published, time, .fecha'
WHERE name = 'Diario Panorama' AND is_active = true;

-- Configurar Radio Nacional para web scraping
UPDATE rss_sources
SET
  source_type = 'web',
  base_url = 'https://radionacional.gov.ar/santiago-del-estero',
  scrape_selector = 'article, .noticia, .post, .news',
  title_selector = 'h1, h2, h3, .title, .headline',
  description_selector = '.excerpt, .summary, p, .content',
  link_selector = 'a[href]',
  date_selector = '.date, .published, time, .fecha'
WHERE name = 'Radio Nacional Santiago del Estero' AND is_active = true;

-- Verificar configuración
SELECT
    name,
    source_type,
    base_url,
    category,
    is_active
FROM rss_sources
WHERE category = 'regionales'
ORDER BY name;