/*
  # Add MFA Rate Limiting

  1. New Tables
    - `mfa_failed_attempts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `attempt_type` (text) - 'totp' or 'recovery_code'
      - `attempted_at` (timestamptz)
      - `ip_address` (text, optional)
      - `user_agent` (text, optional)

  2. Functions
    - `check_mfa_lockout` - Check if user is locked out
    - `record_mfa_attempt` - Record failed attempt
    - `clear_mfa_attempts` - Clear attempts after successful login

  3. Security
    - Enable RLS on `mfa_failed_attempts`
    - Users can only view their own attempts
    - Automatic cleanup of old attempts (>1 hour)
*/

-- Create mfa_failed_attempts table
CREATE TABLE IF NOT EXISTS mfa_failed_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  attempt_type text NOT NULL CHECK (attempt_type IN ('totp', 'recovery_code')),
  attempted_at timestamptz DEFAULT now() NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_mfa_failed_attempts_user_id ON mfa_failed_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_failed_attempts_attempted_at ON mfa_failed_attempts(attempted_at);

-- Enable RLS
ALTER TABLE mfa_failed_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own failed attempts"
  ON mfa_failed_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own failed attempts"
  ON mfa_failed_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to check if user is locked out
CREATE OR REPLACE FUNCTION check_mfa_lockout(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempt_count int;
  v_lockout_until timestamptz;
  v_result jsonb;
BEGIN
  -- Count failed attempts in last hour
  SELECT COUNT(*)
  INTO v_attempt_count
  FROM mfa_failed_attempts
  WHERE user_id = p_user_id
    AND attempted_at > now() - interval '1 hour';

  -- Determine lockout status
  IF v_attempt_count >= 10 THEN
    -- Severe lockout: 1 hour
    SELECT MAX(attempted_at) + interval '1 hour'
    INTO v_lockout_until
    FROM mfa_failed_attempts
    WHERE user_id = p_user_id;

    v_result := jsonb_build_object(
      'is_locked_out', true,
      'attempt_count', v_attempt_count,
      'lockout_until', v_lockout_until,
      'lockout_duration_minutes', 60,
      'message', 'Too many failed attempts. Account locked for 1 hour.'
    );
  ELSIF v_attempt_count >= 5 THEN
    -- Moderate lockout: 15 minutes
    SELECT MAX(attempted_at) + interval '15 minutes'
    INTO v_lockout_until
    FROM mfa_failed_attempts
    WHERE user_id = p_user_id;

    v_result := jsonb_build_object(
      'is_locked_out', true,
      'attempt_count', v_attempt_count,
      'lockout_until', v_lockout_until,
      'lockout_duration_minutes', 15,
      'message', 'Too many failed attempts. Please wait 15 minutes.'
    );
  ELSIF v_attempt_count >= 3 THEN
    -- Mild lockout: 5 minutes
    SELECT MAX(attempted_at) + interval '5 minutes'
    INTO v_lockout_until
    FROM mfa_failed_attempts
    WHERE user_id = p_user_id;

    v_result := jsonb_build_object(
      'is_locked_out', true,
      'attempt_count', v_attempt_count,
      'lockout_until', v_lockout_until,
      'lockout_duration_minutes', 5,
      'message', 'Too many failed attempts. Please wait 5 minutes.'
    );
  ELSE
    -- Not locked out
    v_result := jsonb_build_object(
      'is_locked_out', false,
      'attempt_count', v_attempt_count,
      'lockout_until', null,
      'lockout_duration_minutes', 0,
      'message', 'Not locked out'
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Function to record failed attempt
CREATE OR REPLACE FUNCTION record_mfa_failed_attempt(
  p_user_id uuid,
  p_attempt_type text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO mfa_failed_attempts (user_id, attempt_type, ip_address, user_agent)
  VALUES (p_user_id, p_attempt_type, p_ip_address, p_user_agent);

  -- Clean up old attempts (older than 1 hour)
  DELETE FROM mfa_failed_attempts
  WHERE user_id = p_user_id
    AND attempted_at < now() - interval '1 hour';
END;
$$;

-- Function to clear attempts after successful login
CREATE OR REPLACE FUNCTION clear_mfa_failed_attempts(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM mfa_failed_attempts
  WHERE user_id = p_user_id;
END;
$$;

-- Automatic cleanup function (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_mfa_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM mfa_failed_attempts
  WHERE attempted_at < now() - interval '24 hours';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_mfa_lockout(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION record_mfa_failed_attempt(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_mfa_failed_attempts(uuid) TO authenticated;
