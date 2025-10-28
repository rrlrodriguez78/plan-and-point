-- ============================================================
-- ELIMINACIÓN COMPLETA DEL SISTEMA DE BACKUPS
-- ============================================================

-- 1. Eliminar funciones de base de datos relacionadas con backups
DROP FUNCTION IF EXISTS public.cleanup_stuck_backup_jobs() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_backups() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_exports() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_failed_uploads() CASCADE;
DROP FUNCTION IF EXISTS public.get_backup_job_status(text) CASCADE;
DROP FUNCTION IF EXISTS public.start_large_backup_upload(text, integer, integer, bigint, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.upload_backup_chunk(text, integer, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_upload_progress(text) CASCADE;
DROP FUNCTION IF EXISTS public.cancel_backup_upload(text) CASCADE;
DROP FUNCTION IF EXISTS public.complete_large_backup_upload(text) CASCADE;
DROP FUNCTION IF EXISTS public.log_backup_metric(text, boolean, uuid, integer, interval, bigint, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_backup_metrics_stats(integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_backup_dashboard() CASCADE;
DROP FUNCTION IF EXISTS public.create_mobile_settings_backup(text, text, jsonb, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.restore_mobile_settings_backup(uuid) CASCADE;

-- 2. Eliminar tablas de backups (en orden de dependencias)
DROP TABLE IF EXISTS public.backup_chunks CASCADE;
DROP TABLE IF EXISTS public.backup_logs CASCADE;
DROP TABLE IF EXISTS public.backup_metrics CASCADE;
DROP TABLE IF EXISTS public.background_backup_jobs CASCADE;
DROP TABLE IF EXISTS public.large_backup_upload CASCADE;
DROP TABLE IF EXISTS public.mobile_settings_backup CASCADE;
DROP TABLE IF EXISTS public.tour_exports CASCADE;
DROP TABLE IF EXISTS public.tour_backups CASCADE;
DROP TABLE IF EXISTS public.backup_history CASCADE;