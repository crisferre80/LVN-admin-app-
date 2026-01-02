-- Actualizar categorías en Supabase para agregar y reemplazar las nuevas etiquetas
-- Este script alinea las categorías de los artículos con el nuevo catálogo permitido
-- Catálogo final esperado: Regionales, Nacionales, Internacionales, Economia, Politica,
-- Deportes, Espectaculos, Opinión, Agro, Medio Ambiente, Tecnologia

UPDATE articles SET category = 'Regionales' WHERE category = 'Locales';
UPDATE articles SET category = 'Espectaculos' WHERE category IN ('Cultura', 'Espectáculos');
UPDATE articles SET category = 'Economia' WHERE category IN ('Economía');
UPDATE articles SET category = 'Politica' WHERE category IN ('Política');
UPDATE articles SET category = 'Tecnologia' WHERE category IN ('Tecnología');

UPDATE articles
SET category = 'Medio Ambiente'
WHERE category = 'Nacionales'
  AND id IN (
    SELECT id FROM articles
    WHERE category = 'Nacionales'
    ORDER BY created_at DESC
    LIMIT 30
  );

-- Actualizar algunos artículos de 'Nacionales' a 'Opinión'
UPDATE articles
SET category = 'Opinión'
WHERE category = 'Nacionales'
  AND id IN (
    SELECT id FROM articles
    WHERE category = 'Nacionales'
    ORDER BY created_at DESC
    LIMIT 30
  );

-- Actualizar algunos artículos de 'Nacionales' a 'Agro'
UPDATE articles
SET category = 'Agro'
WHERE category = 'Nacionales'
  AND id IN (
    SELECT id FROM articles
    WHERE category = 'Nacionales'
    ORDER BY created_at DESC
    LIMIT 20
  );

-- Actualizar algunos artículos de 'Nacionales' a 'Deportes'
UPDATE articles
SET category = 'Deportes'
WHERE category = 'Nacionales'
  AND id IN (
    SELECT id FROM articles
    WHERE category = 'Nacionales'
    ORDER BY created_at DESC
    LIMIT 20
  );

-- Actualizar algunos artículos de 'Internacionales' a 'Politica'
UPDATE articles
SET category = 'Politica'
WHERE category = 'Internacionales'
  AND id IN (
    SELECT id FROM articles
    WHERE category = 'Internacionales'
    ORDER BY created_at DESC
    LIMIT 30
  );

-- Actualizar algunos artículos a 'Tecnologia'
UPDATE articles
SET category = 'Tecnologia'
WHERE category = 'Economia'
  AND id IN (
    SELECT id FROM articles
    WHERE category = 'Economia'
    ORDER BY created_at DESC
    LIMIT 25
  );

-- Nota: las categorías 'Salud' y 'Educación' ya no forman parte del catálogo; no se generan registros nuevos

-- Verificar las categorías actualizadas
SELECT category, COUNT(*) as cantidad
FROM articles
GROUP BY category
ORDER BY cantidad DESC;

-- También actualizar ai_generated_articles si existen
UPDATE ai_generated_articles SET category = 'Regionales' WHERE category = 'Locales';
UPDATE ai_generated_articles SET category = 'Espectaculos' WHERE category IN ('Cultura', 'Espectáculos');
UPDATE ai_generated_articles SET category = 'Economia' WHERE category IN ('Economía');
UPDATE ai_generated_articles SET category = 'Politica' WHERE category IN ('Política');
UPDATE ai_generated_articles SET category = 'Tecnologia' WHERE category IN ('Tecnología');

-- Agregar nuevas categorías a artículos AI
UPDATE ai_generated_articles
SET category = 'Medio Ambiente'
WHERE category = 'Nacionales'
  AND id IN (
    SELECT id FROM ai_generated_articles
    WHERE category = 'Nacionales'
    ORDER BY created_at DESC
    LIMIT 15
  );

UPDATE ai_generated_articles
SET category = 'Opinión'
WHERE category = 'Nacionales'
  AND id IN (
    SELECT id FROM ai_generated_articles
    WHERE category = 'Nacionales'
    ORDER BY created_at DESC
    LIMIT 15
  );

UPDATE ai_generated_articles
SET category = 'Agro'
WHERE category = 'Nacionales'
  AND id IN (
    SELECT id FROM ai_generated_articles
    WHERE category = 'Nacionales'
    ORDER BY created_at DESC
    LIMIT 10
  );

UPDATE ai_generated_articles
SET category = 'Deportes'
WHERE category = 'Nacionales'
  AND id IN (
    SELECT id FROM ai_generated_articles
    WHERE category = 'Nacionales'
    ORDER BY created_at DESC
    LIMIT 10
  );

UPDATE ai_generated_articles
SET category = 'Politica'
WHERE category = 'Internacionales'
  AND id IN (
    SELECT id FROM ai_generated_articles
    WHERE category = 'Internacionales'
    ORDER BY created_at DESC
    LIMIT 10
  );

UPDATE ai_generated_articles
SET category = 'Tecnologia'
WHERE category = 'Economia'
  AND id IN (
    SELECT id FROM ai_generated_articles
    WHERE category = 'Economia'
    ORDER BY created_at DESC
    LIMIT 10
  );

-- Verificar categorías en artículos AI
SELECT category, COUNT(*) as cantidad
FROM ai_generated_articles
GROUP BY category
ORDER BY cantidad DESC;