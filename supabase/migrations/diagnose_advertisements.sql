-- Script para diagnosticar la estructura actual de la tabla advertisements
-- Ejecutar primero para ver qué columnas existen realmente

-- Verificar si la tabla existe
SELECT
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advertisements')
         THEN '✅ Tabla advertisements existe'
         ELSE '❌ Tabla advertisements NO existe - ejecuta create_advertisements_from_scratch.sql'
    END as tabla_status;

-- Ver estructura completa de la tabla (solo si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advertisements') THEN
        RAISE NOTICE '=== ESTRUCTURA DE LA TABLA ADVERTISEMENTS ===';
    ELSE
        RAISE NOTICE 'La tabla advertisements no existe. No se puede mostrar estructura.';
        RETURN;
    END IF;
END $$;

-- Ver estructura completa de la tabla (solo si existe)
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_name = 'advertisements'
ORDER BY ordinal_position;

-- Ver si hay restricciones de clave foránea o checks (solo si existe)
SELECT
    tc.constraint_name,
    tc.constraint_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'advertisements';

-- Ver datos existentes (primeros 5 registros, solo si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advertisements') THEN
        RAISE NOTICE '=== DATOS EXISTENTES (primeros 5 registros) ===';
    END IF;
END $$;

SELECT * FROM advertisements LIMIT 5;

-- Contar registros (solo si existe)
SELECT
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advertisements')
         THEN (SELECT COUNT(*) FROM advertisements)::text
         ELSE '0 (tabla no existe)'
    END as total_registros;