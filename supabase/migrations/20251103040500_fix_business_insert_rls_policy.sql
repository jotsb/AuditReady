/*
  # Fix Business Insert RLS Policy

  ## Problem
  The restrictive policy "Block access to suspended businesses" was blocking INSERT operations
  because it only had a USING clause but no WITH CHECK clause.
  
  For INSERT operations, PostgreSQL RLS requires:
  - USING clause: Not applicable (no existing row to check)
  - WITH CHECK clause: Validates the new row being inserted
  
  ## Solution
  Add WITH CHECK clause to the restrictive policy to allow INSERT of non-suspended businesses.
  
  ## Changes
  - Drop and recreate the restrictive policy with both USING and WITH CHECK
  - USING: Checks existing rows (SELECT, UPDATE, DELETE)
  - WITH CHECK: Validates new rows (INSERT, UPDATE)
  
  ## Security
  - System admins can always access (bypass suspension)
  - Regular users can only insert non-suspended businesses (suspended = false or null)
  - Existing behavior for SELECT/UPDATE/DELETE unchanged
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Block access to suspended businesses" ON businesses;

-- Recreate with both USING and WITH CHECK clauses
CREATE POLICY "Block access to suspended businesses"
  ON businesses
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    -- For SELECT, UPDATE, DELETE: check if admin or business is not suspended
    is_system_admin(auth.uid()) OR NOT COALESCE(suspended, false)
  )
  WITH CHECK (
    -- For INSERT, UPDATE: check if admin or business being created/updated is not suspended
    is_system_admin(auth.uid()) OR NOT COALESCE(suspended, false)
  );
