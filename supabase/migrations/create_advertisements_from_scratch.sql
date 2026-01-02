-- Script completo para configurar tabla advertisements desde cero
-- Ejecutar este script si la tabla no existe o tiene problemas

-- PASO 1: Crear tabla si no existe
CREATE TABLE IF NOT EXISTS advertisements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('sidebar', 'header', 'footer', 'article')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PASO 2: Habilitar RLS
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- PASO 3: Crear políticas de seguridad
DROP POLICY IF EXISTS "Public read access for active advertisements" ON advertisements;
CREATE POLICY "Public read access for active advertisements" ON advertisements
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admin full access to advertisements" ON advertisements;
CREATE POLICY "Admin full access to advertisements" ON advertisements
  FOR ALL USING (auth.role() = 'authenticated');

-- PASO 4: Crear tabla media_files si no existe
CREATE TABLE IF NOT EXISTS media_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PASO 5: Configurar RLS para media_files
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for media files" ON media_files;
CREATE POLICY "Public read access for media files" ON media_files
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage media files" ON media_files;
CREATE POLICY "Authenticated users can manage media files" ON media_files
  FOR ALL USING (auth.role() = 'authenticated');

-- PASO 6: Insertar datos de ejemplo si la tabla está vacía
INSERT INTO advertisements (title, image_url, link_url, position, is_active)
SELECT * FROM (VALUES
    ('Anuncio Principal', 'https://via.placeholder.com/300x200?text=Anuncio+Principal', 'https://example.com', 'header'::text, true),
    ('Sidebar Anuncio', 'https://via.placeholder.com/250x300?text=Sidebar', 'https://example.com/sidebar', 'sidebar'::text, true),
    ('Footer Banner', 'https://via.placeholder.com/800x100?text=Footer+Banner', 'https://example.com/footer', 'footer'::text, true)
) AS v(title, image_url, link_url, position, is_active)
WHERE NOT EXISTS (SELECT 1 FROM advertisements LIMIT 1);

-- PASO 7: Crear función y trigger para updated_at
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

-- PASO 8: Verificación final
SELECT
    '✅ Tabla advertisements creada exitosamente' as status,
    COUNT(*) as total_anuncios
FROM advertisements;

-- Mostrar estructura de la tabla
SELECT
    'Columnas de advertisements:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'advertisements'
ORDER BY ordinal_position;