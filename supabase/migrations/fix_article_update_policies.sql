-- ============================================================================
-- FIX: Add missing UPDATE policies for articles tables
-- ============================================================================
--
-- PROBLEM:
--   - Users cannot update article publish/draft status
--   - RLS policies only allow service role or public read access
--   - Authenticated users need UPDATE permission for toggle functionality
--
-- SOLUTION:
--   - Add UPDATE policy for authenticated users on articles table
--   - Ensure ai_generated_articles has proper UPDATE policy
--
-- EXECUTION: Run this in Supabase SQL Editor
-- ============================================================================

-- ========== ARTICLES TABLE (RSS Articles) ==========

-- Drop existing problematic policy
DROP POLICY IF EXISTS "Service role can manage articles" ON articles;

-- Create proper policies for articles table
-- 1. Public can read all articles (skip if already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'articles' AND policyname = 'Anyone can view articles'
    ) THEN
        CREATE POLICY "Anyone can view articles"
          ON articles FOR SELECT
          USING (true);
    END IF;
END $$;

-- 2. Authenticated users can update articles (for publish/draft toggle)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'articles' AND policyname = 'Authenticated users can update articles'
    ) THEN
        CREATE POLICY "Authenticated users can update articles"
          ON articles FOR UPDATE
          USING (auth.role() = 'authenticated')
          WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

-- 3. Service role can do everything (for Edge Functions)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'articles' AND policyname = 'Service role can manage articles'
    ) THEN
        CREATE POLICY "Service role can manage articles"
          ON articles FOR ALL
          USING (auth.role() = 'service_role')
          WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

-- ========== AI_GENERATED_ARTICLES TABLE ==========

-- Ensure the existing policy allows updates for authenticated users
-- (This should already exist from create_ai_articles_table.sql)

-- If the policy doesn't exist, create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'ai_generated_articles'
        AND policyname = 'Authenticated users full access to AI articles'
    ) THEN
        CREATE POLICY "Authenticated users full access to AI articles"
          ON ai_generated_articles FOR ALL
          USING (auth.role() = 'authenticated')
          WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

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

-- Test update permission (run as authenticated user):
-- UPDATE articles SET published_at = '1970-01-01T00:00:00.000Z' WHERE id = 'some-id';
-- UPDATE ai_generated_articles SET status = 'draft' WHERE id = 'some-id';