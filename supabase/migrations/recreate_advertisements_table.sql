-- Script alternativo: Recrear tabla advertisements desde cero
-- Usar solo si quieres eliminar la tabla existente y crearla de nuevo

-- Eliminar tabla existente si existe
DROP TABLE IF EXISTS advertisements CASCADE;

-- Crear tabla advertisements completa
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

-- Habilitar RLS
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- Crear políticas
CREATE POLICY "Public read access for active advertisements" ON advertisements
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admin full access to advertisements" ON advertisements
  FOR ALL USING (auth.role() = 'authenticated');

-- Insertar datos de ejemplo
INSERT INTO advertisements (title, image_url, link_url, position, is_active) VALUES
('Anuncio Principal', 'https://via.placeholder.com/300x200?text=Anuncio+Principal', 'https://example.com', 'header', true),
('Sidebar Anuncio', 'https://via.placeholder.com/250x300?text=Sidebar', 'https://example.com/sidebar', 'sidebar', true),
('Footer Banner', 'https://via.placeholder.com/800x100?text=Footer+Banner', 'https://example.com/footer', 'footer', true);

-- Crear trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_advertisements_updated_at
    BEFORE UPDATE ON advertisements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

CREATE POLICY "Public read access for media files" ON media_files
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage media files" ON media_files
  FOR ALL USING (auth.role() = 'authenticated');

-- Tabla advertisements recreada exitosamente desde cero.