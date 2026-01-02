-- Add new columns to videos table for enhanced video management
ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS custom_lower_third TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS custom_header TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE videos ADD COLUMN IF NOT EXISTS custom_logo_url TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS embed_code TEXT;

-- Update the placement CHECK constraint to include new options
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_placement_check;
ALTER TABLE videos ADD CONSTRAINT videos_placement_check
  CHECK (placement IN ('featured', 'inline', 'sidebar', 'hero'));