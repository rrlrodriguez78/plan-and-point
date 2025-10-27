-- Habilitar extensión pg_cron para tareas programadas
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Programar limpieza automática de backup jobs a las 2 AM diariamente
SELECT cron.schedule(
  'cleanup-backup-jobs',
  '0 2 * * *',
  'SELECT public.cleanup_old_backup_jobs()'
);