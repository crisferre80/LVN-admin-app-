-- Create videos table for video management
-- Migration: 20251022222131_create_videos_table

CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL,
  placement TEXT NOT NULL CHECK (placement IN ('featured', 'inline')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Allow public read access for videos
CREATE POLICY "Public read access for videos" ON videos
  FOR SELECT USING (true);

-- Allow authenticated users full access
CREATE POLICY "Authenticated users full access to videos" ON videos
  FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated' OR auth.jwt() IS NOT NULL);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for videos table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_videos_updated_at') THEN
        CREATE TRIGGER update_videos_updated_at
            BEFORE UPDATE ON videos
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;