-- Add cover_image_url column to virtual_tours table
ALTER TABLE public.virtual_tours 
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;