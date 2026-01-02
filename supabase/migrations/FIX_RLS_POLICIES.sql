-- ============================================================================
-- CRITICAL FIX: Add missing INSERT/UPDATE/DELETE RLS policies for gallery tables
-- ============================================================================
-- 
-- ERROR: "new row violates row-level security policy for table gallery_images"
-- ERROR CODE: 42501
-- 
-- PROBLEM: 
--   - gallery_images table has RLS enabled
--   - Only SELECT policy exists
--   - No INSERT policy = cannot save images
-- 
-- SOLUTION:
--   - Add INSERT policy for authenticated users
--   - Add UPDATE policy for authenticated users
--   - Add DELETE policy for authenticated users
--   - Do the same for ai_gallery_images table
--
-- EXECUTION: Run this in Supabase SQL Editor
-- ============================================================================

-- ========== GALLERY_IMAGES TABLE ==========

-- 1. Drop existing policies (if any exist)
DROP POLICY IF EXISTS "Authenticated users can insert gallery images" ON gallery_images;
DROP POLICY IF EXISTS "Users can update gallery images" ON gallery_images;
DROP POLICY IF EXISTS "Users can delete gallery images" ON gallery_images;

-- 2. Create INSERT policy
CREATE POLICY "Authenticated users can insert gallery images"
  ON gallery_images FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 3. Create UPDATE policy
CREATE POLICY "Users can update gallery images"
  ON gallery_images FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. Create DELETE policy
CREATE POLICY "Users can delete gallery images"
  ON gallery_images FOR DELETE
  USING (auth.role() = 'authenticated');


-- ========== AI_GALLERY_IMAGES TABLE ==========

-- 1. Drop existing policies (if any exist)
DROP POLICY IF EXISTS "Authenticated users can insert ai gallery images" ON ai_gallery_images;
DROP POLICY IF EXISTS "Users can update ai gallery images" ON ai_gallery_images;
DROP POLICY IF EXISTS "Users can delete ai gallery images" ON ai_gallery_images;

-- 2. Create INSERT policy
CREATE POLICY "Authenticated users can insert ai gallery images"
  ON ai_gallery_images FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 3. Create UPDATE policy
CREATE POLICY "Users can update ai gallery images"
  ON ai_gallery_images FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. Create DELETE policy
CREATE POLICY "Users can delete ai gallery images"
  ON ai_gallery_images FOR DELETE
  USING (auth.role() = 'authenticated');


-- ========== VERIFICATION ==========
-- Run these SELECT statements to verify policies were created:

-- SELECT * FROM pg_policies WHERE tablename = 'gallery_images';
-- SELECT * FROM pg_policies WHERE tablename = 'ai_gallery_images';

-- Expected output: 4 policies per table (SELECT, INSERT, UPDATE, DELETE)
