-- Create tour_analytics table
CREATE TABLE IF NOT EXISTS public.tour_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID REFERENCES public.virtual_tours(id) ON DELETE CASCADE NOT NULL,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  avg_duration_seconds INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(tour_id)
);

-- Create tour_comments table
CREATE TABLE IF NOT EXISTS public.tour_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID REFERENCES public.virtual_tours(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  commenter_name TEXT,
  commenter_email TEXT,
  comment_text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.tour_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tour_analytics
CREATE POLICY "Users can view analytics for their tours"
ON public.tour_analytics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.virtual_tours vt
    JOIN public.organizations o ON vt.organization_id = o.id
    WHERE vt.id = tour_analytics.tour_id AND o.owner_id = auth.uid()
  )
);

CREATE POLICY "System can manage analytics"
ON public.tour_analytics FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies for tour_comments
CREATE POLICY "Users can view comments on their tours"
ON public.tour_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.virtual_tours vt
    JOIN public.organizations o ON vt.organization_id = o.id
    WHERE vt.id = tour_comments.tour_id AND o.owner_id = auth.uid()
  )
);

CREATE POLICY "Anyone can insert comments"
ON public.tour_comments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Tour owners can update comments"
ON public.tour_comments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.virtual_tours vt
    JOIN public.organizations o ON vt.organization_id = o.id
    WHERE vt.id = tour_comments.tour_id AND o.owner_id = auth.uid()
  )
);

CREATE POLICY "Tour owners can delete comments"
ON public.tour_comments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.virtual_tours vt
    JOIN public.organizations o ON vt.organization_id = o.id
    WHERE vt.id = tour_comments.tour_id AND o.owner_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tour_analytics_tour_id ON public.tour_analytics(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_comments_tour_id ON public.tour_comments(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_comments_is_read ON public.tour_comments(is_read);

-- Enable realtime for tour_comments only (notifications already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tour_comments;