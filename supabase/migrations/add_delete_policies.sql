-- ============================================================================
-- ADD: DELETE policies for articles tables
-- ============================================================================
--
-- PROBLEM:
--   - Users cannot delete articles due to missing DELETE policies
--   - RLS policies only allow SELECT, UPDATE, and service role operations
--   - Authenticated users need DELETE permission for article management
--
-- SOLUTION:
--   - Add DELETE policy for authenticated users on articles table
--   - Add DELETE policy for authenticated users on ai_generated_articles table
--
-- EXECUTION: Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- ADD: DELETE policies for articles tables
-- ============================================================================
--
-- PROBLEM:
--   - Users cannot delete articles due to missing DELETE policies
--   - RLS policies only allow SELECT, UPDATE, and service role operations
--   - Authenticated users need DELETE permission for article management
--
-- SOLUTION:
--   - Add DELETE policy for authenticated users on articles table
--   - Add DELETE policy for authenticated users on ai_generated_articles table
--
-- EXECUTION: Run this in Supabase SQL Editor
-- ============================================================================

-- ========== ARTICLES TABLE (RSS Articles) ==========

-- Drop existing policy if it exists, then create new one
DROP POLICY IF EXISTS "Authenticated users can delete articles" ON articles;

CREATE POLICY "Authenticated users can delete articles"
  ON articles FOR DELETE
  USING (auth.role() = 'authenticated');

-- ========== AI_GENERATED_ARTICLES TABLE ==========

-- Drop existing policy if it exists, then create new one
DROP POLICY IF EXISTS "Authenticated users can delete AI articles" ON ai_generated_articles;

CREATE POLICY "Authenticated users can delete AI articles"
  ON ai_generated_articles FOR DELETE
  USING (auth.role() = 'authenticated');

-- ========== VERIFICATION ==========

-- Run these queries to verify the policies:

-- Check articles policies:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'articles'
ORDER BY policyname;

-- Check ai_generated_articles policies:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'ai_generated_articles'
ORDER BY policyname;

-- Test delete permission (run as authenticated user):
-- DELETE FROM articles WHERE id = 'some-id';
-- DELETE FROM ai_generated_articles WHERE id = 'some-id';