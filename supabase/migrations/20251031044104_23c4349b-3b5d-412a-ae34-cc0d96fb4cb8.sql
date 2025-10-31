-- Add tour_type column to virtual_tours table
ALTER TABLE virtual_tours 
ADD COLUMN tour_type TEXT DEFAULT 'tour_360' 
CHECK (tour_type IN ('tour_360', 'photo_tour'));

-- Add comment to explain the column
COMMENT ON COLUMN virtual_tours.tour_type IS 'Type of tour: tour_360 for 360° panoramas, photo_tour for normal/panoramic photos';