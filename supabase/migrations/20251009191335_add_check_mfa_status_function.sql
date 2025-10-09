/*
  # Add function to check MFA status
  
  1. New Functions
    - `check_user_mfa_status(user_id uuid)` - Returns whether user has verified MFA factors
  
  2. Security
    - Function is security definer to access auth schema
    - Only accessible to authenticated users
    - Can only check own MFA status
*/

-- Function to check if a user has verified MFA factors
CREATE OR REPLACE FUNCTION check_user_mfa_status(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  has_verified_factors boolean;
BEGIN
  -- Only allow users to check their own MFA status
  IF auth.uid() != check_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Can only check your own MFA status';
  END IF;

  -- Check if user has any verified MFA factors
  SELECT EXISTS (
    SELECT 1
    FROM auth.mfa_factors
    WHERE user_id = check_user_id
    AND status = 'verified'
  ) INTO has_verified_factors;

  RETURN COALESCE(has_verified_factors, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_user_mfa_status(uuid) TO authenticated;
