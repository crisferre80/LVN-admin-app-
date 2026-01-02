-- =============================================
-- Tabla de Noticias Locales
-- =============================================
-- Esta tabla almacena noticias locales extraídas de feeds RSS
-- de medios locales como Diario Panorama e Info del Estero

-- Eliminar la tabla si ya existe (para desarrollo)
DROP TABLE IF EXISTS local_news CASCADE;

-- Crear la tabla local_news
CREATE TABLE local_news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Información básica de la noticia
    title TEXT NOT NULL,
    summary TEXT, -- Resumen corto de la noticia
    content TEXT, -- Contenido sustancial de la noticia
    image_url TEXT, -- URL de la imagen de referencia
    url TEXT NOT NULL UNIQUE, -- URL original de la noticia
    
    -- Información de la fuente
    source TEXT NOT NULL, -- 'diariopanorama.com' o 'infodelestero.com'
    author TEXT, -- Autor de la noticia (si está disponible)
    
    -- Fechas
    published_at TIMESTAMP WITH TIME ZONE, -- Fecha de publicación original
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Fecha de creación en nuestra BD
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Última actualización
    
    -- Categorización
    category TEXT DEFAULT 'Regionales', -- Categoría de la noticia
    
    -- Control de calidad
    is_active BOOLEAN DEFAULT TRUE, -- Si la noticia está activa
    views INTEGER DEFAULT 0, -- Número de visualizaciones
    
    -- Índices para búsqueda
    search_vector tsvector -- Vector de búsqueda de texto completo
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_local_news_source ON local_news(source);
CREATE INDEX idx_local_news_published_at ON local_news(published_at DESC);
CREATE INDEX idx_local_news_created_at ON local_news(created_at DESC);
CREATE INDEX idx_local_news_category ON local_news(category);
CREATE INDEX idx_local_news_is_active ON local_news(is_active);
CREATE INDEX idx_local_news_url ON local_news(url);
CREATE INDEX idx_local_news_search_vector ON local_news USING gin(search_vector);

-- Crear función para actualizar el vector de búsqueda
CREATE OR REPLACE FUNCTION update_local_news_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('spanish', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.summary, '')), 'B') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.content, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar automáticamente el vector de búsqueda
CREATE TRIGGER local_news_search_vector_update
    BEFORE INSERT OR UPDATE ON local_news
    FOR EACH ROW
    EXECUTE FUNCTION update_local_news_search_vector();

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_local_news_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar updated_at
CREATE TRIGGER local_news_updated_at
    BEFORE UPDATE ON local_news
    FOR EACH ROW
    EXECUTE FUNCTION update_local_news_updated_at();

-- Habilitar Row Level Security (RLS)
ALTER TABLE local_news ENABLE ROW LEVEL SECURITY;

-- Política para lectura pública (cualquiera puede leer noticias activas)
CREATE POLICY "Las noticias locales activas son públicas"
    ON local_news
    FOR SELECT
    USING (is_active = true);

-- Política para inserción (solo usuarios autenticados o service role)
CREATE POLICY "Solo usuarios autenticados pueden insertar noticias locales"
    ON local_news
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Política para actualización (solo usuarios autenticados o service role)
CREATE POLICY "Solo usuarios autenticados pueden actualizar noticias locales"
    ON local_news
    FOR UPDATE
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Política para eliminación (solo usuarios autenticados o service role)
CREATE POLICY "Solo usuarios autenticados pueden eliminar noticias locales"
    ON local_news
    FOR DELETE
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Comentarios para documentación
COMMENT ON TABLE local_news IS 'Almacena noticias locales extraídas de feeds RSS de medios locales';
COMMENT ON COLUMN local_news.title IS 'Título de la noticia';
COMMENT ON COLUMN local_news.summary IS 'Resumen corto de la noticia';
COMMENT ON COLUMN local_news.content IS 'Contenido sustancial o completo de la noticia';
COMMENT ON COLUMN local_news.image_url IS 'URL de la imagen de referencia de la noticia';
COMMENT ON COLUMN local_news.url IS 'URL original de la noticia';
COMMENT ON COLUMN local_news.source IS 'Fuente de la noticia (diariopanorama.com o infodelestero.com)';
COMMENT ON COLUMN local_news.author IS 'Autor de la noticia si está disponible';
COMMENT ON COLUMN local_news.published_at IS 'Fecha de publicación original de la noticia';
COMMENT ON COLUMN local_news.created_at IS 'Fecha de creación del registro en la base de datos';
COMMENT ON COLUMN local_news.updated_at IS 'Fecha de última actualización del registro';
COMMENT ON COLUMN local_news.category IS 'Categoría de la noticia';
COMMENT ON COLUMN local_news.is_active IS 'Indica si la noticia está activa y visible';
COMMENT ON COLUMN local_news.views IS 'Número de visualizaciones de la noticia';
COMMENT ON COLUMN local_news.search_vector IS 'Vector de búsqueda de texto completo';

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Tabla local_news creada exitosamente con índices, triggers y políticas RLS';
END $$;
