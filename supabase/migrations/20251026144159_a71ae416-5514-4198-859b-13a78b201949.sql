-- Update existing users to approved status so they can continue using the app
UPDATE public.profiles 
SET account_status = 'approved' 
WHERE account_status IS NULL OR account_status = 'pending';