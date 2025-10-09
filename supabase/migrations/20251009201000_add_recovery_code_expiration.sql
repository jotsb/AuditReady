/*
  # Add Recovery Code Expiration

  1. Changes
    - Set default expiration for recovery codes (12 months from creation)
    - Add function to clean up expired codes
    - Add function to check for expiring codes

  2. Notes
    - Codes expire 12 months after creation
    - Automatic cleanup of expired codes
    - Users warned when codes are close to expiring
*/

-- Update existing recovery codes to have expiration dates (12 months from created_at)
UPDATE recovery_codes
SET expires_at = created_at + interval '12 months'
WHERE expires_at IS NULL OR expires_at > now() + interval '100 years';

-- Update the expires_at column to have a default value
ALTER TABLE recovery_codes
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '12 months');

-- Function to check if user has expiring recovery codes (within 30 days)
CREATE OR REPLACE FUNCTION check_expiring_recovery_codes(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expiring_count int;
  v_earliest_expiry timestamptz;
  v_result jsonb;
BEGIN
  -- Count codes expiring in next 30 days
  SELECT COUNT(*), MIN(expires_at)
  INTO v_expiring_count, v_earliest_expiry
  FROM recovery_codes
  WHERE user_id = p_user_id
    AND used = false
    AND expires_at > now()
    AND expires_at < now() + interval '30 days';

  IF v_expiring_count > 0 THEN
    v_result := jsonb_build_object(
      'has_expiring_codes', true,
      'expiring_count', v_expiring_count,
      'earliest_expiry', v_earliest_expiry,
      'days_until_expiry', EXTRACT(days FROM (v_earliest_expiry - now())),
      'message', format('%s recovery code(s) will expire in %s days',
                       v_expiring_count,
                       EXTRACT(days FROM (v_earliest_expiry - now())))
    );
  ELSE
    v_result := jsonb_build_object(
      'has_expiring_codes', false,
      'expiring_count', 0,
      'earliest_expiry', null,
      'days_until_expiry', null,
      'message', 'No codes expiring soon'
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Function to delete expired recovery codes
CREATE OR REPLACE FUNCTION cleanup_expired_recovery_codes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count int;
  v_result jsonb;
BEGIN
  WITH deleted AS (
    DELETE FROM recovery_codes
    WHERE expires_at < now()
    RETURNING *
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  v_result := jsonb_build_object(
    'deleted_count', v_deleted_count,
    'cleanup_time', now(),
    'message', format('Deleted %s expired recovery code(s)', v_deleted_count)
  );

  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_expiring_recovery_codes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_recovery_codes() TO authenticated;

-- Note: In production, you should schedule cleanup_expired_recovery_codes()
-- to run periodically (e.g., daily) using pg_cron or external scheduler
