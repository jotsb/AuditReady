/*
  # Add check user exists function

  1. New Functions
    - `check_user_exists(user_email)` - Returns true if a user with the given email exists in auth.users
  
  2. Security
    - Function is accessible to anonymous users (needed for invitation acceptance flow)
    - Only returns boolean, no sensitive user data exposed
*/

CREATE OR REPLACE FUNCTION check_user_exists(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE email = user_email
  );
END;
$$;