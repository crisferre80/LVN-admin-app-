-- Script para verificar artículos AI recientes
SELECT 
  id,
  title,
  category,
  status,
  created_at,
  updated_at,
  LENGTH(content) as content_length,
  LENGTH(summary) as summary_length,
  ARRAY_LENGTH(gallery_urls, 1) as gallery_count,
  gallery_template
FROM ai_generated_articles
ORDER BY updated_at DESC NULLS LAST, created_at DESC
LIMIT 10;