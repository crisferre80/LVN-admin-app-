-- Update existing articles to have the correct category based on their RSS source
UPDATE articles
SET category = rss_sources.category
FROM rss_sources
WHERE articles.rss_source_id = rss_sources.id
AND rss_sources.category = 'regionales';