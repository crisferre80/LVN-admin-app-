-- Script to update existing articles with correct category from RSS sources
-- This ensures that articles have the same category as their RSS source

UPDATE articles
SET category = rss_sources.category
FROM rss_sources
WHERE articles.rss_source_id = rss_sources.id
AND articles.category != rss_sources.category;

-- Show the results
SELECT
  a.id,
  a.title,
  a.category as old_category,
  rs.category as new_category,
  rs.name as rss_source_name
FROM articles a
JOIN rss_sources rs ON a.rss_source_id = rs.id
WHERE a.category != rs.category;