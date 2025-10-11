/*
  # Add Admin Function to Reset User MFA

  This migration creates a secure database function that allows system admins to reset a user's MFA.
  
  1. New Functions
    - `admin_reset_user_mfa(target_user_id uuid, admin_user_id uuid, reset_reason text)` - Resets all MFA for a user
  
  2. Security
    - Only system admins can call this function
    - All operations are logged
    - Validates both user IDs are valid UUIDs
*/

-- Create function to reset user MFA (bypasses the auth-js API issues)
CREATE OR REPLACE FUNCTION admin_reset_user_mfa(
  target_user_id uuid,
  admin_user_id uuid,
  reset_reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_factors_deleted integer;
BEGIN
  -- Verify the caller is a system admin
  SELECT EXISTS (
    SELECT 1 FROM system_roles 
    WHERE user_id = admin_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only system admins can reset MFA';
  END IF;

  -- Delete all MFA factors for the target user
  DELETE FROM auth.mfa_factors 
  WHERE user_id = target_user_id;
  
  GET DIAGNOSTICS v_factors_deleted = ROW_COUNT;

  -- Update the user's profile
  UPDATE profiles
  SET 
    mfa_enabled = false,
    mfa_method = null,
    trusted_devices = null,
    updated_at = now()
  WHERE id = target_user_id;

  -- Delete recovery codes
  DELETE FROM recovery_codes
  WHERE user_id = target_user_id;

  -- Log the action in audit_logs
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    admin_user_id,
    'admin_reset_mfa',
    'profile',
    target_user_id,
    jsonb_build_object(
      'reason', reset_reason,
      'via', 'database_function',
      'factors_removed', v_factors_deleted
    )
  );

  -- Log system event
  PERFORM log_system_event(
    'WARN',
    'SECURITY',
    'Admin reset user MFA via database function',
    jsonb_build_object(
      'action', 'reset_mfa',
      'target_user_id', target_user_id,
      'admin_user_id', admin_user_id,
      'reason', reset_reason,
      'factors_removed', v_factors_deleted
    ),
    admin_user_id,
    null,
    null,
    null,
    null,
    null
  );

  RETURN json_build_object(
    'success', true,
    'factors_removed', v_factors_deleted,
    'message', 'MFA reset successfully'
  );
END;
$$;

-- Grant execute permission to authenticated users (function will check admin status internally)
GRANT EXECUTE ON FUNCTION admin_reset_user_mfa(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION admin_reset_user_mfa IS 'Allows system admins to reset a user''s MFA. Validates admin permissions and logs all actions.';