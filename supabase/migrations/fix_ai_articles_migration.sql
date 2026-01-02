-- Script para diagnosticar y corregir el problema de artículos AI
-- Fecha: 8 de noviembre de 2025

-- 1. Verificar si el artículo existe en ambas tablas
SELECT 'En tabla articles' as ubicacion, id, title, author, created_at 
FROM articles 
WHERE id = '75321bcc-1119-4c55-b440-d55271724bbc'
UNION ALL
SELECT 'En tabla ai_generated_articles' as ubicacion, id, title, 'IA' as author, created_at 
FROM ai_generated_articles 
WHERE id = '75321bcc-1119-4c55-b440-d55271724bbc';

-- 2. Verificar la estructura de ambas tablas para asegurar compatibilidad
SELECT 'articles' as tabla, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'articles' 
AND table_schema = 'public'
UNION ALL
SELECT 'ai_generated_articles' as tabla, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'ai_generated_articles' 
AND table_schema = 'public'
ORDER BY tabla, column_name;

-- 3. Verificar las políticas RLS de ambas tablas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('articles', 'ai_generated_articles')
ORDER BY tablename, policyname;

-- 4. Agregar campos faltantes a ai_generated_articles si no existen
ALTER TABLE ai_generated_articles 
ADD COLUMN IF NOT EXISTS gallery_urls TEXT[],
ADD COLUMN IF NOT EXISTS gallery_template TEXT DEFAULT 'list' CHECK (gallery_template IN ('list', 'grid-2', 'grid-3')),
ADD COLUMN IF NOT EXISTS author TEXT DEFAULT 'IA',
ADD COLUMN IF NOT EXISTS url TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS visits INTEGER DEFAULT 0;

-- 5. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_ai_articles_status ON ai_generated_articles(status);
CREATE INDEX IF NOT EXISTS idx_ai_articles_category ON ai_generated_articles(category);
CREATE INDEX IF NOT EXISTS idx_ai_articles_created_at ON ai_generated_articles(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_articles_published_at ON ai_generated_articles(published_at);

-- 6. Comentarios para documentar los campos
COMMENT ON COLUMN ai_generated_articles.gallery_urls IS 'Array de URLs de imágenes para la galería del artículo';
COMMENT ON COLUMN ai_generated_articles.gallery_template IS 'Plantilla de visualización de la galería: list, grid-2, grid-3';
COMMENT ON COLUMN ai_generated_articles.author IS 'Autor del artículo, por defecto IA';
COMMENT ON COLUMN ai_generated_articles.url IS 'URL original del artículo si viene de RSS';
COMMENT ON COLUMN ai_generated_articles.description IS 'Descripción breve del artículo (equivalente a summary)';
COMMENT ON COLUMN ai_generated_articles.visits IS 'Contador de visitas del artículo';