-- Create commands table
CREATE TABLE public.commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  command_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  command_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view commands" 
ON public.commands 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert commands" 
ON public.commands 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update commands" 
ON public.commands 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete commands" 
ON public.commands 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_commands_updated_at
BEFORE UPDATE ON public.commands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default commands (the fullscreen fix examples)
INSERT INTO public.commands (command_number, title, description, command_text) VALUES
(1, 'Fullscreen Portal Fix', 'Fix Radix UI components (Popover, DropdownMenu, Dialog, Select) that don''t work in fullscreen mode', 'Apply the Portal container solution: modify the component to accept a container prop and pass fullscreenContainerRef.current when in fullscreen'),
(2, 'Add Navigation Button', 'Add back or cancel button to page or dialog', 'Add a back/cancel button following Rule #2 - Navigation Controls'),
(3, 'Mobile First Design', 'Ensure responsive design with mobile-first approach', 'Apply Rule #3: Touch targets min 44x44px, stack vertical on mobile, text min 16px, use Tailwind breakpoints (sm:640px, md:768px, lg:1024px, xl:1280px)');