-- Agregar campos faltantes a la tabla ai_generated_articles
-- Fecha: 15 de octubre de 2025

-- Agregar campo summary para la reseña o volanta
ALTER TABLE ai_generated_articles
ADD COLUMN IF NOT EXISTS summary TEXT;

-- Agregar campo image_url si no existe
ALTER TABLE ai_generated_articles
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Agregar campo image_caption para el pie de foto
ALTER TABLE ai_generated_articles
ADD COLUMN IF NOT EXISTS image_caption TEXT;