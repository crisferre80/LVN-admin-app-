-- Script para actualizar el status de clasificados existentes de 'pending' a 'approved'
-- Ejecutar este script en el SQL Editor de Supabase

-- Actualizar los clasificados específicos que están en 'pending'
UPDATE "public"."classified_ads"
SET "status" = 'approved'
WHERE "id" IN (
    '0b680227-bd10-4197-bbbb-537e57329011',
    '41265262-b372-4908-86fa-c2e125bb617a',
    '6e4dafd6-bed0-4fa6-b1d2-70b462f79265',
    '9095127f-71ec-45ed-8289-f2d12172c204'
);

-- Verificar que se actualizaron correctamente
SELECT id, title, status FROM "public"."classified_ads"
WHERE "id" IN (
    '0b680227-bd10-4197-bbbb-537e57329011',
    '41265262-b372-4908-86fa-c2e125bb617a',
    '6e4dafd6-bed0-4fa6-b1d2-70b462f79265',
    '9095127f-71ec-45ed-8289-f2d12172c204'
);