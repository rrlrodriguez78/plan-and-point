-- Create pages table
CREATE TABLE public.pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  route TEXT NOT NULL,
  description TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view pages" 
ON public.pages 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert pages" 
ON public.pages 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update pages" 
ON public.pages 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete pages" 
ON public.pages 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pages_updated_at
BEFORE UPDATE ON public.pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert existing pages
INSERT INTO public.pages (name, route, description, is_locked) VALUES
('Landing', '/', 'Main landing page with hero section and features', false),
('Authentication', '/login', 'Login and signup page', false),
('Dashboard', '/app/tours', 'Virtual tours dashboard - manage all tours', false),
('Editor', '/app/editor/:id', 'Tour editor - create and edit panoramas, hotspots, and floor plans', false),
('Viewer', '/viewer/:id', 'Public viewer for virtual tours', false),
('Settings', '/app/settings', 'Settings page - Golden Rules, Commands, and Pages management', false),
('Not Found', '*', '404 error page', false);