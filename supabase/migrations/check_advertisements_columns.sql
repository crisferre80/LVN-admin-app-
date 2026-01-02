-- Verificar estructura de la tabla advertisements
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'advertisements'
ORDER BY ordinal_position;