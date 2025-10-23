-- Agregar columna capture_date a panorama_photos
ALTER TABLE panorama_photos 
ADD COLUMN capture_date DATE DEFAULT CURRENT_DATE;

-- Crear índice para búsquedas por fecha
CREATE INDEX idx_panorama_photos_capture_date ON panorama_photos(capture_date);

-- Comentario explicativo
COMMENT ON COLUMN panorama_photos.capture_date IS 'Fecha de captura de la foto panorámica 360°';