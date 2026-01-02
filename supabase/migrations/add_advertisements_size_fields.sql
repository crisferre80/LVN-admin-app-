-- SQL para agregar campos faltantes a la tabla advertisements
-- Ejecutar este script si la tabla ya existe pero le faltan campos de tamaño u otros campos

-- Verificar si existen los campos y agregarlos si faltan
DO $$
BEGIN
    -- Agregar campo width si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'advertisements' AND column_name = 'width') THEN
        ALTER TABLE advertisements ADD COLUMN width INTEGER NOT NULL DEFAULT 300;
        RAISE NOTICE 'Campo width agregado a la tabla advertisements';
    END IF;

    -- Agregar campo height si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'advertisements' AND column_name = 'height') THEN
        ALTER TABLE advertisements ADD COLUMN height INTEGER NOT NULL DEFAULT 250;
        RAISE NOTICE 'Campo height agregado a la tabla advertisements';
    END IF;

    -- Agregar campo start_date si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'advertisements' AND column_name = 'start_date') THEN
        ALTER TABLE advertisements ADD COLUMN start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Campo start_date agregado a la tabla advertisements';
    END IF;

    -- Agregar campo end_date si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'advertisements' AND column_name = 'end_date') THEN
        ALTER TABLE advertisements ADD COLUMN end_date TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Campo end_date agregado a la tabla advertisements';
    END IF;

    -- Agregar campo click_count si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'advertisements' AND column_name = 'click_count') THEN
        ALTER TABLE advertisements ADD COLUMN click_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Campo click_count agregado a la tabla advertisements';
    END IF;

    -- Agregar campo impression_count si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'advertisements' AND column_name = 'impression_count') THEN
        ALTER TABLE advertisements ADD COLUMN impression_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Campo impression_count agregado a la tabla advertisements';
    END IF;

    -- Agregar campo updated_at si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'advertisements' AND column_name = 'updated_at') THEN
        ALTER TABLE advertisements ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Campo updated_at agregado a la tabla advertisements';
    END IF;

    -- Verificar si existe el constraint correcto para placement/position
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'advertisements' AND column_name = 'placement') THEN
        -- Si usa 'placement', verificar el constraint
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc
                       JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
                       WHERE tc.table_name = 'advertisements' AND tc.constraint_type = 'CHECK'
                       AND cc.constraint_name LIKE '%placement%') THEN
            ALTER TABLE advertisements ADD CONSTRAINT advertisements_placement_check
                CHECK (placement IN ('header', 'sidebar', 'footer', 'content'));
            RAISE NOTICE 'Constraint de placement agregado';
        END IF;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'advertisements' AND column_name = 'position') THEN
        -- Si usa 'position', verificar el constraint
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc
                       JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
                       WHERE tc.table_name = 'advertisements' AND tc.constraint_type = 'CHECK'
                       AND cc.constraint_name LIKE '%position%') THEN
            ALTER TABLE advertisements ADD CONSTRAINT advertisements_position_check
                CHECK (position IN ('sidebar', 'header', 'footer', 'article'));
            RAISE NOTICE 'Constraint de position agregado';
        END IF;
    END IF;

END $$;

-- Crear trigger para updated_at si no existe
DROP TRIGGER IF EXISTS update_advertisements_updated_at ON advertisements;
CREATE TRIGGER update_advertisements_updated_at
    BEFORE UPDATE ON advertisements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verificar la estructura final de la tabla
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'advertisements'
ORDER BY ordinal_position;