-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organizations"
  ON public.organizations FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own organizations"
  ON public.organizations FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own organizations"
  ON public.organizations FOR DELETE
  USING (auth.uid() = owner_id);

-- Create virtual_tours table
CREATE TABLE public.virtual_tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.virtual_tours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tours"
  ON public.virtual_tours FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = virtual_tours.organization_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Published tours are viewable by everyone"
  ON public.virtual_tours FOR SELECT
  USING (is_published = true);

CREATE POLICY "Users can create tours in their organizations"
  ON public.virtual_tours FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = organization_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own tours"
  ON public.virtual_tours FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = virtual_tours.organization_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own tours"
  ON public.virtual_tours FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = virtual_tours.organization_id
      AND owner_id = auth.uid()
    )
  );

-- Create floor_plans table
CREATE TABLE public.floor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.virtual_tours(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view floor plans of their tours"
  ON public.floor_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_tours vt
      JOIN public.organizations o ON vt.organization_id = o.id
      WHERE vt.id = floor_plans.tour_id
      AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Published tour floor plans are viewable by everyone"
  ON public.floor_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_tours
      WHERE id = floor_plans.tour_id
      AND is_published = true
    )
  );

CREATE POLICY "Users can create floor plans for their tours"
  ON public.floor_plans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.virtual_tours vt
      JOIN public.organizations o ON vt.organization_id = o.id
      WHERE vt.id = tour_id
      AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update floor plans of their tours"
  ON public.floor_plans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_tours vt
      JOIN public.organizations o ON vt.organization_id = o.id
      WHERE vt.id = floor_plans.tour_id
      AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete floor plans of their tours"
  ON public.floor_plans FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_tours vt
      JOIN public.organizations o ON vt.organization_id = o.id
      WHERE vt.id = floor_plans.tour_id
      AND o.owner_id = auth.uid()
    )
  );

-- Create hotspots table
CREATE TABLE public.hotspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id UUID NOT NULL REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  x_position FLOAT NOT NULL,
  y_position FLOAT NOT NULL,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', '360', 'video')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hotspots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view hotspots of their tours"
  ON public.hotspots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.floor_plans fp
      JOIN public.virtual_tours vt ON fp.tour_id = vt.id
      JOIN public.organizations o ON vt.organization_id = o.id
      WHERE fp.id = hotspots.floor_plan_id
      AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Published tour hotspots are viewable by everyone"
  ON public.hotspots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.floor_plans fp
      JOIN public.virtual_tours vt ON fp.tour_id = vt.id
      WHERE fp.id = hotspots.floor_plan_id
      AND vt.is_published = true
    )
  );

CREATE POLICY "Users can create hotspots for their tours"
  ON public.hotspots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.floor_plans fp
      JOIN public.virtual_tours vt ON fp.tour_id = vt.id
      JOIN public.organizations o ON vt.organization_id = o.id
      WHERE fp.id = floor_plan_id
      AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update hotspots of their tours"
  ON public.hotspots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.floor_plans fp
      JOIN public.virtual_tours vt ON fp.tour_id = vt.id
      JOIN public.organizations o ON vt.organization_id = o.id
      WHERE fp.id = hotspots.floor_plan_id
      AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete hotspots of their tours"
  ON public.hotspots FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.floor_plans fp
      JOIN public.virtual_tours vt ON fp.tour_id = vt.id
      JOIN public.organizations o ON vt.organization_id = o.id
      WHERE fp.id = hotspots.floor_plan_id
      AND o.owner_id = auth.uid()
    )
  );

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_virtual_tours_updated_at
  BEFORE UPDATE ON public.virtual_tours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for tour images
INSERT INTO storage.buckets (id, name, public)
VALUES ('tour-images', 'tour-images', true);

-- Storage policies for tour images
CREATE POLICY "Anyone can view tour images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tour-images');

CREATE POLICY "Authenticated users can upload tour images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tour-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own tour images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'tour-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own tour images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tour-images'
    AND auth.role() = 'authenticated'
  );