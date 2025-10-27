/*
  # Add Comprehensive Rate Limiting System

  ## Overview
  This migration adds database-backed rate limiting for login attempts, receipt uploads, and API calls.
  Provides protection against brute force attacks, spam, and cost overruns.

  ## 1. New Tables

  ### `rate_limit_attempts`
  Tracks rate limit violations and attempts across the system
  - `id` (uuid, primary key)
  - `identifier` (text) - IP address or user ID
  - `action_type` (text) - Type of action (login, upload, api_call)
  - `attempts` (integer) - Number of attempts in current window
  - `window_start` (timestamptz) - Start of rate limit window
  - `window_end` (timestamptz) - End of rate limit window
  - `is_blocked` (boolean) - Whether identifier is currently blocked
  - `block_expires_at` (timestamptz) - When block expires
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `failed_login_attempts`
  Tracks failed login attempts for account lockout
  - `id` (uuid, primary key)
  - `email` (text) - Email address attempted
  - `ip_address` (inet) - IP address of attempt
  - `attempt_time` (timestamptz) - When attempt occurred
  - `user_agent` (text) - Browser/client info
  - `failure_reason` (text) - Why login failed

  ### `account_lockouts`
  Tracks locked accounts
  - `id` (uuid, primary key)
  - `email` (text) - Locked email address
  - `locked_at` (timestamptz) - When account was locked
  - `locked_until` (timestamptz) - When lockout expires
  - `locked_by_ip` (inet) - IP that triggered lockout
  - `attempts_count` (integer) - Number of failed attempts that triggered lockout
  - `is_active` (boolean) - Whether lockout is currently active

  ## 2. Security
  - Enable RLS on all tables
  - Only system admins can view rate limit data
  - Restrictive policies for data protection

  ## 3. Functions
  - `check_rate_limit()` - Check if action should be rate limited
  - `record_failed_login()` - Record failed login attempt
  - `check_account_lockout()` - Check if account is locked
  - `unlock_account()` - Admin function to manually unlock accounts
  - `cleanup_old_rate_limits()` - Remove expired entries
*/

-- ============================================================================
-- TABLES
-- ============================================================================

-- Rate limit attempts tracking
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('login', 'upload', 'api_call', 'export', 'email')),
  attempts integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  window_end timestamptz NOT NULL,
  is_blocked boolean NOT NULL DEFAULT false,
  block_expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create composite index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_action
  ON rate_limit_attempts(identifier, action_type, window_end)
  WHERE is_blocked = false;

CREATE INDEX IF NOT EXISTS idx_rate_limit_blocked
  ON rate_limit_attempts(identifier, is_blocked, block_expires_at)
  WHERE is_blocked = true;

-- Failed login attempts
CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address inet NOT NULL,
  attempt_time timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  failure_reason text NOT NULL DEFAULT 'invalid_credentials',
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_failed_login_email_time
  ON failed_login_attempts(email, attempt_time DESC);

CREATE INDEX IF NOT EXISTS idx_failed_login_ip_time
  ON failed_login_attempts(ip_address, attempt_time DESC);

-- Account lockouts
CREATE TABLE IF NOT EXISTS account_lockouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz NOT NULL,
  locked_by_ip inet NOT NULL,
  attempts_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  unlock_reason text,
  unlocked_at timestamptz,
  unlocked_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_account_lockouts_email_active
  ON account_lockouts(email, is_active, locked_until)
  WHERE is_active = true;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_lockouts ENABLE ROW LEVEL SECURITY;

-- Only system admins can view rate limit data
CREATE POLICY "System admins can view rate limits"
  ON rate_limit_attempts FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can view failed login attempts"
  ON failed_login_attempts FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can view account lockouts"
  ON account_lockouts FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can manage account lockouts"
  ON account_lockouts FOR UPDATE
  TO authenticated
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Check rate limit for an action
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier text,
  p_action_type text,
  p_max_attempts integer DEFAULT 5,
  p_window_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_attempts integer;
  v_window_end timestamptz;
  v_is_blocked boolean;
  v_block_expires_at timestamptz;
  v_remaining integer;
  v_reset_at timestamptz;
