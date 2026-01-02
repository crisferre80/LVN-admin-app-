-- Add visits column to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS visits INTEGER DEFAULT 0;

-- Add visits column to ai_generated_articles table
ALTER TABLE ai_generated_articles ADD COLUMN IF NOT EXISTS visits INTEGER DEFAULT 0;

-- Update existing records to have visits = 0 if they are NULL
UPDATE articles SET visits = 0 WHERE visits IS NULL;
UPDATE ai_generated_articles SET visits = 0 WHERE visits IS NULL;