-- Script para diagnosticar problemas con el bucket media

-- 1. Verificar si el bucket existe
SELECT 
  'Bucket existe' as check_type,
  CASE WHEN COUNT(*) > 0 THEN '✓ SÍ' ELSE '✗ NO' END as result,
  COUNT(*) as count
FROM storage.buckets 
WHERE name = 'media';

-- 2. Verificar si el bucket es público
SELECT 
  'Bucket es público' as check_type,
  CASE WHEN public THEN '✓ SÍ' ELSE '✗ NO - DEBE SER PÚBLICO' END as result,
  id,
  name,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE name = 'media';

-- 3. Verificar políticas RLS existentes
SELECT 
  'Políticas RLS' as check_type,
  policyname,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'CON RESTRICCIONES'
    ELSE 'SIN RESTRICCIONES'
  END as restrictions
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
ORDER BY policyname;

-- 4. Verificar archivos en el bucket
SELECT 
  'Archivos en bucket' as check_type,
  COUNT(*) as total_files,
  COUNT(DISTINCT bucket_id) as buckets_used
FROM storage.objects 
WHERE bucket_id = 'media';

-- 5. Verificar archivos recientes
SELECT 
  'Archivos recientes' as info,
  name,
  bucket_id,
  created_at,
  metadata
FROM storage.objects 
WHERE bucket_id = 'media'
ORDER BY created_at DESC
LIMIT 5;