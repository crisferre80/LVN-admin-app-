-- Crear tabla para artículos generados por IA
CREATE TABLE IF NOT EXISTS ai_generated_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  source_rss_id UUID REFERENCES rss_sources(id),
  prompt_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas RLS para ai_generated_articles
ALTER TABLE ai_generated_articles ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública de artículos publicados
CREATE POLICY "Public read access for published AI articles" ON ai_generated_articles
  FOR SELECT USING (status = 'published');

-- Política para permitir todas las operaciones para usuarios autenticados
CREATE POLICY "Authenticated users full access to AI articles" ON ai_generated_articles
  FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated' OR auth.jwt() IS NOT NULL);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear trigger solo si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ai_generated_articles_updated_at') THEN
        CREATE TRIGGER update_ai_generated_articles_updated_at
            BEFORE UPDATE ON ai_generated_articles
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;