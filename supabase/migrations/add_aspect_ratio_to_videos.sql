-- Agregar columnas aspect_ratio y size a la tabla videos
-- aspect_ratio: '16:9', '9:16', '1:1'
-- size: 'large', 'medium', 'small'
-- Valores por defecto: '16:9' y 'medium'

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS aspect_ratio TEXT DEFAULT '16:9'
CHECK (aspect_ratio IN ('16:9', '9:16', '1:1'));

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS size TEXT DEFAULT 'medium'
CHECK (size IN ('large', 'medium', 'small'));

-- Comentarios para documentar las columnas
COMMENT ON COLUMN videos.aspect_ratio IS 'Relación de aspecto del video: 16:9 (horizontal), 9:16 (vertical), 1:1 (cuadrado)';
COMMENT ON COLUMN videos.size IS 'Tamaño del video: large (grande), medium (mediano), small (pequeño)';