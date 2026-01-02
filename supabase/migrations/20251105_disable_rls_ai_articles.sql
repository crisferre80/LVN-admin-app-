-- Deshabilitar RLS para ai_generated_articles para debugging
-- Eliminar todas las políticas existentes y deshabilitar RLS

-- Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Public read access for published AI articles" ON ai_generated_articles;
DROP POLICY IF EXISTS "Authenticated users full access to AI articles" ON ai_generated_articles;

-- Deshabilitar Row Level Security
ALTER TABLE ai_generated_articles DISABLE ROW LEVEL SECURITY;