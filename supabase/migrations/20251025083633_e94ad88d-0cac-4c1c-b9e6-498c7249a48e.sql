-- Add delete policy for email_logs
CREATE POLICY "Users can delete their own email logs"
ON public.email_logs
FOR DELETE
USING (auth.uid() = user_id);