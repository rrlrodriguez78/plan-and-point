-- Add mobile and thumbnail URL columns to panorama_photos table
ALTER TABLE public.panorama_photos
ADD COLUMN photo_url_mobile text,
ADD COLUMN photo_url_thumbnail text;

-- Add comment to explain the columns
COMMENT ON COLUMN public.panorama_photos.photo_url_mobile IS 'Mobile-optimized WebP version (2400px, quality 0.75)';
COMMENT ON COLUMN public.panorama_photos.photo_url_thumbnail IS 'Thumbnail WebP version (400px, quality 0.60)';
COMMENT ON COLUMN public.panorama_photos.photo_url IS 'Original WebP version (4000px, quality 0.80)';