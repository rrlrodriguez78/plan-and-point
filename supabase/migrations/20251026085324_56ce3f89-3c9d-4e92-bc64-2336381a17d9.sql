-- Add PERMISSIVE policy for authenticated users to view published tours
-- This works together with the RESTRICTIVE policy to allow viewing public tours
CREATE POLICY "Authenticated users can view public tours"
ON public.virtual_tours 
FOR SELECT 
TO authenticated
USING (is_published = true);