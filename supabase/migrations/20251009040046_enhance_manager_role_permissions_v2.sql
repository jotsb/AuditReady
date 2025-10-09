/*
  # Enhance Manager Role Permissions

  1. Changes
    - Update audit logs policies to allow managers to view logs
    - Update invitation policies to allow managers to create/manage invitations
    - Update business_members policies to allow managers to manage team (except owner)
    - Update receipt policies to allow managers to delete receipts
  
  2. Security
    - Managers cannot remove or change the owner's role
    - Managers cannot promote members to owner role (only system can set owner)
    - All policies maintain business isolation
    - System admins retain full access
    
  3. Notes
    - Owner role in business_members is maintained for consistency
    - Managers can only assign 'member' or 'manager' roles
*/

-- Drop and recreate audit log policies to include managers
DROP POLICY IF EXISTS "Business owners can view team audit logs" ON audit_logs;

CREATE POLICY "Business owners and managers can view team audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id::text = (audit_logs.details->>'business_id')
        AND (
          b.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM business_members bm
            WHERE bm.business_id = b.id
              AND bm.user_id = auth.uid()
              AND bm.role IN ('manager', 'owner')
          )
        )
    )
  );

-- Update invitation policies to allow managers
DROP POLICY IF EXISTS "Business owners can create invitations" ON invitations;
DROP POLICY IF EXISTS "Business owners can delete invitations" ON invitations;
DROP POLICY IF EXISTS "Business owners can update invitations" ON invitations;

CREATE POLICY "Owners and managers can create invitations"
  ON invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system_admin(auth.uid()) 
    OR is_business_owner_or_manager(auth.uid(), business_id)
  );

CREATE POLICY "Owners and managers can delete invitations"
  ON invitations
  FOR DELETE
  TO authenticated
  USING (
    is_system_admin(auth.uid()) 
    OR is_business_owner_or_manager(auth.uid(), business_id)
  );

CREATE POLICY "Owners and managers can update invitations"
  ON invitations
  FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid()) 
    OR is_business_owner_or_manager(auth.uid(), business_id)
    OR (
      email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())
    )
  );

-- Update business_members policies to allow managers to manage team (except owner)
DROP POLICY IF EXISTS "Business owners can insert members" ON business_members;
DROP POLICY IF EXISTS "Business owners can remove members" ON business_members;
DROP POLICY IF EXISTS "Business owners can update member roles" ON business_members;

CREATE POLICY "Owners and managers can add members"
  ON business_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system_admin(auth.uid()) 
    OR is_business_owner_or_manager(auth.uid(), business_id)
  );

CREATE POLICY "Owners and managers can remove members (except owner)"
  ON business_members
  FOR DELETE
  TO authenticated
  USING (
    (is_system_admin(auth.uid()) OR is_business_owner_or_manager(auth.uid(), business_id))
    AND role != 'owner'
    AND NOT EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = business_members.business_id
        AND b.owner_id = business_members.user_id
    )
  );

CREATE POLICY "Owners and managers can update member roles (except owner)"
  ON business_members
  FOR UPDATE
  TO authenticated
  USING (
    (is_system_admin(auth.uid()) OR is_business_owner_or_manager(auth.uid(), business_id))
    AND role != 'owner'
    AND NOT EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = business_members.business_id
        AND b.owner_id = business_members.user_id
    )
  )
  WITH CHECK (
    (is_system_admin(auth.uid()) OR (
      is_business_owner_or_manager(auth.uid(), business_id)
      AND role IN ('member', 'manager')
    ))
    AND NOT EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = business_members.business_id
        AND b.owner_id = business_members.user_id
    )
  );

-- Update receipt deletion policy to allow managers
DROP POLICY IF EXISTS "Only owners can delete receipts" ON receipts;
DROP POLICY IF EXISTS "Admins can delete receipts" ON receipts;

CREATE POLICY "Owners and managers can delete receipts"
  ON receipts
  FOR DELETE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM collections c
      INNER JOIN businesses b ON c.business_id = b.id
      WHERE c.id = receipts.collection_id
        AND (
          b.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM business_members bm
            WHERE bm.business_id = b.id
              AND bm.user_id = auth.uid()
              AND bm.role IN ('manager', 'owner')
          )
        )
    )
  );
