-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create automated weekly reports cron job
-- Runs every Monday at 9:00 AM UTC
SELECT cron.schedule(
  'weekly-reports-automated',
  '0 9 * * 1',
  $$
  SELECT
    net.http_post(
        url := 'https://swnhlzcodsnpsqpxaxov.supabase.co/functions/v1/send-weekly-reports',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
        body := '{}'::jsonb
    ) as request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - used for automated weekly reports';
COMMENT ON EXTENSION pg_net IS 'HTTP client for PostgreSQL - used to invoke edge functions from cron jobs';