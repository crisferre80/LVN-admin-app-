-- Script para verificar y corregir la tabla advertisements
-- Ejecutar este script si hay errores con la tabla existente

-- Primero, verificar si la tabla existe y qué columnas tiene
DO $$
BEGIN
    -- Verificar si la tabla advertisements existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advertisements') THEN
        -- Crear la tabla completa si no existe
        CREATE TABLE advertisements (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          title TEXT NOT NULL,
          image_url TEXT NOT NULL,
          link_url TEXT NOT NULL,
          position TEXT NOT NULL CHECK (position IN ('sidebar', 'header', 'footer', 'article')),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        RAISE NOTICE 'Tabla advertisements creada exitosamente';
    ELSE
        -- La tabla existe, verificar y agregar columnas faltantes
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'advertisements' AND column_name = 'position') THEN
            ALTER TABLE advertisements ADD COLUMN position TEXT NOT NULL DEFAULT 'sidebar' CHECK (position IN ('sidebar', 'header', 'footer', 'article'));
            RAISE NOTICE 'Columna position agregada a advertisements';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'advertisements' AND column_name = 'is_active') THEN
            ALTER TABLE advertisements ADD COLUMN is_active BOOLEAN DEFAULT true;
            RAISE NOTICE 'Columna is_active agregada a advertisements';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'advertisements' AND column_name = 'created_at') THEN
            ALTER TABLE advertisements ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            RAISE NOTICE 'Columna created_at agregada a advertisements';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'advertisements' AND column_name = 'updated_at') THEN
            ALTER TABLE advertisements ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            RAISE NOTICE 'Columna updated_at agregada a advertisements';
        END IF;
    END IF;
END $$;

-- Habilitar RLS si no está habilitado
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- Crear políticas si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'advertisements' AND policyname = 'Public read access for active advertisements') THEN
        CREATE POLICY "Public read access for active advertisements" ON advertisements
          FOR SELECT USING (is_active = true);
        RAISE NOTICE 'Política de lectura pública creada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'advertisements' AND policyname = 'Admin full access to advertisements') THEN
        CREATE POLICY "Admin full access to advertisements" ON advertisements
          FOR ALL USING (auth.role() = 'authenticated');
        RAISE NOTICE 'Política de acceso admin creada';
    END IF;
END $$;

-- Insertar datos de ejemplo si la tabla está vacía
INSERT INTO advertisements (title, image_url, link_url, position, is_active)
SELECT * FROM (VALUES
    ('Anuncio Principal', 'https://via.placeholder.com/300x200?text=Anuncio+Principal', 'https://example.com', 'header'::text, true),
    ('Sidebar Anuncio', 'https://via.placeholder.com/250x300?text=Sidebar', 'https://example.com/sidebar', 'sidebar'::text, true),
    ('Footer Banner', 'https://via.placeholder.com/800x100?text=Footer+Banner', 'https://example.com/footer', 'footer'::text, true)
) AS v(title, image_url, link_url, position, is_active)
WHERE NOT EXISTS (SELECT 1 FROM advertisements LIMIT 1);

-- Crear tabla media_files si no existe
CREATE TABLE IF NOT EXISTS media_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configurar RLS para media_files
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

-- Crear políticas para media_files si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'media_files' AND policyname = 'Public read access for media files') THEN
        CREATE POLICY "Public read access for media files" ON media_files
          FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'media_files' AND policyname = 'Authenticated users can manage media files') THEN
        CREATE POLICY "Authenticated users can manage media files" ON media_files
          FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Crear trigger para updated_at si no existe
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

-- Script completado exitosamente. La tabla advertisements está lista para usar.