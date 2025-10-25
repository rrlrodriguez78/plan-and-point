-- Add original_filename column to panorama_photos table
ALTER TABLE public.panorama_photos
ADD COLUMN original_filename TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN public.panorama_photos.original_filename IS 'Original filename of the uploaded photo for user reference';