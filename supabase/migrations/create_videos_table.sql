-- Crear tabla para gestión de videos
CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL,
  placement TEXT NOT NULL CHECK (placement IN ('featured', 'inline')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas RLS para videos
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública de todos los videos
CREATE POLICY "Public read access for videos" ON videos
  FOR SELECT USING (true);

-- Política para permitir todas las operaciones para usuarios autenticados
CREATE POLICY "Authenticated users full access to videos" ON videos
  FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated' OR auth.jwt() IS NOT NULL);

-- Crear trigger solo si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_videos_updated_at') THEN
        CREATE TRIGGER update_videos_updated_at
            BEFORE UPDATE ON videos
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;