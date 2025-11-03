/*
  # Fix Audit Logs INSERT Policy Blocking Business Creation

  ## THE ACTUAL ROOT CAUSE (Third Time's the Charm!)
  
  Flow when creating a business:
  1. Business INSERT starts
  2. BEFORE INSERT trigger sets created_by
  3. Business row inserted
  4. AFTER INSERT trigger `audit_business_changes` fires
  5. Calls `log_audit_event()` function (SECURITY DEFINER)
  6. Function tries to INSERT into audit_logs
  7. **audit_logs policy "Block direct audit log inserts" has WITH CHECK (false)**
  8. **Even SECURITY DEFINER functions cannot bypass WITH CHECK (false)!**
  9. INSERT to audit_logs fails
  10. Transaction rolls back
  11. User sees "RLS policy violation for businesses"

  ## The Problem
  
  Current policy on audit_logs:
  ```sql
  CREATE POLICY "Block direct audit log inserts"
    ON audit_logs FOR INSERT
    WITH CHECK (false);
  ```
  
  This was intended to prevent direct inserts from users, but it ALSO blocks
  SECURITY DEFINER trigger functions from logging audit events!

  ## The Solution
  
  Remove the blanket "WITH CHECK (false)" policy and replace it with a proper
  policy that:
  - Blocks regular users and authenticated role
  - Allows service_role and postgres (used by SECURITY DEFINER functions)
  
  Actually, with SECURITY DEFINER, the function runs as the owner (postgres),
  so we just need to remove this policy entirely. SECURITY DEFINER will bypass
  RLS anyway.

  ## Alternative Approach
  
  Since all audit logging is done via SECURITY DEFINER functions, we can:
  1. Drop the blocking policy
  2. Keep RLS enabled on audit_logs
  3. SECURITY DEFINER functions will bypass RLS for INSERT
  4. Keep SELECT policies so users can only see their own logs
*/

-- Drop the policy that blocks ALL inserts
DROP POLICY IF EXISTS "Block direct audit log inserts" ON audit_logs;

-- The table still has RLS enabled, but SECURITY DEFINER functions will bypass it
-- Regular users still cannot INSERT directly because there's no PERMISSIVE INSERT policy

-- Verify the policy was removed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'audit_logs'
      AND policyname = 'Block direct audit log inserts'
  ) THEN
    RAISE EXCEPTION 'Policy was not removed!';
  END IF;

  -- Verify no INSERT policies exist that would block
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'audit_logs'
      AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'INSERT policy still exists on audit_logs!';
  END IF;

  RAISE NOTICE 'Audit logs INSERT policy removed successfully.';
  RAISE NOTICE 'SECURITY DEFINER functions can now insert audit logs.';
  RAISE NOTICE 'Regular users still cannot insert (no PERMISSIVE policy).';
  RAISE NOTICE 'Business creation should now work!';
END $$;
