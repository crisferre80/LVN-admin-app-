-- Script para permitir uploads públicos al bucket 'advertisements' para clasificados
-- Ejecutar este script en el SQL Editor de Supabase

-- Eliminar la política restrictiva actual
DROP POLICY IF EXISTS "Authenticated users can upload to advertisements bucket" ON storage.objects;

-- Crear nueva política que permita uploads públicos para el bucket advertisements
CREATE POLICY "Public upload access for advertisements bucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'advertisements');

-- Verificar las políticas actuales
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;