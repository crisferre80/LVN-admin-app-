-- Corrección final para artículos AI generados
-- Ejecuta esto si aún ves categorías en inglés

UPDATE ai_generated_articles
SET category = 'Economía'
WHERE category = 'Business';

UPDATE ai_generated_articles
SET category = 'Regionales'
WHERE category = 'locales';

-- Verificar que se corrigieron
SELECT category, COUNT(*) as cantidad
FROM ai_generated_articles
GROUP BY category
ORDER BY cantidad DESC;