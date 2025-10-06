/*
  # Fix Business RLS Policy - Remove Circular Reference

  ## Changes
  - Simplifies the business SELECT policy to remove circular dependency
  - Users can view businesses they own directly
  - Business access through collections will be handled at the collection level
  
  ## Security Impact
  - Users can only view businesses they own
  - Collection membership doesn't grant direct business visibility
  - Access to business data is controlled through collections RLS
*/

-- Drop the existing policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view own businesses" ON businesses;

-- Create simpler policy without circular reference
CREATE POLICY "Users can view own businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());