-- Create features table
CREATE TABLE public.features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT UNIQUE NOT NULL,
  feature_name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL,
  is_beta BOOLEAN DEFAULT false,
  requires_subscription_tier TEXT DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create tenant_features table (which features are enabled for which tenants)
CREATE TABLE public.tenant_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  enabled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, feature_id)
);

-- Create global_feature_config table (default settings for new tenants)
CREATE TABLE public.global_feature_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE UNIQUE,
  default_enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_feature_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for features table
CREATE POLICY "Anyone can view features"
  ON public.features FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin can manage features"
  ON public.features FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

-- RLS Policies for tenant_features table
CREATE POLICY "Users can view their tenant features"
  ON public.tenant_features FOR SELECT
  TO authenticated
  USING (
    belongs_to_tenant(auth.uid(), tenant_id) OR is_super_admin(auth.uid())
  );

CREATE POLICY "Super admin can manage tenant features"
  ON public.tenant_features FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

-- RLS Policies for global_feature_config table
CREATE POLICY "Anyone can view global feature config"
  ON public.global_feature_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin can manage global feature config"
  ON public.global_feature_config FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER update_features_updated_at
  BEFORE UPDATE ON public.features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_features_updated_at
  BEFORE UPDATE ON public.tenant_features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_global_feature_config_updated_at
  BEFORE UPDATE ON public.global_feature_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if a feature is enabled for a tenant
CREATE OR REPLACE FUNCTION public.is_feature_enabled(_tenant_id UUID, _feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  feature_enabled BOOLEAN;
  feature_uuid UUID;
BEGIN
  -- Get feature ID
  SELECT id INTO feature_uuid
  FROM public.features
  WHERE feature_key = _feature_key;
  
  IF feature_uuid IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if explicitly enabled/disabled for tenant
  SELECT enabled INTO feature_enabled
  FROM public.tenant_features
  WHERE tenant_id = _tenant_id AND feature_id = feature_uuid;
  
  IF feature_enabled IS NOT NULL THEN
    RETURN feature_enabled;
  END IF;
  
  -- Check global default
  SELECT default_enabled INTO feature_enabled
  FROM public.global_feature_config
  WHERE feature_id = feature_uuid;
  
  RETURN COALESCE(feature_enabled, false);
END;
$$;

-- Function to auto-enable features for new tenants based on rollout percentage
CREATE OR REPLACE FUNCTION public.init_tenant_features()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For each feature with global config, decide if it should be enabled
  INSERT INTO public.tenant_features (tenant_id, feature_id, enabled)
  SELECT 
    NEW.id,
    gfc.feature_id,
    CASE 
      WHEN gfc.default_enabled THEN true
      WHEN gfc.rollout_percentage >= (random() * 100) THEN true
      ELSE false
    END
  FROM public.global_feature_config gfc;
  
  RETURN NEW;
END;
$$;

-- Trigger to initialize features for new tenants
CREATE TRIGGER init_tenant_features_trigger
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.init_tenant_features();