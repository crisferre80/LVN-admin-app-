-- Agregar campos para web scraping a rss_sources
ALTER TABLE rss_sources
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'rss' CHECK (source_type IN ('rss', 'web')),
ADD COLUMN IF NOT EXISTS scrape_selector TEXT,
ADD COLUMN IF NOT EXISTS title_selector TEXT,
ADD COLUMN IF NOT EXISTS description_selector TEXT,
ADD COLUMN IF NOT EXISTS link_selector TEXT,
ADD COLUMN IF NOT EXISTS date_selector TEXT,
ADD COLUMN IF NOT EXISTS base_url TEXT;

-- Actualizar fuentes locales para usar web scraping
UPDATE rss_sources
SET
  source_type = 'web',
  base_url = 'https://www.elliberal.com.ar/',
  scrape_selector = '.noticia, .article, article',
  title_selector = 'h1, h2, h3, .title',
  description_selector = '.excerpt, .summary, p',
  link_selector = 'a[href]',
  date_selector = '.date, .published, time'
WHERE name = 'El Liberal';

UPDATE rss_sources
SET
  source_type = 'web',
  base_url = 'https://www.nuevodiarioweb.com.ar/',
  scrape_selector = '.noticia, .article, article',
  title_selector = 'h1, h2, h3, .title',
  description_selector = '.excerpt, .summary, p',
  link_selector = 'a[href]',
  date_selector = '.date, .published, time'
WHERE name = 'Nuevo Diario';

UPDATE rss_sources
SET
  source_type = 'web',
  base_url = 'https://www.diariopanorama.com/',
  scrape_selector = '.noticia, .article, article',
  title_selector = 'h1, h2, h3, .title',
  description_selector = '.excerpt, .summary, p',
  link_selector = 'a[href]',
  date_selector = '.date, .published, time'
WHERE name = 'Diario Panorama';

UPDATE rss_sources
SET
  source_type = 'web',
  base_url = 'https://radionacional.gov.ar/santiago-del-estero',
  scrape_selector = '.noticia, .article, article',
  title_selector = 'h1, h2, h3, .title',
  description_selector = '.excerpt, .summary, p',
  link_selector = 'a[href]',
  date_selector = '.date, .published, time'
WHERE name = 'Radio Nacional Santiago del Estero';