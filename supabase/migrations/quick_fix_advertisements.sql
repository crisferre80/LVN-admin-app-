-- SOLUCIÓN RÁPIDA PARA TABLA ADVERTISEMENTS
-- Ejecutar este script si tienes problemas con la tabla advertisements
-- Combina diagnóstico y corrección automática

-- PASO 1: Diagnosticar
DO $$
DECLARE
    has_placement BOOLEAN;
    has_position BOOLEAN;
    table_exists BOOLEAN;
BEGIN
    -- Verificar tabla
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advertisements') INTO table_exists;

    IF NOT table_exists THEN
        RAISE EXCEPTION 'La tabla advertisements no existe. Ejecuta create_admin_tables.sql primero.';
    END IF;

    -- Verificar columnas
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'advertisements' AND column_name = 'placement') INTO has_placement;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'advertisements' AND column_name = 'position') INTO has_position;

    RAISE NOTICE 'Diagnóstico: tabla existe=%, placement=%, position=%', table_exists, has_placement, has_position;

    -- PASO 2: Corregir
    IF has_placement AND NOT has_position THEN
        -- Renombrar placement a position
        ALTER TABLE advertisements RENAME COLUMN placement TO position;
        RAISE NOTICE '✅ Columna placement renombrada a position';

        -- Actualizar constraint si existe
        ALTER TABLE advertisements DROP CONSTRAINT IF EXISTS advertisements_placement_check;
        ALTER TABLE advertisements ADD CONSTRAINT advertisements_position_check
            CHECK (position IN ('sidebar', 'header', 'footer', 'article'));
        RAISE NOTICE '✅ Constraint actualizado';

    ELSIF NOT has_placement AND NOT has_position THEN
        -- Agregar columna position
        ALTER TABLE advertisements ADD COLUMN position TEXT NOT NULL DEFAULT 'sidebar'
            CHECK (position IN ('sidebar', 'header', 'footer', 'article'));
        RAISE NOTICE '✅ Columna position agregada';
    END IF;

    -- PASO 3: Asegurar otras columnas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'advertisements' AND column_name = 'is_active') THEN
        ALTER TABLE advertisements ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ Columna is_active agregada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'advertisements' AND column_name = 'created_at') THEN
        ALTER TABLE advertisements ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE '✅ Columna created_at agregada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'advertisements' AND column_name = 'updated_at') THEN
        ALTER TABLE advertisements ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE '✅ Columna updated_at agregada';
    END IF;

    -- PASO 4: Configurar RLS
    ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

    -- Crear políticas si no existen
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'advertisements' AND policyname = 'Public read access for active advertisements') THEN
        CREATE POLICY "Public read access for active advertisements" ON advertisements
          FOR SELECT USING (is_active = true);
        RAISE NOTICE '✅ Política de lectura pública creada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'advertisements' AND policyname = 'Admin full access to advertisements') THEN
        CREATE POLICY "Admin full access to advertisements" ON advertisements
          FOR ALL USING (auth.role() = 'authenticated');
        RAISE NOTICE '✅ Política de acceso admin creada';
    END IF;

    -- PASO 5: Insertar datos de ejemplo si está vacío
    IF NOT EXISTS (SELECT 1 FROM advertisements LIMIT 1) THEN
        INSERT INTO advertisements (title, image_url, link_url, position, is_active) VALUES
        ('Anuncio Principal', 'https://via.placeholder.com/300x200?text=Anuncio+Principal', 'https://example.com', 'header', true),
        ('Sidebar Anuncio', 'https://via.placeholder.com/250x300?text=Sidebar', 'https://example.com/sidebar', 'sidebar', true),
        ('Footer Banner', 'https://via.placeholder.com/800x100?text=Footer+Banner', 'https://example.com/footer', 'footer', true);
        RAISE NOTICE '✅ Datos de ejemplo insertados';
    END IF;

    RAISE NOTICE '🎉 ¡Tabla advertisements corregida exitosamente!';
END $$;

-- Crear trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_advertisements_updated_at ON advertisements;
CREATE TRIGGER update_advertisements_updated_at
    BEFORE UPDATE ON advertisements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verificación final
SELECT
    'Tabla corregida exitosamente' as status,
    COUNT(*) as total_anuncios
FROM advertisements;