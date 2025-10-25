-- Add delete policy for notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Add delete policy for tour comments (tour owners can delete)
CREATE POLICY "Tour owners can delete their tour comments"
ON public.tour_comments
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM virtual_tours vt
    JOIN organizations o ON vt.organization_id = o.id
    WHERE vt.id = tour_comments.tour_id
    AND o.owner_id = auth.uid()
  )
);