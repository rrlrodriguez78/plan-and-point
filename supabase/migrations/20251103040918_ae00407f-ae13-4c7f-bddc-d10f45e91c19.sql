-- ============================================================
-- SECURITY FIX: Critical error-level security issues
-- ============================================================

-- ============================================================
-- FIX 1: Secure tour-images storage bucket
-- ============================================================

-- Make the tour-images bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'tour-images';

-- Drop overly permissive policy
DROP POLICY IF EXISTS "Anyone can view tour images" ON storage.objects;

-- Create restrictive SELECT policy based on tour access
CREATE POLICY "Users can view tour images based on tour access"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'tour-images' AND (
    -- Allow if tour is published AND not password protected
    EXISTS (
      SELECT 1 FROM virtual_tours vt
      JOIN floor_plans fp ON vt.id = fp.tour_id
      WHERE vt.is_published = true
        AND (vt.password_hash IS NULL OR vt.password_hash = '')
        AND fp.image_url LIKE '%' || storage.objects.name || '%'
    )
    OR
    -- Allow if tour is published AND not password protected (for panorama photos)
    EXISTS (
      SELECT 1 FROM virtual_tours vt
      JOIN floor_plans fp ON vt.id = fp.tour_id
      JOIN hotspots h ON h.floor_plan_id = fp.id
      JOIN panorama_photos pp ON pp.hotspot_id = h.id
      WHERE vt.is_published = true
        AND (vt.password_hash IS NULL OR vt.password_hash = '')
        AND (pp.photo_url LIKE '%' || storage.objects.name || '%'
          OR pp.photo_url_mobile LIKE '%' || storage.objects.name || '%'
          OR pp.photo_url_thumbnail LIKE '%' || storage.objects.name || '%')
    )
    OR
    -- Allow if user is tenant member (for any tour in their tenant)
    EXISTS (
      SELECT 1 FROM virtual_tours vt
      JOIN floor_plans fp ON vt.id = fp.tour_id
      WHERE belongs_to_tenant(auth.uid(), vt.tenant_id)
        AND fp.image_url LIKE '%' || storage.objects.name || '%'
    )
    OR
    -- Allow if user is tenant member (for panorama photos)
    EXISTS (
      SELECT 1 FROM virtual_tours vt
      JOIN floor_plans fp ON vt.id = fp.tour_id
      JOIN hotspots h ON h.floor_plan_id = fp.id
      JOIN panorama_photos pp ON pp.hotspot_id = h.id
      WHERE belongs_to_tenant(auth.uid(), vt.tenant_id)
        AND (pp.photo_url LIKE '%' || storage.objects.name || '%'
          OR pp.photo_url_mobile LIKE '%' || storage.objects.name || '%'
          OR pp.photo_url_thumbnail LIKE '%' || storage.objects.name || '%')
    )
  )
);

-- Fix UPDATE policy to verify actual ownership
DROP POLICY IF EXISTS "Users can update their own tour images" ON storage.objects;

CREATE POLICY "Tenant admins can update tour images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tour-images' AND (
    -- Check if user is tenant admin for floor plan images
    EXISTS (
      SELECT 1 FROM virtual_tours vt
      JOIN floor_plans fp ON vt.id = fp.tour_id
      WHERE is_tenant_admin(auth.uid(), vt.tenant_id)
        AND fp.image_url LIKE '%' || storage.objects.name || '%'
    )
    OR
    -- Check if user is tenant admin for panorama photos
    EXISTS (
      SELECT 1 FROM virtual_tours vt
      JOIN floor_plans fp ON vt.id = fp.tour_id
      JOIN hotspots h ON h.floor_plan_id = fp.id
      JOIN panorama_photos pp ON pp.hotspot_id = h.id
      WHERE is_tenant_admin(auth.uid(), vt.tenant_id)
        AND (pp.photo_url LIKE '%' || storage.objects.name || '%'
          OR pp.photo_url_mobile LIKE '%' || storage.objects.name || '%'
          OR pp.photo_url_thumbnail LIKE '%' || storage.objects.name || '%')
    )
  )
);

-- Fix DELETE policy to verify actual ownership
DROP POLICY IF EXISTS "Users can delete their own tour images" ON storage.objects;

