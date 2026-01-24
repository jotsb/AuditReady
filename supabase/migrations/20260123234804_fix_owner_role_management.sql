/*
  # Fix Owner Role Management for Business Owners
  
  ## Problem
  Business owners cannot change or delete team members who have been assigned 
  the "owner" role, even though these members are not the actual business owner.
  
  ## Root Cause
  The RLS policies were too restrictive - they blocked any changes to members 
  with role="owner", even if the member isn't the actual business.owner_id.
  
  ## Solution
  Update the policies to allow business owners to:
  - Change the role of members with "owner" role (if not the actual business owner)
  - Delete members with "owner" role (if not the actual business owner)
  
  The only protected user should be the one matching businesses.owner_id
  
  ## Changes
  1. Drop and recreate UPDATE policy for business_members
  2. Drop and recreate DELETE policy for business_members
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Owners and managers can update member roles (except owner)" ON business_members;
DROP POLICY IF EXISTS "Owners and managers can remove members (except owner)" ON business_members;

-- Recreate UPDATE policy - allow changing any member except the actual business owner
CREATE POLICY "Owners and managers can update member roles (except business owner)"
  ON business_members
  FOR UPDATE
  TO authenticated
  USING (
    (is_system_admin(auth.uid()) OR is_business_owner_or_manager(auth.uid(), business_id))
    AND NOT (EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = business_members.business_id
        AND b.owner_id = business_members.user_id
    ))
  )
  WITH CHECK (
    (
      is_system_admin(auth.uid()) 
      OR (
        is_business_owner_or_manager(auth.uid(), business_id)
        AND role IN ('member', 'manager', 'owner')
      )
    )
    AND NOT (EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = business_members.business_id
        AND b.owner_id = business_members.user_id
    ))
  );

-- Recreate DELETE policy - allow deleting any member except the actual business owner
CREATE POLICY "Owners and managers can remove members (except business owner)"
  ON business_members
  FOR DELETE
  TO authenticated
  USING (
    (is_system_admin(auth.uid()) OR is_business_owner_or_manager(auth.uid(), business_id))
    AND NOT (EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id = business_members.business_id
        AND b.owner_id = business_members.user_id
    ))
  );
