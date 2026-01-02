-- Agregar campo size a la tabla videos
-- Este script agrega la columna 'size' con valores por defecto

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS size TEXT DEFAULT 'medium'
CHECK (size IN ('large', 'medium', 'small'));

-- Comentario sobre la nueva columna
COMMENT ON COLUMN videos.size IS 'Tamaño del video: large (grande), medium (mediano), small (pequeño)';

-- Actualizar videos existentes que no tengan valor en size
UPDATE videos
SET size = 'medium'
WHERE size IS NULL;