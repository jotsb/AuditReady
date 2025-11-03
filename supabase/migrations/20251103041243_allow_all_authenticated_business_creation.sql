/*
  # Allow All Authenticated Users to Create Businesses

  ## Problem
  Despite having correct policies, users still cannot create businesses.
  This is a temporary measure to bypass the suspended check for INSERT operations only.
  
  ## Changes
  - Remove the RESTRICTIVE policy temporarily for INSERT
  - Add it back only for SELECT/UPDATE/DELETE operations
  
  ## Security Note
  This allows any authenticated user to create a non-suspended business.
  The PERMISSIVE policy still ensures they must be the owner.
*/

-- Drop the problematic restrictive policy
DROP POLICY IF EXISTS "Block access to suspended businesses" ON businesses;

-- Recreate it but exclude INSERT operations
-- This allows INSERT to proceed without the restrictive check
CREATE POLICY "Block access to suspended businesses"
  ON businesses
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    is_system_admin(auth.uid()) OR NOT COALESCE(suspended, false)
  );

CREATE POLICY "Block updates to suspended businesses"
  ON businesses
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid()) OR NOT COALESCE(suspended, false)
  )
  WITH CHECK (
    is_system_admin(auth.uid()) OR NOT COALESCE(suspended, false)
  );

CREATE POLICY "Block deletes from suspended businesses"
  ON businesses
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    is_system_admin(auth.uid()) OR NOT COALESCE(suspended, false)
  );
