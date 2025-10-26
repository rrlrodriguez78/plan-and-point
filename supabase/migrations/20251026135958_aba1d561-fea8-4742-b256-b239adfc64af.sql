-- Create enum for share permissions
CREATE TYPE public.share_permission AS ENUM ('view', 'comment', 'edit');

-- Create table for tour shares
CREATE TABLE public.tour_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.virtual_tours(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level public.share_permission NOT NULL DEFAULT 'view',
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_views INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_tour_shares_token ON public.tour_shares(share_token);
CREATE INDEX idx_tour_shares_tour_id ON public.tour_shares(tour_id);

-- Enable RLS
ALTER TABLE public.tour_shares ENABLE ROW LEVEL SECURITY;

-- Tour owners can manage their shares
CREATE POLICY "Tour owners can manage shares"
ON public.tour_shares
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM virtual_tours vt
    JOIN tenants t ON vt.tenant_id = t.id
    WHERE vt.id = tour_shares.tour_id 
    AND t.owner_id = auth.uid()
  )
);

-- Anyone can view active shares by token (for accessing shared tours)
CREATE POLICY "Anyone can view active shares by token"
ON public.tour_shares
FOR SELECT
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Create function to generate unique share token
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token TEXT;
  exists_token BOOLEAN;
BEGIN
  LOOP
    -- Generate random token (8 characters)
    token := encode(gen_random_bytes(6), 'base64');
    token := replace(token, '/', '_');
    token := replace(token, '+', '-');
    token := substring(token, 1, 8);
    
    -- Check if token exists
    SELECT EXISTS(SELECT 1 FROM public.tour_shares WHERE share_token = token) INTO exists_token;
    
    EXIT WHEN NOT exists_token;
  END LOOP;
  
  RETURN token;
END;
$$;

-- Trigger to update view count
CREATE OR REPLACE FUNCTION public.increment_share_view_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.tour_shares
  SET view_count = view_count + 1
  WHERE share_token = NEW.session_id
  AND EXISTS (SELECT 1 FROM public.tour_shares WHERE share_token = NEW.session_id);
  
  RETURN NEW;
END;
$$;

-- Add social share metadata to virtual_tours
ALTER TABLE public.virtual_tours
ADD COLUMN IF NOT EXISTS share_image_url TEXT,
ADD COLUMN IF NOT EXISTS share_description TEXT;