-- Add is_live field to videos table for live streaming support
-- Migration: add_live_streaming_support

ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;

-- Update existing videos to not be live by default
UPDATE videos SET is_live = FALSE WHERE is_live IS NULL;

-- Add comment to the column
COMMENT ON COLUMN videos.is_live IS 'Indicates if this is a live streaming video';