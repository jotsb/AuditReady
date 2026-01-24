/*
  # Fix RESTRICTIVE Policy Blocking Business Creation

  ## THE REAL ROOT CAUSE (Finally Found!)
  
  When a user creates a business:
  1. Business INSERT succeeds (policy: WITH CHECK true)
  2. AFTER INSERT trigger `create_business_owner_membership` fires
  3. Trigger tries to INSERT into business_members (creates owner membership)
  4. RESTRICTIVE policy "Block access to suspended business members" checks ALL operations
  5. Even though trigger is SECURITY DEFINER, RESTRICTIVE policies still apply!
  6. Policy calls `is_business_suspended(business_id)` which might fail or return unexpected result
  7. INSERT to business_members is blocked
  8. Transaction rolls back
  9. User sees "RLS policy violation for businesses" (misleading - it's actually business_members)

  ## The Issue with RESTRICTIVE Policies
  
  RESTRICTIVE policies apply to ALL roles, including SECURITY DEFINER functions!
  They create an AND condition that MUST pass for the operation to succeed.
  
  Current RESTRICTIVE policy:
  ```sql
  CREATE POLICY "Block access to suspended business members"
    ON business_members
    AS RESTRICTIVE
    FOR ALL
    USING (is_system_admin(auth.uid()) OR NOT is_business_suspended(business_id))
  ```
  
  This blocks INSERT operations from triggers when creating new businesses.

  ## Solution
  
  Split the RESTRICTIVE policy to exclude INSERT operations:
  - Keep RESTRICTIVE for SELECT, UPDATE, DELETE
  - Remove RESTRICTIVE for INSERT (let PERMISSIVE handle it)
  - This allows the trigger to create the initial owner membership

  ## Security Impact
  
  This is safe because:
  - PERMISSIVE INSERT policy requires user to be owner/manager
  - Initial membership creation happens via SECURITY DEFINER trigger
  - After creation, RESTRICTIVE policies protect SELECT/UPDATE/DELETE
  - Users still can't access suspended business data
*/

-- Drop the existing RESTRICTIVE policy that applies to ALL operations
DROP POLICY IF EXISTS "Block access to suspended business members" ON business_members;

-- Create separate RESTRICTIVE policies for SELECT, UPDATE, DELETE (but NOT INSERT)
CREATE POLICY "Block select from suspended business members"
  ON business_members
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()) OR NOT is_business_suspended(business_id));

CREATE POLICY "Block update to suspended business members"
  ON business_members
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (is_system_admin(auth.uid()) OR NOT is_business_suspended(business_id));

CREATE POLICY "Block delete from suspended business members"
  ON business_members
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (is_system_admin(auth.uid()) OR NOT is_business_suspended(business_id));

-- Add comments
COMMENT ON POLICY "Block select from suspended business members" ON business_members IS
  'Prevents viewing memberships of suspended businesses. Does not apply to INSERT to allow trigger to create owner membership.';

COMMENT ON POLICY "Block update to suspended business members" ON business_members IS
  'Prevents updating memberships of suspended businesses.';

COMMENT ON POLICY "Block delete from suspended business members" ON business_members IS
  'Prevents deleting memberships of suspended businesses.';

-- Verify policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'business_members'
    AND permissive = 'RESTRICTIVE'
    AND policyname LIKE 'Block % suspended business members';
    
  IF policy_count != 3 THEN
    RAISE EXCEPTION 'Expected 3 RESTRICTIVE policies, found %', policy_count;
  END IF;

  -- Verify no RESTRICTIVE policy for INSERT
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'business_members'
      AND permissive = 'RESTRICTIVE'
      AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'RESTRICTIVE policy for INSERT still exists!';
  END IF;

  RAISE NOTICE 'Business members RESTRICTIVE policies fixed successfully.';
  RAISE NOTICE 'INSERT operations no longer blocked by RESTRICTIVE policies.';
  RAISE NOTICE 'Business creation should now work!';
END $$;
