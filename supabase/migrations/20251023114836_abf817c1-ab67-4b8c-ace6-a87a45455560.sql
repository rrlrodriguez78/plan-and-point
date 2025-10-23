-- Create golden_rules table
CREATE TABLE public.golden_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.golden_rules ENABLE ROW LEVEL SECURITY;

-- Create policies for golden_rules (public read, authenticated write)
CREATE POLICY "Golden rules are viewable by everyone" 
ON public.golden_rules 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert golden rules" 
ON public.golden_rules 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update golden rules" 
ON public.golden_rules 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete golden rules" 
ON public.golden_rules 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_golden_rules_updated_at
BEFORE UPDATE ON public.golden_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the initial golden rules
INSERT INTO public.golden_rules (rule_number, title, description) VALUES
(1, 'English Language', 'All main pages must be in English language'),
(2, 'Navigation Controls', 'All pages and dialog windows must have a back or cancel button depending on each page design');