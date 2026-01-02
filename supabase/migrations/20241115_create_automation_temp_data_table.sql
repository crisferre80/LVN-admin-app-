-- Crear tabla para datos temporales de workflows de automatización
-- Fecha: 15 de noviembre de 2024

-- Crear tabla para datos temporales de workflows de automatización
CREATE TABLE IF NOT EXISTS automation_temp_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL,
  step_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '24 hours')
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_automation_temp_data_workflow_id ON automation_temp_data(workflow_id);
CREATE INDEX IF NOT EXISTS idx_automation_temp_data_step_id ON automation_temp_data(step_id);
CREATE INDEX IF NOT EXISTS idx_automation_temp_data_status ON automation_temp_data(status);
CREATE INDEX IF NOT EXISTS idx_automation_temp_data_expires_at ON automation_temp_data(expires_at);
CREATE INDEX IF NOT EXISTS idx_automation_temp_data_created_at ON automation_temp_data(created_at DESC);

-- Crear función para limpiar datos expirados automáticamente
CREATE OR REPLACE FUNCTION cleanup_expired_temp_data()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM automation_temp_data
  WHERE expires_at < timezone('utc'::text, now());
END;
$$;

-- Crear trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_automation_temp_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_automation_temp_data_updated_at
  BEFORE UPDATE ON automation_temp_data
  FOR EACH ROW
  EXECUTE FUNCTION update_automation_temp_data_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE automation_temp_data ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
-- Permitir SELECT a usuarios autenticados
CREATE POLICY "Allow authenticated users to read automation_temp_data"
  ON automation_temp_data
  FOR SELECT
  TO authenticated
  USING (true);

-- Permitir INSERT/UPDATE/DELETE a usuarios autenticados
CREATE POLICY "Allow authenticated users to insert automation_temp_data"
  ON automation_temp_data
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update automation_temp_data"
  ON automation_temp_data
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete automation_temp_data"
  ON automation_temp_data
  FOR DELETE
  TO authenticated
  USING (true);

-- Comentarios descriptivos
COMMENT ON TABLE automation_temp_data IS 'Datos temporales para workflows de automatización, usados para pasar información entre pasos';
COMMENT ON COLUMN automation_temp_data.workflow_id IS 'ID único del workflow que generó estos datos';
COMMENT ON COLUMN automation_temp_data.step_id IS 'Identificador del paso del workflow';
COMMENT ON COLUMN automation_temp_data.task_type IS 'Tipo de tarea que generó estos datos';
COMMENT ON COLUMN automation_temp_data.data IS 'Datos JSON con la información temporal';
COMMENT ON COLUMN automation_temp_data.status IS 'Estado del procesamiento de estos datos';
COMMENT ON COLUMN automation_temp_data.expires_at IS 'Fecha de expiración automática de los datos';