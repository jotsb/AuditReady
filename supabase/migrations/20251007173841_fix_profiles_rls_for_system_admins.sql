/*
  # Fix Profiles RLS for System Admins
  
  1. Changes
    - Add policy allowing system admins to view all profiles
    - This enables system admins to see owner emails in the "All Businesses" view
  
  2. Security
    - Policy checks if user has 'admin' role in system_roles table
    - Only applies to SELECT operations
    - Does not affect existing user policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'System admins can view all profiles'
  ) THEN
    CREATE POLICY "System admins can view all profiles"
      ON profiles
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM system_roles
          WHERE system_roles.user_id = auth.uid()
          AND system_roles.role = 'admin'
        )
      );
  END IF;
END $$;
