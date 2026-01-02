-- EJEMPLO: Cómo configurar web scraping paso a paso
-- Copia y pega cada sección en el SQL Editor de Supabase

-- PASO 1: Agregar campos para web scraping
-- ======================================
-- Ejecuta ESTO primero (una sola vez)

ALTER TABLE rss_sources
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'rss' CHECK (source_type IN ('rss', 'web')),
ADD COLUMN IF NOT EXISTS scrape_selector TEXT,
ADD COLUMN IF NOT EXISTS title_selector TEXT,
ADD COLUMN IF NOT EXISTS description_selector TEXT,
ADD COLUMN IF NOT EXISTS link_selector TEXT,
ADD COLUMN IF NOT EXISTS date_selector TEXT,
ADD COLUMN IF NOT EXISTS base_url TEXT;

-- PASO 2: Configurar fuentes locales para web scraping
-- ===================================================
-- Ejecuta ESTO después de agregar los campos

UPDATE rss_sources
SET
  source_type = 'web',
  base_url = 'https://elliberal.com.ar',
  scrape_selector = 'article, .noticia, .post',
  title_selector = 'h1, h2, .title, .headline',
  description_selector = '.excerpt, .summary, p',
  link_selector = 'a[href]',
  date_selector = '.date, .published, time, .fecha'
WHERE name = 'El Liberal' AND is_active = true;

UPDATE rss_sources
SET
  source_type = 'web',
  base_url = 'https://nuevodiarioonline.com',
  scrape_selector = 'article, .noticia, .post, .entry',
  title_selector = 'h1, h2, h3, .title, .headline',
  description_selector = '.excerpt, .summary, .content p:first-child',
  link_selector = 'a[href]',
  date_selector = '.date, .published, time, .fecha, .post-date'
WHERE name = 'Nuevo Diario' AND is_active = true;

UPDATE rss_sources
SET
  source_type = 'web',
  base_url = 'https://fmaries.com.ar',
  scrape_selector = 'article, .noticia, .post, .news-item',
  title_selector = 'h1, h2, h3, .title, .headline',
  description_selector = '.excerpt, .summary, p, .content',
  link_selector = 'a[href]',
  date_selector = '.date, .published, time, .fecha'
WHERE name = 'FM Aries' AND is_active = true;

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

-- PASO 3: Verificar configuración
-- ==============================
-- Ejecuta ESTO para verificar que todo esté configurado

SELECT '=== FUENTES LOCALES CONFIGURADAS ===' as info;

SELECT
    name,
    source_type,
    base_url,
    category,
    is_active
FROM rss_sources
WHERE category = 'regionales'
ORDER BY name;

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