-- ============================================================================
-- QUICK FIX: Add Gallery Fields to Articles Tables
-- ============================================================================
-- 
-- This approach stores gallery URLs directly in the articles table
-- instead of using a separate gallery_images table.
--
-- Advantages:
-- - No Foreign Key constraints
-- - Simpler queries
-- - No separate table joins needed
-- - Gallery stored with the article
--
-- Execute this in Supabase SQL Editor
-- ============================================================================

-- Add gallery_urls field to articles (array of image URLs)
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS gallery_urls jsonb DEFAULT '[]'::jsonb;

-- Add gallery_template field to articles (list, grid-2, grid-3)
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS gallery_template text DEFAULT 'list' 
CHECK (gallery_template IN ('list', 'grid-2', 'grid-3'));

-- Do the same for AI generated articles
ALTER TABLE ai_generated_articles 
ADD COLUMN IF NOT EXISTS gallery_urls jsonb DEFAULT '[]'::jsonb;

ALTER TABLE ai_generated_articles 
ADD COLUMN IF NOT EXISTS gallery_template text DEFAULT 'list' 
CHECK (gallery_template IN ('list', 'grid-2', 'grid-3'));

-- Create GIN indexes for faster JSON queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_articles_gallery ON articles USING gin(gallery_urls);
CREATE INDEX IF NOT EXISTS idx_ai_articles_gallery ON ai_generated_articles USING gin(gallery_urls);

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check that columns were added
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name IN ('articles', 'ai_generated_articles') 
-- AND column_name LIKE 'gallery%'
-- ORDER BY table_name, column_name;

-- Check that indexes were created
-- SELECT indexname, tablename FROM pg_indexes 
-- WHERE indexname LIKE '%gallery%';

-- Test: View a sample article with its gallery
-- SELECT id, title, gallery_urls, gallery_template FROM articles LIMIT 1;

-- ============================================================================
-- Notes:
-- ============================================================================
-- 
-- The gallery_urls column uses JSONB (binary JSON) which:
-- - Supports array of strings (image URLs)
-- - Can be queried efficiently with GIN indexes
-- - Takes less storage than TEXT arrays
-- - Is PostgreSQL native
--
-- Example data in gallery_urls:
-- [
--   "https://storage.com/articles/image1.jpg",
--   "https://storage.com/articles/image2.jpg",
--   "https://storage.com/articles/image3.jpg"
-- ]
--
-- ============================================================================
