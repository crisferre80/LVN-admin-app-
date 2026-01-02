-- Script de verificación para la tabla advertisements
-- Funciona incluso si la tabla no existe

-- Verificar si la tabla existe
SELECT
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advertisements')
         THEN '✅ Tabla advertisements existe'
         ELSE '❌ Tabla advertisements NO existe - ejecuta create_advertisements_from_scratch.sql'
    END as tabla_status;

-- Verificar estructura de la tabla (solo si existe)
DO $$
DECLARE
    table_exists BOOLEAN;
    column_count INTEGER;
    policy_count INTEGER;
    row_count INTEGER;
BEGIN
    -- Verificar tabla
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advertisements') INTO table_exists;

    IF NOT table_exists THEN
        RAISE NOTICE 'La tabla advertisements no existe. Ejecuta create_advertisements_from_scratch.sql primero.';
        RETURN;
    END IF;

    -- Contar columnas
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'advertisements';

    -- Contar políticas
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'advertisements';

    -- Contar filas
    SELECT COUNT(*) INTO row_count FROM advertisements;

    -- Reporte
    RAISE NOTICE '=== VERIFICACIÓN DE TABLA ADVERTISEMENTS ===';
    RAISE NOTICE 'Tabla existe: ✅';
    RAISE NOTICE 'Número de columnas: % (esperado: 8)', column_count;
    RAISE NOTICE 'Número de políticas RLS: % (esperado: 2)', policy_count;
    RAISE NOTICE 'Número de anuncios de ejemplo: % (mínimo esperado: 3)', row_count;

    IF column_count >= 8 AND policy_count >= 2 AND row_count >= 3 THEN
        RAISE NOTICE '✅ Tabla advertisements configurada correctamente';
    ELSE
        RAISE NOTICE '❌ Hay problemas con la configuración. Revisa los resultados arriba.';
        IF column_count < 8 THEN
            RAISE NOTICE '   - Faltan columnas. Ejecuta quick_fix_advertisements.sql';
        END IF;
        IF policy_count < 2 THEN
            RAISE NOTICE '   - Faltan políticas RLS. Ejecuta quick_fix_advertisements.sql';
        END IF;
        IF row_count < 3 THEN
            RAISE NOTICE '   - No hay datos de ejemplo. Ejecuta quick_fix_advertisements.sql';
        END IF;
    END IF;
END $$;

-- Mostrar estructura si existe
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'advertisements'
ORDER BY ordinal_position;

-- Mostrar datos si existen
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advertisements') THEN
        RAISE NOTICE '=== PRIMEROS 3 REGISTROS ===';
    END IF;
END $$;

SELECT
    id,
    title,
    position,
    is_active,
    created_at
FROM advertisements
ORDER BY created_at DESC
LIMIT 3;