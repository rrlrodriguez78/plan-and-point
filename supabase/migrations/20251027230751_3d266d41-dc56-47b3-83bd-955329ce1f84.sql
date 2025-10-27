-- Create tour_exports table for managing structured exports
CREATE TABLE tour_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_token TEXT UNIQUE NOT NULL,
  tour_id UUID REFERENCES virtual_tours(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  floor_plan_id UUID REFERENCES floor_plans(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing',
  progress INTEGER DEFAULT 0,
  total_files INTEGER DEFAULT 0,
  processed_files INTEGER DEFAULT 0,
  export_size_mb NUMERIC(10,2),
  zip_storage_path TEXT,
  download_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  error_message TEXT,
  
  CONSTRAINT valid_status CHECK (status IN ('processing', 'completed', 'failed'))
);

-- Create indexes for performance
CREATE INDEX idx_tour_exports_token ON tour_exports(export_token);
CREATE INDEX idx_tour_exports_user ON tour_exports(user_id);
CREATE INDEX idx_tour_exports_status ON tour_exports(status);

-- Enable RLS
ALTER TABLE tour_exports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own exports" 
  ON tour_exports FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exports" 
  ON tour_exports FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exports" 
  ON tour_exports FOR UPDATE 
  USING (auth.uid() = user_id);

-- Function to cleanup expired exports
CREATE OR REPLACE FUNCTION cleanup_old_exports()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  WITH deleted_exports AS (
    DELETE FROM tour_exports
    WHERE expires_at < NOW()
    RETURNING *
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted_exports;
  
  RETURN v_deleted_count;
END;
$$;