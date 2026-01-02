-- Verificar si las columnas gallery_urls y gallery_template existen en las tablas
SELECT
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name IN ('articles', 'ai_generated_articles')
AND column_name IN ('gallery_urls', 'gallery_template')
ORDER BY table_name, column_name;