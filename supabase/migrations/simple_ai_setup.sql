-- Script simplificado para configurar ai_generated_articles
-- Solo las modificaciones esenciales

-- Agregar campos necesarios
ALTER TABLE ai_generated_articles 
ADD COLUMN IF NOT EXISTS gallery_urls TEXT[],
ADD COLUMN IF NOT EXISTS gallery_template TEXT DEFAULT 'list',
ADD COLUMN IF NOT EXISTS author TEXT DEFAULT 'IA',
ADD COLUMN IF NOT EXISTS url TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS visits INTEGER DEFAULT 0;

-- Verificar el estado del artículo problemático
SELECT 
  'articles' as tabla,
  id, 
  title, 
  author,
  category,
  created_at
FROM articles 
WHERE id = '75321bcc-1119-4c55-b440-d55271724bbc'
UNION ALL
SELECT 
  'ai_generated_articles' as tabla,
  id, 
  title, 
  COALESCE(author, 'IA') as author,
  category,
  created_at
FROM ai_generated_articles 
WHERE id = '75321bcc-1119-4c55-b440-d55271724bbc';