BEGIN
  -- Check if identifier is currently blocked
  SELECT is_blocked, block_expires_at
  INTO v_is_blocked, v_block_expires_at
  FROM rate_limit_attempts
  WHERE identifier = p_identifier
    AND action_type = p_action_type
    AND is_blocked = true
    AND block_expires_at > now()
  ORDER BY block_expires_at DESC
  LIMIT 1;

  -- If blocked and block hasn't expired
  IF v_is_blocked AND v_block_expires_at > now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked', true,
      'retryAfter', EXTRACT(EPOCH FROM (v_block_expires_at - now()))::integer,
      'resetAt', v_block_expires_at
    );
  END IF;

  -- Get or create rate limit entry for current window
  SELECT attempts, window_end
  INTO v_current_attempts, v_window_end
  FROM rate_limit_attempts
  WHERE identifier = p_identifier
    AND action_type = p_action_type
    AND window_end > now()
    AND is_blocked = false
  ORDER BY window_end DESC
  LIMIT 1;

  -- Create new window if none exists or expired
  IF v_current_attempts IS NULL THEN
    v_current_attempts := 0;
    v_window_end := now() + (p_window_minutes || ' minutes')::interval;

    INSERT INTO rate_limit_attempts (
      identifier,
      action_type,
      attempts,
      window_start,
      window_end,
      is_blocked
    ) VALUES (
      p_identifier,
      p_action_type,
      0,
      now(),
      v_window_end,
      false
    );
  END IF;

  -- Increment attempt counter
  v_current_attempts := v_current_attempts + 1;

  UPDATE rate_limit_attempts
  SET
    attempts = v_current_attempts,
    updated_at = now()
  WHERE identifier = p_identifier
    AND action_type = p_action_type
    AND window_end = v_window_end;

  -- Check if limit exceeded
  IF v_current_attempts > p_max_attempts THEN
    -- Block for 2x the window time
    v_block_expires_at := now() + (p_window_minutes * 2 || ' minutes')::interval;

    UPDATE rate_limit_attempts
    SET
      is_blocked = true,
      block_expires_at = v_block_expires_at,
      updated_at = now()
    WHERE identifier = p_identifier
      AND action_type = p_action_type
      AND window_end = v_window_end;

    RETURN jsonb_build_object(
      'allowed', false,
      'blocked', true,
      'retryAfter', EXTRACT(EPOCH FROM (v_block_expires_at - now()))::integer,
      'resetAt', v_block_expires_at
    );
  END IF;

  -- Return success with remaining attempts
  v_remaining := p_max_attempts - v_current_attempts;
  v_reset_at := v_window_end;

  RETURN jsonb_build_object(
    'allowed', true,
    'blocked', false,
    'remaining', v_remaining,
    'limit', p_max_attempts,
    'resetAt', v_reset_at
  );
END;
$$;

