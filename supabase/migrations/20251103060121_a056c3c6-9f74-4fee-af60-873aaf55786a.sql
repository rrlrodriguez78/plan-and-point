-- Make tour-images bucket public so panoramic photos are accessible via public URLs
UPDATE storage.buckets 
SET public = true 
WHERE id = 'tour-images';