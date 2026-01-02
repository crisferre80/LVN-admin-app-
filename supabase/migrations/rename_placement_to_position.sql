-- Script para renombrar columna 'placement' a 'position' en tabla advertisements
-- Esto mantiene consistencia con el código React

DO $$
BEGIN
    -- Verificar si existe la columna 'placement' y no existe 'position'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'advertisements' AND column_name = 'placement')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'advertisements' AND column_name = 'position') THEN

        -- Renombrar la columna
        ALTER TABLE advertisements RENAME COLUMN placement TO position;

        RAISE NOTICE 'Columna placement renombrada a position';

        -- Actualizar el constraint si existe
        IF EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name LIKE '%placement%') THEN
            -- Primero eliminar el constraint antiguo
            ALTER TABLE advertisements DROP CONSTRAINT IF EXISTS advertisements_placement_check;

            -- Crear el nuevo constraint
            ALTER TABLE advertisements ADD CONSTRAINT advertisements_position_check
                CHECK (position IN ('sidebar', 'header', 'footer', 'article'));
            RAISE NOTICE 'Constraint actualizado para columna position';
        END IF;

    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'advertisements' AND column_name = 'placement')
          AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'advertisements' AND column_name = 'position') THEN

        -- Si no existe ninguna de las dos, crear la columna position
        ALTER TABLE advertisements ADD COLUMN position TEXT NOT NULL DEFAULT 'sidebar'
            CHECK (position IN ('sidebar', 'header', 'footer', 'article'));
        RAISE NOTICE 'Columna position creada';

    ELSE
        RAISE NOTICE 'La tabla ya tiene la estructura correcta';
    END IF;
END $$;

-- Verificar el resultado
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'advertisements'
  AND column_name IN ('position', 'placement')
ORDER BY column_name;