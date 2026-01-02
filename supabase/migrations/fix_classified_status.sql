-- Script para cambiar el status por defecto de clasificados a 'approved'
-- Ejecutar este script en el SQL Editor de Supabase

-- Cambiar el status por defecto de futuros clasificados
ALTER TABLE classified_ads ALTER COLUMN status SET DEFAULT 'approved';

-- Actualizar todos los clasificados existentes con status 'pending' a 'approved'
UPDATE classified_ads SET status = 'approved' WHERE status = 'pending' OR status IS NULL;

-- Verificar el cambio
SELECT status, COUNT(*) as count
FROM classified_ads
GROUP BY status
ORDER BY status;