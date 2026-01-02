-- Crear tabla para comentarios de artículos
CREATE TABLE IF NOT EXISTS article_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL,
  article_type VARCHAR(10) NOT NULL CHECK (article_type IN ('rss', 'ai')),
  author_name VARCHAR(255),
  author_email VARCHAR(255),
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices por separado
CREATE INDEX IF NOT EXISTS idx_article_comments_article ON article_comments (article_id, article_type);
CREATE INDEX IF NOT EXISTS idx_article_comments_created_at ON article_comments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_comments_approved ON article_comments (is_approved);

-- Políticas RLS (Row Level Security)
ALTER TABLE article_comments ENABLE ROW LEVEL SECURITY;

-- Política para que todos puedan leer comentarios aprobados
CREATE POLICY "Anyone can read approved comments" ON article_comments
  FOR SELECT USING (is_approved = true);

-- Política para que todos puedan insertar comentarios (se pueden moderar después)
CREATE POLICY "Anyone can insert comments" ON article_comments
  FOR INSERT WITH CHECK (true);

-- Política para que solo administradores puedan actualizar (para moderación)
CREATE POLICY "Admins can update comments" ON article_comments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_article_comments_updated_at
  BEFORE UPDATE ON article_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();