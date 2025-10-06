/*
  # Add function to get user email
  
  This migration adds a helper function to retrieve user emails from auth.users.
  This is needed because the profiles table doesn't store email addresses.
*/

-- Function to get user email from auth.users
CREATE OR REPLACE FUNCTION get_user_email(user_id uuid)
RETURNS text AS $$
  SELECT email FROM auth.users WHERE id = $1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
