-- Script para poblar comentarios de ejemplo
-- Ejecutar después de crear la tabla article_comments

-- Insertar algunos comentarios de ejemplo para artículos existentes
-- Nota: Reemplaza los article_id con IDs reales de tu base de datos

-- Comentarios para un artículo RSS
INSERT INTO article_comments (article_id, article_type, author_name, content) VALUES
('00000000-0000-0000-0000-000000000001', 'rss', 'María González', 'Excelente artículo, muy informativo. Me gustaría saber más sobre este tema.'),
('00000000-0000-0000-0000-000000000001', 'rss', 'Carlos Rodríguez', 'Totalmente de acuerdo con el análisis presentado. Buena investigación.'),
('00000000-0000-0000-0000-000000000001', 'rss', 'Anónimo', 'Gracias por compartir esta información tan relevante para nuestra comunidad.');

-- Comentarios para un artículo AI
INSERT INTO article_comments (article_id, article_type, author_name, content) VALUES
('00000000-0000-0000-0000-000000000002', 'ai', 'Laura Martínez', 'Me parece muy interesante el enfoque que le dan al tema. Felicitaciones al equipo de redacción.'),
('00000000-0000-0000-0000-000000000002', 'ai', 'Pedro Sánchez', 'Buen trabajo periodístico. Espero más notas como esta.'),
('00000000-0000-0000-0000-000000000002', 'ai', null, 'Muy buena cobertura del evento. Gracias por mantenernos informados.');

-- Comentarios con diferentes timestamps para probar el orden
INSERT INTO article_comments (article_id, article_type, author_name, content, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'rss', 'Test User', 'Comentario de prueba más antiguo', NOW() - INTERVAL '2 days'),
('00000000-0000-0000-0000-000000000001', 'rss', 'Test User 2', 'Comentario de prueba más reciente', NOW() - INTERVAL '1 hour');