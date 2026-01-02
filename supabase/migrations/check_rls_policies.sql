-- Verificar políticas RLS para ai_generated_articles
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'ai_generated_articles'
ORDER BY policyname;