-- Record failed login attempt
CREATE OR REPLACE FUNCTION record_failed_login(
  p_email text,
  p_ip_address inet,
  p_user_agent text DEFAULT NULL,
  p_failure_reason text DEFAULT 'invalid_credentials'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recent_attempts integer;
  v_lockout_threshold integer := 5;
  v_lockout_window_minutes integer := 15;
  v_lockout_duration_minutes integer := 30;
  v_lockout_until timestamptz;
BEGIN
  -- Record the failed attempt
  INSERT INTO failed_login_attempts (
    email,
    ip_address,
    attempt_time,
    user_agent,
    failure_reason
  ) VALUES (
    p_email,
    p_ip_address,
    now(),
    p_user_agent,
    p_failure_reason
  );

  -- Count recent failed attempts in the lockout window
  SELECT COUNT(*)
  INTO v_recent_attempts
  FROM failed_login_attempts
  WHERE email = p_email
    AND attempt_time > (now() - (v_lockout_window_minutes || ' minutes')::interval);

  -- Check if we should lock the account
  IF v_recent_attempts >= v_lockout_threshold THEN
    v_lockout_until := now() + (v_lockout_duration_minutes || ' minutes')::interval;

    -- Create or update lockout
    INSERT INTO account_lockouts (
      email,
      locked_at,
      locked_until,
      locked_by_ip,
      attempts_count,
      is_active
    ) VALUES (
      p_email,
      now(),
      v_lockout_until,
      p_ip_address,
      v_recent_attempts,
      true
    )
    ON CONFLICT DO NOTHING;

    -- Log the lockout event
    PERFORM log_system_event(
      p_level := 'WARN',
      p_category := 'AUTH',
      p_message := 'Account locked due to failed login attempts',
      p_user_id := NULL,
      p_business_id := NULL,
      p_ip_address := p_ip_address,
      p_user_agent := p_user_agent,
      p_metadata := jsonb_build_object(
        'email', p_email,
        'attempts', v_recent_attempts,
        'locked_until', v_lockout_until
      )
    );

    RETURN jsonb_build_object(
      'locked', true,
      'attempts', v_recent_attempts,
      'lockedUntil', v_lockout_until,
      'message', 'Account temporarily locked due to multiple failed login attempts'
    );
  END IF;

  -- Return attempt info without lockout
  RETURN jsonb_build_object(
    'locked', false,
    'attempts', v_recent_attempts,
    'remainingAttempts', v_lockout_threshold - v_recent_attempts
  );
END;
$$;

-- Check if account is locked
CREATE OR REPLACE FUNCTION check_account_lockout(
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lockout_record RECORD;
BEGIN
  -- Find active lockout
  SELECT *
  INTO v_lockout_record
  FROM account_lockouts
  WHERE email = p_email
    AND is_active = true
    AND locked_until > now()
  ORDER BY locked_at DESC
  LIMIT 1;

  -- If no active lockout found
  IF v_lockout_record IS NULL THEN
    RETURN jsonb_build_object(
      'locked', false
    );
  END IF;

  -- Return lockout info
  RETURN jsonb_build_object(
    'locked', true,
    'lockedAt', v_lockout_record.locked_at,
    'lockedUntil', v_lockout_record.locked_until,
    'attemptsCount', v_lockout_record.attempts_count,
    'retryAfter', EXTRACT(EPOCH FROM (v_lockout_record.locked_until - now()))::integer
  );
END;
$$;

-- Unlock account (admin function)
CREATE OR REPLACE FUNCTION unlock_account(
  p_email text,
  p_unlock_reason text DEFAULT 'Manual unlock by admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  -- Verify caller is system admin
  IF NOT is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only system admins can unlock accounts';
  END IF;

  v_admin_id := auth.uid();

  -- Deactivate all active lockouts for this email
  UPDATE account_lockouts
  SET
    is_active = false,
    unlock_reason = p_unlock_reason,
    unlocked_at = now(),
    unlocked_by = v_admin_id
  WHERE email = p_email
    AND is_active = true;

  -- Log the unlock event
  PERFORM log_system_event(
    p_level := 'INFO',
    p_category := 'AUTH',
    p_message := 'Account manually unlocked by admin',
    p_user_id := v_admin_id,
    p_business_id := NULL,
    p_metadata := jsonb_build_object(
      'email', p_email,
      'unlock_reason', p_unlock_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Account unlocked successfully'
  );
END;
$$;

-- Cleanup old rate limit entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Delete expired rate limit attempts (older than 7 days)
  DELETE FROM rate_limit_attempts
  WHERE window_end < (now() - interval '7 days')
    OR (is_blocked = true AND block_expires_at < (now() - interval '7 days'));

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Delete old failed login attempts (older than 30 days)
  DELETE FROM failed_login_attempts
  WHERE attempt_time < (now() - interval '30 days');

  -- Deactivate expired lockouts
  UPDATE account_lockouts
  SET is_active = false
  WHERE is_active = true
    AND locked_until < now();

  RETURN v_deleted_count;
END;
$$;

-- ============================================================================
-- AUDIT LOGGING
-- ============================================================================

-- Audit trigger for account_lockouts
CREATE OR REPLACE FUNCTION audit_account_lockouts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      new_values,
      changed_by,
      ip_address
    ) VALUES (
      'account_lockouts',
      NEW.id,
      'INSERT',
      to_jsonb(NEW),
      auth.uid(),
      inet_client_addr()
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_values,
      new_values,
      changed_by,
      ip_address
    ) VALUES (
      'account_lockouts',
      NEW.id,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      auth.uid(),
      inet_client_addr()
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_account_lockouts_trigger
  AFTER INSERT OR UPDATE ON account_lockouts
  FOR EACH ROW
  EXECUTE FUNCTION audit_account_lockouts();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Grant execute permissions to authenticated users for public functions
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, anon;
GRANT EXECUTE ON FUNCTION record_failed_login TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_account_lockout TO authenticated, anon;

-- Admin-only functions
GRANT EXECUTE ON FUNCTION unlock_account TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_rate_limits TO authenticated;
