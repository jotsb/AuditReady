/*
  # Allow Business Owners to View and Manage Soft-Deleted Receipts

  1. Changes
    - Add RLS policy for business owners to view soft-deleted receipts in their businesses
    - Business owners can restore soft-deleted receipts in their businesses
    - Business owners can permanently delete soft-deleted receipts in their businesses
    - System admins retain all existing permissions

  2. Security
    - Business owners can only see/manage soft-deleted receipts from their own businesses
    - Regular members cannot see soft-deleted receipts
    - System admins can see all soft-deleted receipts (existing policy)

  3. Implementation
    - New SELECT policy for business owners viewing deleted receipts
    - Existing UPDATE policy already allows restoration (no changes needed)
    - New DELETE policy for business owners to hard delete their deleted receipts
*/

-- Allow business owners to view soft-deleted receipts from their businesses
CREATE POLICY "Business owners can view their deleted receipts"
  ON receipts FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NOT NULL AND
    EXISTS (
      SELECT 1 
      FROM collections c
      INNER JOIN businesses b ON b.id = c.business_id
      WHERE c.id = receipts.collection_id
      AND b.owner_id = auth.uid()
    )
  );

-- Allow business owners to hard delete soft-deleted receipts from their businesses
-- (Only receipts that are already soft-deleted)
DROP POLICY IF EXISTS "Collection members can delete receipts" ON receipts;
CREATE POLICY "Admins and owners can delete receipts"
  ON receipts FOR DELETE
  TO authenticated
  USING (
    -- System admins can delete any receipt
    is_system_admin(auth.uid())
    OR
    -- Business owners can hard delete soft-deleted receipts from their businesses
    (
      deleted_at IS NOT NULL AND
      EXISTS (
        SELECT 1 
        FROM collections c
        INNER JOIN businesses b ON b.id = c.business_id
        WHERE c.id = receipts.collection_id
        AND b.owner_id = auth.uid()
      )
    )
  );

-- Add system log entry
INSERT INTO system_logs (level, category, message, metadata)
VALUES (
  'INFO',
  'DATABASE',
  'Updated RLS policies to allow business owners to manage soft-deleted receipts',
  jsonb_build_object(
    'migration', 'allow_business_owners_view_deleted_receipts',
    'changes', jsonb_build_array(
      'Business owners can view their deleted receipts',
      'Business owners can hard delete their soft-deleted receipts',
      'System admins retain all permissions'
    )
  )
);