-- SQL para crear bucket 'advertisements' en Supabase Storage para imágenes de anuncios
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Crear el bucket (ejecutar en SQL Editor de Supabase)
INSERT INTO storage.buckets (id, name, public)
VALUES ('advertisements', 'advertisements', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas RLS para el bucket 'advertisements'
-- Política para lectura pública (ya que las imágenes de anuncios deben ser visibles)
CREATE POLICY "Public read access for advertisements bucket" ON storage.objects
FOR SELECT USING (bucket_id = 'advertisements');

-- Política para inserción (solo usuarios autenticados pueden subir imágenes)
CREATE POLICY "Authenticated users can upload to advertisements bucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'advertisements' AND auth.role() = 'authenticated');

-- Política para actualización (solo usuarios autenticados pueden actualizar)
CREATE POLICY "Authenticated users can update advertisements bucket" ON storage.objects
FOR UPDATE USING (bucket_id = 'advertisements' AND auth.role() = 'authenticated');

-- Política para eliminación (solo usuarios autenticados pueden eliminar)
CREATE POLICY "Authenticated users can delete from advertisements bucket" ON storage.objects
FOR DELETE USING (bucket_id = 'advertisements' AND auth.role() = 'authenticated');

-- Verificar que el bucket se creó correctamente
SELECT id, name, public FROM storage.buckets WHERE id = 'advertisements';