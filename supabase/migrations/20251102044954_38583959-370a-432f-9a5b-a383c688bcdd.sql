-- Remove automatic trigger-based photo sync
-- Now using frontend-initiated sync via edge function call

DROP TRIGGER IF EXISTS trigger_auto_sync_photo_to_drive ON panorama_photos;
DROP FUNCTION IF EXISTS auto_sync_photo_to_drive();