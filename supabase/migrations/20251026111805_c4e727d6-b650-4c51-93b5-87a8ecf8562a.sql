-- Add policy allowing authenticated users to view published tours
-- This allows users to browse public tours in addition to their own organization's tours
CREATE POLICY "Authenticated users can view public tours" ON public.virtual_tours
FOR SELECT TO authenticated
USING (is_published = true);