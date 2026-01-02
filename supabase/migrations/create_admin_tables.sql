-- Crear tabla de anuncios para el panel de administración
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

-- Políticas RLS para advertisements
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública de anuncios activos
CREATE POLICY "Public read access for active advertisements" ON advertisements
  FOR SELECT USING (is_active = true);

-- Política para permitir todas las operaciones para usuarios autenticados (admin)
-- Nota: En una implementación real, deberías crear una tabla de usuarios admin
-- y verificar roles específicos
CREATE POLICY "Admin full access to advertisements" ON advertisements
  FOR ALL USING (auth.role() = 'authenticated');

-- Crear tabla para archivos de medios (opcional, para futura implementación)
CREATE TABLE IF NOT EXISTS media_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas RLS para media_files
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública
CREATE POLICY "Public read access for media files" ON media_files
  FOR SELECT USING (true);

-- Política para permitir todas las operaciones para usuarios autenticados
CREATE POLICY "Authenticated users can manage media files" ON media_files
  FOR ALL USING (auth.role() = 'authenticated');

-- Insertar algunos anuncios de ejemplo
INSERT INTO advertisements (title, image_url, link_url, position, is_active) VALUES
('Anuncio Principal', 'https://via.placeholder.com/300x200?text=Anuncio+Principal', 'https://example.com', 'header', true),
('Sidebar Anuncio', 'https://via.placeholder.com/250x300?text=Sidebar', 'https://example.com/sidebar', 'sidebar', true),
('Footer Banner', 'https://via.placeholder.com/800x100?text=Footer+Banner', 'https://example.com/footer', 'footer', true);