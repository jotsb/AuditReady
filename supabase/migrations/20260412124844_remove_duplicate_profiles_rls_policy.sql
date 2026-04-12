/*
  # Remove duplicate profiles RLS policy

  1. Dropped Policy
    - "System admins can view all profile details" on `profiles` table
    - Identical in function to "System admins can view all profiles"
    - Both checked same condition: EXISTS(system_roles WHERE user_id=auth.uid() AND role='admin')

  2. Impact
    - Reduces RLS evaluation overhead (one fewer policy to evaluate per row)
    - No change in access behavior
*/

DROP POLICY IF EXISTS "System admins can view all profile details" ON profiles;
