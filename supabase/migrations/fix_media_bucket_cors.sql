-- Script para verificar y corregir la configuración del bucket 'media'

-- 1. Verificar si el bucket existe y su configuración
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE name = 'media';

-- 2. Si el bucket no es público, hacerlo público
UPDATE storage.buckets 
SET public = true 
WHERE name = 'media';

-- 3. Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON storage.objects;

-- 4. Crear políticas correctas para el bucket media

-- Permitir lectura pública (GET)
CREATE POLICY "Public read access for media bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

-- Permitir subida para usuarios autenticados (POST)
CREATE POLICY "Authenticated users can upload to media bucket"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'media' 
  AND auth.role() = 'authenticated'
);

-- Permitir actualización para usuarios autenticados (PUT)
CREATE POLICY "Authenticated users can update media bucket"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'media' 
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'media' 
  AND auth.role() = 'authenticated'
);

-- Permitir eliminación para usuarios autenticados (DELETE)
CREATE POLICY "Authenticated users can delete from media bucket"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'media' 
  AND auth.role() = 'authenticated'
);

-- 5. Verificar las políticas creadas
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
WHERE tablename = 'objects' 
  AND policyname LIKE '%media%'
ORDER BY policyname;