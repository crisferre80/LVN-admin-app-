-- Script para identificar y limpiar URLs problemáticas de YouTube en la base de datos

-- Verificar URLs problemáticas en la tabla de videos
SELECT 
    id, 
    title, 
    url,
    CASE 
        WHEN url = 'https://www.youtube.com/' THEN 'URL raíz de YouTube'
        WHEN url = 'https://youtube.com/' THEN 'URL raíz de YouTube'
        WHEN url = 'https://www.youtube.com' THEN 'URL raíz de YouTube'
        WHEN url = 'youtube.com' THEN 'URL raíz de YouTube'
        WHEN url = 'www.youtube.com' THEN 'URL raíz de YouTube'
        WHEN url LIKE '%youtube.com/watch?v=%' AND url NOT LIKE '%youtube.com/embed/%' THEN 'URL watch (necesita conversión)'
        ELSE 'URL válida'
    END as status
FROM videos 
WHERE url LIKE '%youtube.com%' 
    AND (
        url = 'https://www.youtube.com/' 
        OR url = 'https://youtube.com/' 
        OR url = 'https://www.youtube.com'
        OR url = 'youtube.com'
        OR url = 'www.youtube.com'
        OR (url LIKE '%youtube.com/watch?v=%' AND url NOT LIKE '%youtube.com/embed/%')
    )
ORDER BY status, title;

-- Verificar URLs problemáticas en la tabla de artículos (si tienen videos incrustados)
SELECT 
    id, 
    title, 
    url,
    CASE 
        WHEN url = 'https://www.youtube.com/' THEN 'URL raíz de YouTube'
        WHEN url = 'https://youtube.com/' THEN 'URL raíz de YouTube'
        WHEN url = 'https://www.youtube.com' THEN 'URL raíz de YouTube'
        WHEN url = 'youtube.com' THEN 'URL raíz de YouTube'
        WHEN url = 'www.youtube.com' THEN 'URL raíz de YouTube'
        WHEN url LIKE '%youtube.com/watch?v=%' AND url NOT LIKE '%youtube.com/embed/%' THEN 'URL watch (necesita conversión)'
        ELSE 'URL válida'
    END as status
FROM articles 
WHERE url LIKE '%youtube.com%' 
    AND (
        url = 'https://www.youtube.com/' 
        OR url = 'https://youtube.com/' 
        OR url = 'https://www.youtube.com'
        OR url = 'youtube.com'
        OR url = 'www.youtube.com'
        OR (url LIKE '%youtube.com/watch?v=%' AND url NOT LIKE '%youtube.com/embed/%')
    )
ORDER BY status, title;

-- Verificar URLs problemáticas en ai_generated_articles
SELECT 
    id, 
    title, 
    url,
    CASE 
        WHEN url = 'https://www.youtube.com/' THEN 'URL raíz de YouTube'
        WHEN url = 'https://youtube.com/' THEN 'URL raíz de YouTube'  
        WHEN url = 'https://www.youtube.com' THEN 'URL raíz de YouTube'
        WHEN url = 'youtube.com' THEN 'URL raíz de YouTube'
        WHEN url = 'www.youtube.com' THEN 'URL raíz de YouTube'
        WHEN url LIKE '%youtube.com/watch?v=%' AND url NOT LIKE '%youtube.com/embed/%' THEN 'URL watch (necesita conversión)'
        ELSE 'URL válida'
    END as status
FROM ai_generated_articles 
WHERE url LIKE '%youtube.com%' 
    AND (
        url = 'https://www.youtube.com/' 
        OR url = 'https://youtube.com/' 
        OR url = 'https://www.youtube.com'
        OR url = 'youtube.com'
        OR url = 'www.youtube.com'
        OR (url LIKE '%youtube.com/watch?v=%' AND url NOT LIKE '%youtube.com/embed/%')
    )
ORDER BY status, title;

-- Para limpiar URLs problemáticas (EJECUTAR CON CUIDADO):
-- 
-- -- Eliminar registros con URLs raíz de YouTube (sin contenido útil)
-- DELETE FROM videos 
-- WHERE url IN ('https://www.youtube.com/', 'https://youtube.com/', 'https://www.youtube.com', 'youtube.com', 'www.youtube.com');
-- 
-- DELETE FROM articles 
-- WHERE url IN ('https://www.youtube.com/', 'https://youtube.com/', 'https://www.youtube.com', 'youtube.com', 'www.youtube.com');
-- 
-- DELETE FROM ai_generated_articles 
-- WHERE url IN ('https://www.youtube.com/', 'https://youtube.com/', 'https://www.youtube.com', 'youtube.com', 'www.youtube.com');
--
-- -- O alternativamente, convertir URLs de watch a embed:
-- UPDATE videos 
-- SET url = REPLACE(url, 'youtube.com/watch?v=', 'youtube.com/embed/')
-- WHERE url LIKE '%youtube.com/watch?v=%' AND url NOT LIKE '%youtube.com/embed/%';
--
-- UPDATE articles 
-- SET url = REPLACE(url, 'youtube.com/watch?v=', 'youtube.com/embed/')
-- WHERE url LIKE '%youtube.com/watch?v=%' AND url NOT LIKE '%youtube.com/embed/%';
--
-- UPDATE ai_generated_articles 
-- SET url = REPLACE(url, 'youtube.com/watch?v=', 'youtube.com/embed/')
-- WHERE url LIKE '%youtube.com/watch?v=%' AND url NOT LIKE '%youtube.com/embed/%';