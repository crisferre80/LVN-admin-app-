-- Script completo para asegurar compatibilidad entre tablas articles y ai_generated_articles
-- Fecha: 8 de noviembre de 2025

-- Agregar todos los campos necesarios a ai_generated_articles

ALTER TABLE ai_generated_articles 
ADD COLUMN IF NOT EXISTS gallery_urls TEXT[],
ADD COLUMN IF NOT EXISTS gallery_template TEXT DEFAULT 'list' CHECK (gallery_template IN ('list', 'grid-2', 'grid-3')),
ADD COLUMN IF NOT EXISTS author TEXT DEFAULT 'IA',
ADD COLUMN IF NOT EXISTS url TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS visits INTEGER DEFAULT 0;

-- Actualizar constraint del campo gallery_template si no existe
DO $$
BEGIN
    -- Intentar agregar el constraint si no existe
    BEGIN
        ALTER TABLE ai_generated_articles 
        ADD CONSTRAINT ai_generated_articles_gallery_template_check 
        CHECK (gallery_template IN ('list', 'grid-2', 'grid-3'));
    EXCEPTION
        WHEN duplicate_object THEN
            -- El constraint ya existe, no hacer nada
            RAISE NOTICE 'Constraint gallery_template_check ya existe';
    END;
END $$;

-- Asegurar que el campo status tenga los valores correctos
ALTER TABLE ai_generated_articles 
DROP CONSTRAINT IF EXISTS ai_generated_articles_status_check,
ADD CONSTRAINT ai_generated_articles_status_check 
CHECK (status IN ('draft', 'published'));

-- Asegurar políticas RLS correctas

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Public read access for published AI articles" ON ai_generated_articles;
DROP POLICY IF EXISTS "Authenticated users full access to AI articles" ON ai_generated_articles;
DROP POLICY IF EXISTS "Allow all operations on AI articles" ON ai_generated_articles;

-- Crear políticas nuevas y más claras
CREATE POLICY "AI articles - public read published" ON ai_generated_articles
  FOR SELECT USING (status = 'published');

CREATE POLICY "AI articles - authenticated full access" ON ai_generated_articles
  FOR ALL USING (auth.jwt() IS NOT NULL);

-- Crear índices para mejor rendimiento

CREATE INDEX IF NOT EXISTS idx_ai_articles_status ON ai_generated_articles(status);
CREATE INDEX IF NOT EXISTS idx_ai_articles_category ON ai_generated_articles(category);
CREATE INDEX IF NOT EXISTS idx_ai_articles_created_at ON ai_generated_articles(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_articles_published_at ON ai_generated_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_ai_articles_source_rss_id ON ai_generated_articles(source_rss_id);
CREATE INDEX IF NOT EXISTS idx_ai_articles_gallery ON ai_generated_articles USING gin(gallery_urls);

-- Agregar comentarios para documentación

COMMENT ON TABLE ai_generated_articles IS 'Artículos generados o editados por IA, equivalente a articles pero con campos específicos para IA';
COMMENT ON COLUMN ai_generated_articles.gallery_urls IS 'Array de URLs de imágenes para la galería del artículo';
COMMENT ON COLUMN ai_generated_articles.gallery_template IS 'Plantilla de visualización de la galería: list, grid-2, grid-3';
COMMENT ON COLUMN ai_generated_articles.author IS 'Autor del artículo, por defecto IA';
COMMENT ON COLUMN ai_generated_articles.url IS 'URL original del artículo si viene de RSS';
COMMENT ON COLUMN ai_generated_articles.description IS 'Descripción breve del artículo (equivalente a summary)';
COMMENT ON COLUMN ai_generated_articles.visits IS 'Contador de visitas del artículo';
COMMENT ON COLUMN ai_generated_articles.summary IS 'Resumen o volanta del artículo';
COMMENT ON COLUMN ai_generated_articles.status IS 'Estado de publicación: draft o published';

-- Verificar que el trigger de updated_at funcione

-- Recrear el trigger si es necesario
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Eliminar trigger existente y recrear
DROP TRIGGER IF EXISTS update_ai_generated_articles_updated_at ON ai_generated_articles;
CREATE TRIGGER update_ai_generated_articles_updated_at
    BEFORE UPDATE ON ai_generated_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verificar el artículo problemático específico
SELECT 
  'articles' as tabla,
  id, 
  title, 
  author,
  category,
  created_at,
  published_at IS NOT NULL as is_published,
  LENGTH(content) as content_length
FROM articles 
WHERE id = '75321bcc-1119-4c55-b440-d55271724bbc'
UNION ALL
SELECT 
  'ai_generated_articles' as tabla,
  id, 
  title, 
  COALESCE(author, 'IA') as author,
  category,
  created_at,
  status = 'published' as is_published,
  LENGTH(content) as content_length
FROM ai_generated_articles 
WHERE id = '75321bcc-1119-4c55-b440-d55271724bbc';

-- Script completado exitosamente
-- Si el artículo aparece solo en "articles", necesitarás usar el script JavaScript para migrarlo.
-- Si aparece en ambas tablas, hay duplicación que debe resolverse.
-- Si aparece solo en "ai_generated_articles", la migración ya se completó.