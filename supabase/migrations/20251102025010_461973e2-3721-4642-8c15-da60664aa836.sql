-- Create tour_backup_config table
CREATE TABLE IF NOT EXISTS public.tour_backup_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.virtual_tours(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  destination_id UUID REFERENCES public.backup_destinations(id) ON DELETE CASCADE,
  auto_backup_enabled BOOLEAN DEFAULT false,
  backup_type TEXT DEFAULT 'full_backup' CHECK (backup_type IN ('full_backup', 'media_only')),
  backup_on_create BOOLEAN DEFAULT true,
  backup_on_update BOOLEAN DEFAULT true,
  backup_frequency TEXT DEFAULT 'immediate' CHECK (backup_frequency IN ('immediate', 'daily', 'weekly')),
  last_auto_backup_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tour_id, destination_id)
);

-- Enable RLS
ALTER TABLE public.tour_backup_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tour backup configs"
  ON public.tour_backup_config
  FOR SELECT
  USING (
    belongs_to_tenant(auth.uid(), tenant_id) OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert tour backup configs"
  ON public.tour_backup_config
  FOR INSERT
  WITH CHECK (
    belongs_to_tenant(auth.uid(), tenant_id)
  );

CREATE POLICY "Users can update their tour backup configs"
  ON public.tour_backup_config
  FOR UPDATE
  USING (
    belongs_to_tenant(auth.uid(), tenant_id) OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete their tour backup configs"
  ON public.tour_backup_config
  FOR DELETE
  USING (
    belongs_to_tenant(auth.uid(), tenant_id) OR is_super_admin(auth.uid())
  );

CREATE POLICY "Super admin can manage all configs"
  ON public.tour_backup_config
  FOR ALL
  USING (is_super_admin(auth.uid()));

-- Create index for performance
CREATE INDEX idx_tour_backup_config_tour_id ON public.tour_backup_config(tour_id);
CREATE INDEX idx_tour_backup_config_auto_enabled ON public.tour_backup_config(auto_backup_enabled) WHERE auto_backup_enabled = true;

-- Function to trigger auto backup
CREATE OR REPLACE FUNCTION public.trigger_auto_backup()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_config RECORD;
  v_backup_job_id UUID;
BEGIN
  -- Check if tour has auto-backup enabled
  FOR v_config IN 
    SELECT * FROM public.tour_backup_config 
    WHERE tour_id = NEW.id 
    AND auto_backup_enabled = true
    AND (
      (TG_OP = 'INSERT' AND backup_on_create = true) OR
      (TG_OP = 'UPDATE' AND backup_on_update = true AND OLD.updated_at IS DISTINCT FROM NEW.updated_at)
    )
  LOOP
    -- Create backup job
    INSERT INTO public.backup_jobs (
      tour_id,
      tenant_id,
      user_id,
      destination_id,
      job_type,
      destination_type,
      status
    )
    VALUES (
      NEW.id,
      NEW.tenant_id,
      auth.uid(),
      v_config.destination_id,
      v_config.backup_type,
      'cloud_drive',
      'pending'
    )
    RETURNING id INTO v_backup_job_id;
    
    -- Add to backup queue
    INSERT INTO public.backup_queue (
      backup_job_id,
      status,
      priority,
      scheduled_at
    )
    VALUES (
      v_backup_job_id,
      'pending',
      2, -- Higher priority for auto backups
      NOW()
    );
    
    RAISE NOTICE 'Auto backup triggered for tour % with job %', NEW.id, v_backup_job_id;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS auto_backup_on_tour_create ON public.virtual_tours;
CREATE TRIGGER auto_backup_on_tour_create
  AFTER INSERT ON public.virtual_tours
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_backup();

DROP TRIGGER IF EXISTS auto_backup_on_tour_update ON public.virtual_tours;
CREATE TRIGGER auto_backup_on_tour_update
  AFTER UPDATE ON public.virtual_tours
  FOR EACH ROW
  WHEN (OLD.updated_at IS DISTINCT FROM NEW.updated_at)
  EXECUTE FUNCTION public.trigger_auto_backup();