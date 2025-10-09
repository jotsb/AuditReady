/*
  # Fix Invitations RLS Policies

  1. Changes
    - Update "Users can view invitations sent to their email" policy to use profiles table instead of auth.users
    - Update "Business owners can update invitations" policy to use profiles table instead of auth.users
  
  2. Security
    - Maintains same security level while fixing permission denied errors
    - Users can still only access invitations sent to their email
    - Business owners can still update invitations
*/

DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON invitations;
CREATE POLICY "Users can view invitations sent to their email"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Business owners can update invitations" ON invitations;
CREATE POLICY "Business owners can update invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), business_id)
    OR email = (SELECT email FROM profiles WHERE id = auth.uid())
  );
