-- Tabla para almacenar resultados de lotería y tómbola
CREATE TABLE IF NOT EXISTS public.lottery_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draw_date DATE NOT NULL,
  game_type VARCHAR(50) NOT NULL, -- 'tombola', 'quiniela', 'loto', etc.
  draw_time VARCHAR(20), -- 'primera', 'matutina', 'vespertina', 'nocturna'
  numbers JSONB NOT NULL, -- Array de números sorteados
  additional_data JSONB, -- Datos adicionales como premios, ganadores, etc.
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(draw_date, game_type, draw_time)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_lottery_results_date ON public.lottery_results(draw_date DESC);
CREATE INDEX IF NOT EXISTS idx_lottery_results_game_type ON public.lottery_results(game_type);
CREATE INDEX IF NOT EXISTS idx_lottery_results_date_game ON public.lottery_results(draw_date DESC, game_type);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_lottery_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lottery_results_updated_at
  BEFORE UPDATE ON public.lottery_results
  FOR EACH ROW
  EXECUTE FUNCTION update_lottery_results_updated_at();

-- RLS (Row Level Security) - Lectura pública, escritura solo autenticados
ALTER TABLE public.lottery_results ENABLE ROW LEVEL SECURITY;

-- Política para lectura pública
CREATE POLICY "Resultados de lotería son públicos"
  ON public.lottery_results
  FOR SELECT
  USING (true);

-- Política para inserción/actualización solo usuarios autenticados
CREATE POLICY "Solo usuarios autenticados pueden insertar resultados"
  ON public.lottery_results
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Solo usuarios autenticados pueden actualizar resultados"
  ON public.lottery_results
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Solo usuarios autenticados pueden eliminar resultados"
  ON public.lottery_results
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Comentarios para documentación
COMMENT ON TABLE public.lottery_results IS 'Almacena resultados de sorteos de lotería, tómbola, quiniela, etc.';
COMMENT ON COLUMN public.lottery_results.game_type IS 'Tipo de juego: tombola, quiniela, loto, quini6, telekino, etc.';
COMMENT ON COLUMN public.lottery_results.draw_time IS 'Turno del sorteo: primera, matutina, vespertina, nocturna';
COMMENT ON COLUMN public.lottery_results.numbers IS 'Array JSON con los números sorteados';
COMMENT ON COLUMN public.lottery_results.additional_data IS 'Datos adicionales como premios, ganadores, pozos acumulados, etc.';
