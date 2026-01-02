-- Script para verificar y corregir políticas RLS del bucket 'media'

-- Primero, verificar si el bucket existe
SELECT id, name, public FROM storage.buckets WHERE id = 'media';

-- Verificar políticas existentes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';

-- Si hay políticas conflictivas, eliminarlas
-- DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can update own objects" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can delete own objects" ON storage.objects;

-- Crear políticas corregidas
CREATE POLICY "Authenticated users can upload to media" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'media'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update media objects" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'media'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete media objects" ON storage.objects
FOR DELETE USING (
  bucket_id = 'media'
  AND auth.uid() IS NOT NULL
);

-- Verificar que las políticas se crearon
SELECT policyname FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname LIKE '%media%';