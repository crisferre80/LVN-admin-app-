-- ============================================================================
-- Migration: Add Gallery Fields to Article Tables
-- Date: 2025-10-18
-- Purpose: Store gallery images and template directly in article tables
--          instead of using separate gallery_images tables
-- ============================================================================

-- Add gallery fields to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS gallery_urls jsonb DEFAULT '[]'::jsonb;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS gallery_template text DEFAULT 'list' CHECK (gallery_template IN ('list', 'grid-2', 'grid-3'));

-- Add gallery fields to ai_generated_articles table
ALTER TABLE ai_generated_articles ADD COLUMN IF NOT EXISTS gallery_urls jsonb DEFAULT '[]'::jsonb;
ALTER TABLE ai_generated_articles ADD COLUMN IF NOT EXISTS gallery_template text DEFAULT 'list' CHECK (gallery_template IN ('list', 'grid-2', 'grid-3'));

-- ============================================================================
-- Create indexes for faster queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_articles_gallery ON articles USING gin(gallery_urls);
CREATE INDEX IF NOT EXISTS idx_ai_articles_gallery ON ai_generated_articles USING gin(gallery_urls);

-- ============================================================================
-- Add comment explaining the new fields
-- ============================================================================
COMMENT ON COLUMN articles.gallery_urls IS 'Array of image URLs for gallery in JSON format';
COMMENT ON COLUMN articles.gallery_template IS 'Gallery template type: list, grid-2, or grid-3';
COMMENT ON COLUMN ai_generated_articles.gallery_urls IS 'Array of image URLs for gallery in JSON format';
COMMENT ON COLUMN ai_generated_articles.gallery_template IS 'Gallery template type: list, grid-2, or grid-3';

-- ============================================================================
-- Verification: Check that columns were added
-- ============================================================================
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name IN ('articles', 'ai_generated_articles') 
-- AND column_name LIKE 'gallery%';
