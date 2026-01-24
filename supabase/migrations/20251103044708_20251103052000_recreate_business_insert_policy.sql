/*
  # Recreate Business INSERT Policy

  ## Issue
  The policy "Users can create businesses" with `WITH CHECK (true)` is not working.
  INSERT fails with RLS error even though:
  - Policy exists with WITH CHECK (true)
  - Policy applies to authenticated role
  - User is authenticated
  - RLS disabled = works
  - RLS enabled = fails
  
  ## Hypothesis
  Policy might be cached or corrupted. Drop and recreate it.
  
  ## Fix
  1. Drop existing INSERT policy
  2. Recreate with exact same definition
  3. Verify it works
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can create businesses" ON businesses;

-- Recreate the INSERT policy with WITH CHECK (true)
CREATE POLICY "Users can create businesses"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Verify policy was created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'businesses'
    AND policyname = 'Users can create businesses'
    AND cmd = 'INSERT'
    AND with_check = 'true';
    
  IF policy_count != 1 THEN
    RAISE EXCEPTION 'Policy was not created correctly!';
  END IF;

  RAISE NOTICE 'Business INSERT policy recreated successfully.';
END $$;
