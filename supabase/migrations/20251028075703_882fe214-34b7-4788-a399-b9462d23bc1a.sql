-- Add index for faster queries on active jobs
CREATE INDEX IF NOT EXISTS idx_backup_jobs_status_created 
ON backup_jobs(status, created_at DESC) 
WHERE status IN ('pending', 'processing');

-- Add index for user's jobs
CREATE INDEX IF NOT EXISTS idx_backup_jobs_user_created 
ON backup_jobs(user_id, created_at DESC);

-- Add index for tenant's jobs  
CREATE INDEX IF NOT EXISTS idx_backup_jobs_tenant_created 
ON backup_jobs(tenant_id, created_at DESC);

-- Add automated cleanup function for old completed/failed jobs
CREATE OR REPLACE FUNCTION auto_cleanup_old_backup_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete completed/failed jobs older than 30 days
  DELETE FROM backup_jobs
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND completed_at < NOW() - INTERVAL '30 days';
    
  -- Delete abandoned processing jobs older than 24 hours
  DELETE FROM backup_jobs
  WHERE status IN ('pending', 'processing')
    AND created_at < NOW() - INTERVAL '24 hours';
    
  RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION auto_cleanup_old_backup_jobs() IS 
'Automatically removes old backup jobs: completed/failed after 30 days, abandoned processing jobs after 24 hours';