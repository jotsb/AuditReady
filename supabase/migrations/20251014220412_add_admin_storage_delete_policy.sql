/*
  # Add System Admin Storage Delete Policy

  1. New Policy
    - Allow system admins to delete any files from receipts bucket
    - Required for data cleanup operations (orphaned files)
    
  2. Security
    - Only users with 'admin' role in system_roles can delete any files
    - Regular users still restricted to their own files
*/

-- Policy: System admins can delete any receipt files
CREATE POLICY "System admins can delete any receipts"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1 FROM system_roles
      WHERE system_roles.user_id = auth.uid()
      AND system_roles.role = 'admin'
    )
  );