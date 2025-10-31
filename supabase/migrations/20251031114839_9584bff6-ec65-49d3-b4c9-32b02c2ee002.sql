-- =====================================================
-- Sistema de Respaldo Híbrido (Cloud Storage + Local PC)
-- =====================================================

-- 1. Tabla de configuración de destinos de respaldo por tenant
CREATE TABLE IF NOT EXISTS backup_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  destination_type TEXT NOT NULL CHECK (destination_type IN ('cloud_storage', 'local_download', 'both')),
  
  -- Cloud Storage Config (null si es solo local)
  cloud_provider TEXT CHECK (cloud_provider IN ('google_drive', 'dropbox') OR cloud_provider IS NULL),
  cloud_access_token TEXT, -- Encrypted
  cloud_refresh_token TEXT, -- Encrypted
  cloud_folder_id TEXT,
  cloud_folder_path TEXT DEFAULT 'VirtualTours_Backups',
  
  -- Settings
  auto_backup_enabled BOOLEAN DEFAULT false,
  backup_on_photo_upload BOOLEAN DEFAULT true,
  backup_frequency TEXT DEFAULT 'immediate' CHECK (backup_frequency IN ('immediate', 'daily', 'weekly', 'manual')),
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  last_backup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, cloud_provider)
);

-- 2. Tabla de mapeo de archivos respaldados en cloud
CREATE TABLE IF NOT EXISTS cloud_file_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_job_id UUID REFERENCES backup_jobs(id) ON DELETE CASCADE,
  destination_id UUID REFERENCES backup_destinations(id) ON DELETE CASCADE NOT NULL,
  
  -- Referencias locales
  tour_id UUID REFERENCES virtual_tours(id) ON DELETE CASCADE NOT NULL,
  floor_plan_id UUID REFERENCES floor_plans(id) ON DELETE SET NULL,
  hotspot_id UUID REFERENCES hotspots(id) ON DELETE SET NULL,
  photo_id UUID REFERENCES panorama_photos(id) ON DELETE SET NULL,
  
  -- Info del archivo local
  local_file_url TEXT NOT NULL,
  local_file_type TEXT CHECK (local_file_type IN ('floor_plan', 'photo_original', 'photo_mobile', 'photo_thumbnail', 'metadata')),
  
  -- Info del archivo en cloud
  cloud_file_id TEXT NOT NULL,
  cloud_file_path TEXT NOT NULL,
  cloud_file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  checksum TEXT,
  
  -- Metadata
  backed_up_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  UNIQUE(destination_id, local_file_url)
);

-- 3. Tabla de historial de sincronizaciones
CREATE TABLE IF NOT EXISTS backup_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id UUID REFERENCES backup_destinations(id) ON DELETE CASCADE NOT NULL,
  backup_job_id UUID REFERENCES backup_jobs(id) ON DELETE CASCADE,
  
  sync_type TEXT CHECK (sync_type IN ('full', 'incremental', 'auto')),
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
  
  files_synced INTEGER DEFAULT 0,
  files_failed INTEGER DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,
  
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. Modificar tabla backup_jobs existente
ALTER TABLE backup_jobs 
ADD COLUMN IF NOT EXISTS destination_type TEXT DEFAULT 'local_download' 
  CHECK (destination_type IN ('cloud_storage', 'local_download', 'both'));

ALTER TABLE backup_jobs 
ADD COLUMN IF NOT EXISTS destination_id UUID REFERENCES backup_destinations(id) ON DELETE SET NULL;

ALTER TABLE backup_jobs
ADD COLUMN IF NOT EXISTS cloud_synced BOOLEAN DEFAULT false;

ALTER TABLE backup_jobs
ADD COLUMN IF NOT EXISTS cloud_sync_error TEXT;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_backup_dest_tenant ON backup_destinations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_backup_dest_type ON backup_destinations(destination_type);
CREATE INDEX IF NOT EXISTS idx_backup_dest_active ON backup_destinations(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_cloud_mappings_backup ON cloud_file_mappings(backup_job_id);
CREATE INDEX IF NOT EXISTS idx_cloud_mappings_tour ON cloud_file_mappings(tour_id);
CREATE INDEX IF NOT EXISTS idx_cloud_mappings_dest ON cloud_file_mappings(destination_id);

CREATE INDEX IF NOT EXISTS idx_sync_history_dest ON backup_sync_history(destination_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_status ON backup_sync_history(status);
CREATE INDEX IF NOT EXISTS idx_sync_history_backup ON backup_sync_history(backup_job_id);

-- RLS Policies
ALTER TABLE backup_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_file_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_sync_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their tenant's backup destinations
CREATE POLICY "Users manage their tenant backup destinations" ON backup_destinations
  FOR ALL USING (belongs_to_tenant(auth.uid(), tenant_id));

-- Policy: Users can view their cloud mappings
CREATE POLICY "Users view their cloud mappings" ON cloud_file_mappings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM backup_destinations bd
      WHERE bd.id = cloud_file_mappings.destination_id
        AND belongs_to_tenant(auth.uid(), bd.tenant_id)
    )
  );

-- Policy: Users can view their sync history
CREATE POLICY "Users view their sync history" ON backup_sync_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM backup_destinations bd
      WHERE bd.id = backup_sync_history.destination_id
        AND belongs_to_tenant(auth.uid(), bd.tenant_id)
    )
  );

-- Función helper para obtener configuración de destino activa
CREATE OR REPLACE FUNCTION get_active_backup_destination(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  destination_type TEXT,
  cloud_provider TEXT,
  auto_backup_enabled BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    destination_type,
    cloud_provider,
    auto_backup_enabled
  FROM backup_destinations
  WHERE tenant_id = p_tenant_id
    AND is_active = true
  LIMIT 1;
$$;

-- Comentarios para documentación
COMMENT ON TABLE backup_destinations IS 'Configuración de destinos de respaldo (cloud, local o ambos) por tenant';
COMMENT ON TABLE cloud_file_mappings IS 'Mapeo de archivos respaldados en cloud storage';
COMMENT ON TABLE backup_sync_history IS 'Historial de sincronizaciones a cloud storage';
COMMENT ON COLUMN backup_jobs.destination_type IS 'Tipo de destino: local_download, cloud_storage, o both';
COMMENT ON COLUMN backup_jobs.cloud_synced IS 'Indica si el backup fue sincronizado exitosamente a cloud';

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON backup_destinations TO authenticated;
GRANT ALL ON cloud_file_mappings TO authenticated;
GRANT ALL ON backup_sync_history TO authenticated;