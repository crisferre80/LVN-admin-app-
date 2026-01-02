-- Migration: Add RLS INSERT Policies for Gallery Images
-- Date: 2025-10-18
-- Purpose: Allow authenticated users to insert gallery images

-- RLS Policy for gallery_images table - Allow authenticated users to insert
CREATE POLICY "Authenticated users can insert gallery images"
  ON gallery_images FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- RLS Policy for gallery_images table - Allow users to update their images
CREATE POLICY "Users can update gallery images"
  ON gallery_images FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- RLS Policy for gallery_images table - Allow users to delete their images
CREATE POLICY "Users can delete gallery images"
  ON gallery_images FOR DELETE
  USING (auth.role() = 'authenticated');

-- RLS Policy for ai_gallery_images table - Allow authenticated users to insert
CREATE POLICY "Authenticated users can insert ai gallery images"
  ON ai_gallery_images FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- RLS Policy for ai_gallery_images table - Allow users to update ai images
CREATE POLICY "Users can update ai gallery images"
  ON ai_gallery_images FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- RLS Policy for ai_gallery_images table - Allow users to delete ai images
CREATE POLICY "Users can delete ai gallery images"
  ON ai_gallery_images FOR DELETE
  USING (auth.role() = 'authenticated');
