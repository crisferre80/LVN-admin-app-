-- Política alternativa: permitir todo para debugging
-- Crear política que permita todas las operaciones sin restricciones

CREATE POLICY "Allow all operations on AI articles" ON ai_generated_articles
  FOR ALL USING (true);