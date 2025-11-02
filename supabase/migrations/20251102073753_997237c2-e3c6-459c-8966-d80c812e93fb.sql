-- Create sync_jobs table for tracking background sync operations
CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL REFERENCES public.virtual_tours(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'photo_batch_sync',
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'cancelled')),
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  error_messages JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_id ON public.sync_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_tour_id ON public.sync_jobs(tour_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON public.sync_jobs(status);

-- Enable RLS
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant sync jobs"
  ON public.sync_jobs
  FOR SELECT
  USING (belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can create sync jobs for their tenant"
  ON public.sync_jobs
  FOR INSERT
  WITH CHECK (belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can update their tenant sync jobs"
  ON public.sync_jobs
  FOR UPDATE
  USING (belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Service role can manage all sync jobs"
  ON public.sync_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);