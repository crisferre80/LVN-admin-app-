-- Migration: Add Gallery Images Table
-- Date: 2025-10-18
-- Purpose: Store gallery image URLs separately for better management and organization

-- Create gallery_images table
CREATE TABLE IF NOT EXISTS gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  alt_text text DEFAULT 'Imagen de galería',
  position integer NOT NULL DEFAULT 0,
  template_type text NOT NULL CHECK (template_type IN ('list', 'grid-2', 'grid-3')) DEFAULT 'list',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create gallery_images table for AI generated articles
CREATE TABLE IF NOT EXISTS ai_gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES ai_generated_articles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  alt_text text DEFAULT 'Imagen de galería',
  position integer NOT NULL DEFAULT 0,
  template_type text NOT NULL CHECK (template_type IN ('list', 'grid-2', 'grid-3')) DEFAULT 'list',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_gallery_images ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view gallery images
CREATE POLICY "Anyone can view gallery images"
  ON gallery_images FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view ai gallery images"
  ON ai_gallery_images FOR SELECT
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gallery_images_article_id ON gallery_images(article_id);
CREATE INDEX IF NOT EXISTS idx_gallery_images_position ON gallery_images(article_id, position);
CREATE INDEX IF NOT EXISTS idx_ai_gallery_images_article_id ON ai_gallery_images(article_id);
CREATE INDEX IF NOT EXISTS idx_ai_gallery_images_position ON ai_gallery_images(article_id, position);

-- Add composite unique constraint to prevent duplicate images for same article
ALTER TABLE gallery_images ADD CONSTRAINT unique_article_image UNIQUE(article_id, image_url);
ALTER TABLE ai_gallery_images ADD CONSTRAINT unique_ai_article_image UNIQUE(article_id, image_url);

-- Optional: Add comment for documentation
COMMENT ON TABLE gallery_images IS 'Stores gallery images for RSS articles with metadata';
COMMENT ON TABLE ai_gallery_images IS 'Stores gallery images for AI-generated articles with metadata';
COMMENT ON COLUMN gallery_images.template_type IS 'Type of gallery layout: list (vertical), grid-2 (2 columns), grid-3 (3 columns)';
COMMENT ON COLUMN ai_gallery_images.template_type IS 'Type of gallery layout: list (vertical), grid-2 (2 columns), grid-3 (3 columns)';
