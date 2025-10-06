/*
  # Fix get_user_email function permissions
  
  The function needs proper access to auth.users table.
  We'll recreate it with the correct security context.
*/

-- Drop the old function
DROP FUNCTION IF EXISTS get_user_email(uuid);

-- Recreate with proper permissions to access auth schema
CREATE OR REPLACE FUNCTION get_user_email(user_id uuid)
RETURNS text AS $$
DECLARE
  user_email text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = user_id;
  RETURN user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_email(uuid) TO authenticated;