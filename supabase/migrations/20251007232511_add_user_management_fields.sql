/*
  # Add User Management Fields for Admin

  ## Overview
  Adds fields to the profiles table to support comprehensive user management by system administrators.

  ## Changes
  
  ### 1. User Suspension System
  - `suspended` (boolean) - Whether the user account is suspended
  - `suspension_reason` (text) - Reason for suspension (visible to admins)
  - `suspended_at` (timestamptz) - When the suspension occurred
  - `suspended_by` (uuid) - Which admin suspended the user
  
  ### 2. User Soft Delete System
  - `deleted_at` (timestamptz) - When soft delete occurred (NULL = active)
  - `deleted_by` (uuid) - Which admin performed soft delete
  - `deletion_reason` (text) - Reason for deletion
  
  ### 3. User Activity Tracking
  - `last_login_at` (timestamptz) - Last successful login timestamp
  
  ## Security
  - Only system admins can modify these fields
  - All changes are audited via existing audit_logs system
  - Suspended users will be blocked at login via application logic
  - Soft-deleted users will be hidden from normal queries via application logic
  
  ## Notes
  - Soft delete does NOT remove data, just marks account as deleted
  - Hard delete requires separate migration and will be permanent
  - Suspension is reversible, deletion is not (without restore)
*/

-- Add suspension fields to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'suspended'
  ) THEN
    ALTER TABLE profiles ADD COLUMN suspended boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'suspension_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN suspension_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'suspended_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN suspended_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'suspended_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN suspended_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Add soft delete fields to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN deleted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'deletion_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN deletion_reason text;
  END IF;
END $$;

-- Add last login tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_login_at timestamptz;
  END IF;
END $$;

-- Create index for filtering suspended users
CREATE INDEX IF NOT EXISTS idx_profiles_suspended ON profiles(suspended) WHERE suspended = true;

-- Create index for filtering deleted users
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at) WHERE deleted_at IS NOT NULL;

-- Create index for last login queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_login_at ON profiles(last_login_at DESC);

-- Drop existing policies if they exist to recreate them
DO $$
BEGIN
  DROP POLICY IF EXISTS "System admins can view all profile details" ON profiles;
  DROP POLICY IF EXISTS "System admins can update user management fields" ON profiles;
END $$;

-- Update RLS policies to allow system admins to manage suspension and deletion
-- System admins can view all user details including suspension status
CREATE POLICY "System admins can view all profile details"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE system_roles.user_id = auth.uid()
      AND system_roles.role = 'admin'
    )
  );

-- System admins can update suspension and deletion fields
CREATE POLICY "System admins can update user management fields"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE system_roles.user_id = auth.uid()
      AND system_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE system_roles.user_id = auth.uid()
      AND system_roles.role = 'admin'
    )
  );

-- Add comments for documentation
COMMENT ON COLUMN profiles.suspended IS 'User account suspension status';
COMMENT ON COLUMN profiles.suspension_reason IS 'Reason for account suspension';
COMMENT ON COLUMN profiles.suspended_at IS 'Timestamp when account was suspended';
COMMENT ON COLUMN profiles.suspended_by IS 'Admin user who suspended this account';
COMMENT ON COLUMN profiles.deleted_at IS 'Timestamp when account was soft deleted (NULL = active)';
COMMENT ON COLUMN profiles.deleted_by IS 'Admin user who soft deleted this account';
COMMENT ON COLUMN profiles.deletion_reason IS 'Reason for account deletion';
COMMENT ON COLUMN profiles.last_login_at IS 'Last successful login timestamp';