CREATE POLICY "Tenant admins can delete tour images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tour-images' AND (
    -- Check if user is tenant admin for floor plan images
    EXISTS (
      SELECT 1 FROM virtual_tours vt
      JOIN floor_plans fp ON vt.id = fp.tour_id
      WHERE is_tenant_admin(auth.uid(), vt.tenant_id)
        AND fp.image_url LIKE '%' || storage.objects.name || '%'
    )
    OR
    -- Check if user is tenant admin for panorama photos
    EXISTS (
      SELECT 1 FROM virtual_tours vt
      JOIN floor_plans fp ON vt.id = fp.tour_id
      JOIN hotspots h ON h.floor_plan_id = fp.id
      JOIN panorama_photos pp ON pp.hotspot_id = h.id
      WHERE is_tenant_admin(auth.uid(), vt.tenant_id)
        AND (pp.photo_url LIKE '%' || storage.objects.name || '%'
          OR pp.photo_url_mobile LIKE '%' || storage.objects.name || '%'
          OR pp.photo_url_thumbnail LIKE '%' || storage.objects.name || '%')
    )
  )
);

-- ============================================================
-- FIX 2: Enhanced security for cloud storage tokens
-- Note: Tokens are already encrypted via CLOUD_ENCRYPTION_KEY
-- Adding audit logging and token management functions
-- ============================================================

-- Create audit log table for sensitive token operations
CREATE TABLE IF NOT EXISTS public.backup_destination_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid REFERENCES public.backup_destinations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE public.backup_destination_audit ENABLE ROW LEVEL SECURITY;

-- Only super admins and tenant admins can view audit logs
CREATE POLICY "Tenant admins can view their audit logs"
ON public.backup_destination_audit FOR SELECT
USING (
  is_super_admin(auth.uid()) OR 
  is_tenant_admin(auth.uid(), tenant_id)
);

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
ON public.backup_destination_audit FOR INSERT
WITH CHECK (true);

-- Add token expiration tracking to backup_destinations
ALTER TABLE public.backup_destinations 
ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS token_last_refreshed_at timestamptz,
ADD COLUMN IF NOT EXISTS token_refresh_count integer DEFAULT 0;

-- Function to mark a destination for token rotation
CREATE OR REPLACE FUNCTION public.should_rotate_backup_tokens(p_destination_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_refreshed timestamptz;
  v_refresh_count integer;
BEGIN
  SELECT token_last_refreshed_at, token_refresh_count
  INTO v_last_refreshed, v_refresh_count
  FROM backup_destinations
  WHERE id = p_destination_id;
  
  RETURN (
    v_last_refreshed IS NULL OR
    v_last_refreshed < NOW() - INTERVAL '60 days' OR
    v_refresh_count > 100
  );
END;
$$;

-- Function to revoke cloud storage access
CREATE OR REPLACE FUNCTION public.revoke_cloud_storage_access(p_destination_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM backup_destinations
  WHERE id = p_destination_id;
  
  IF NOT (is_super_admin(auth.uid()) OR is_tenant_admin(auth.uid(), v_tenant_id)) THEN
    RAISE EXCEPTION 'Permission denied: Only tenant admins can revoke access';
  END IF;
  
  UPDATE backup_destinations
  SET 
    is_active = false,
    cloud_access_token = NULL,
    cloud_refresh_token = NULL,
    updated_at = NOW()
  WHERE id = p_destination_id;
  
  INSERT INTO backup_destination_audit (
    destination_id,
    tenant_id,
    user_id,
    action,
    metadata
  ) VALUES (
    p_destination_id,
    v_tenant_id,
    auth.uid(),
    'tokens_revoked',
    jsonb_build_object('reason', 'manual_revocation', 'timestamp', NOW())
  );
END;
$$;

-- Function to cleanup inactive backup destinations
CREATE OR REPLACE FUNCTION public.cleanup_inactive_backup_destinations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count integer := 0;
BEGIN
  WITH deleted AS (
    DELETE FROM backup_destinations
    WHERE is_active = false
      AND updated_at < NOW() - INTERVAL '90 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;
  
  RETURN v_deleted_count;
END;
$$;

COMMENT ON TABLE public.backup_destination_audit IS 'Audit trail for cloud storage token operations';
COMMENT ON FUNCTION public.should_rotate_backup_tokens IS 'Checks if tokens should be rotated based on age';
COMMENT ON FUNCTION public.revoke_cloud_storage_access IS 'Revokes cloud storage access and clears tokens';

CREATE INDEX IF NOT EXISTS idx_backup_destination_audit_tenant_id ON public.backup_destination_audit(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_destination_audit_destination_id ON public.backup_destination_audit(destination_id, created_at DESC);