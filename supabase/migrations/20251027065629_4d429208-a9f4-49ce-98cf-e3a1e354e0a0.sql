-- Add backup_format column to distinguish between JSON-only and complete backups
ALTER TABLE public.tour_backups 
ADD COLUMN IF NOT EXISTS backup_format TEXT DEFAULT 'json-only';

-- Add check constraint for valid formats
ALTER TABLE public.tour_backups
ADD CONSTRAINT backup_format_check 
CHECK (backup_format IN ('json-only', 'complete-zip'));

-- Add index for faster filtering by format
CREATE INDEX IF NOT EXISTS idx_tour_backups_format ON public.tour_backups(backup_format);