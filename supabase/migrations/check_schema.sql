-- Script de diagnóstico para verificar el esquema de la tabla articles
-- Ejecuta esto primero para ver qué columnas tiene la tabla

-- Ver estructura de la tabla articles
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'articles'
ORDER BY ordinal_position;

-- Ver estructura de la tabla rss_sources
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'rss_sources'
ORDER BY ordinal_position;