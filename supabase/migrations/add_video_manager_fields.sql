-- Script para agregar las nuevas columnas al VideoManager
-- Ejecutar este script en la base de datos

-- Agregar nuevas columnas a la tabla videos
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS video_file_url TEXT,
ADD COLUMN IF NOT EXISTS pre_live_video_url TEXT,
ADD COLUMN IF NOT EXISTS pre_live_video_file TEXT,
ADD COLUMN IF NOT EXISTS lower_third_names TEXT[],
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS has_countdown BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS countdown_target_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS countdown_title TEXT,
ADD COLUMN IF NOT EXISTS countdown_message TEXT,
ADD COLUMN IF NOT EXISTS auto_switch_to_live BOOLEAN DEFAULT false;

-- Actualizar videos existentes para que sean visibles por defecto
UPDATE videos 
SET is_visible = true 
WHERE is_visible IS NULL;

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_videos_is_visible ON videos(is_visible);
CREATE INDEX IF NOT EXISTS idx_videos_has_countdown ON videos(has_countdown);
CREATE INDEX IF NOT EXISTS idx_videos_countdown_target_date ON videos(countdown_target_date);

-- Comentarios de documentación
COMMENT ON COLUMN videos.video_file_url IS 'URL del archivo de video principal subido';
COMMENT ON COLUMN videos.pre_live_video_url IS 'URL del video copete para mostrar antes del vivo';
COMMENT ON COLUMN videos.pre_live_video_file IS 'URL del archivo de copete subido';
COMMENT ON COLUMN videos.lower_third_names IS 'Array de nombres/títulos de personajes para lower third';
COMMENT ON COLUMN videos.is_visible IS 'Controla si el video es visible para los usuarios';
COMMENT ON COLUMN videos.has_countdown IS 'Indica si el video tiene conteo regresivo';
COMMENT ON COLUMN videos.countdown_target_date IS 'Fecha objetivo para el conteo regresivo';
COMMENT ON COLUMN videos.countdown_title IS 'Título del conteo regresivo';
COMMENT ON COLUMN videos.countdown_message IS 'Mensaje del conteo regresivo';
COMMENT ON COLUMN videos.auto_switch_to_live IS 'Cambiar automáticamente al vivo después del conteo';