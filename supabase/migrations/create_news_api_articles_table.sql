-- Crear tabla para artículos de News API
CREATE TABLE IF NOT EXISTS news_api_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  image_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  url TEXT UNIQUE NOT NULL,
  author TEXT,
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  source_name TEXT,
  source_country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas RLS para news_api_articles
ALTER TABLE news_api_articles ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública de artículos publicados
CREATE POLICY "Public read access for published News API articles" ON news_api_articles
  FOR SELECT USING (status = 'published');

-- Política para permitir todas las operaciones para usuarios autenticados
CREATE POLICY "Authenticated users full access to News API articles" ON news_api_articles
  FOR ALL USING (auth.role() = 'authenticated');

-- Crear trigger para updated_at si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_news_api_articles_updated_at') THEN
        CREATE TRIGGER update_news_api_articles_updated_at
            BEFORE UPDATE ON news_api_articles
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;