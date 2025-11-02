-- Allow users to delete their tenant's sync history
CREATE POLICY "Users can delete their sync history" 
ON backup_sync_history
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM backup_destinations bd
    WHERE bd.id = backup_sync_history.destination_id
      AND belongs_to_tenant(auth.uid(), bd.tenant_id)
  )
);