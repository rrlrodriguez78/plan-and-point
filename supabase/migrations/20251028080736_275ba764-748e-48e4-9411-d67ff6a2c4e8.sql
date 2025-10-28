-- Crear bucket de almacenamiento para backups
INSERT INTO storage.buckets (id, name, public) 
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para el bucket de backups
CREATE POLICY "Users can view their own backups" ON storage.objects
FOR SELECT USING (
  bucket_id = 'backups' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload their own backups" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'backups' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own backups" ON storage.objects
FOR DELETE USING (
  bucket_id = 'backups' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);