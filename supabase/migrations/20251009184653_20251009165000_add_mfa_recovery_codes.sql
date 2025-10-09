/*
  # Multi-Factor Authentication - Recovery Codes

  ## Overview
  This migration adds the recovery_codes table to support TOTP-based MFA with backup codes.

  ## Changes

  ### 1. New Tables
  - `recovery_codes` table for storing hashed backup codes
    - `id` (uuid, primary key) - Unique identifier
    - `user_id` (uuid, references auth.users) - Owner of the code
    - `code_hash` (text) - SHA-256 hash of recovery code (NEVER store plain text)
    - `used` (boolean) - Whether code has been used
    - `used_at` (timestamptz) - When code was used
    - `created_at` (timestamptz) - When code was generated
    - `expires_at` (timestamptz) - Expiration (1 year default)

  ### 2. Indexes
  - Fast lookup by user_id
  - Fast lookup of unused codes

  ### 3. Security
  - RLS enabled on recovery_codes table
  - Users can only view/manage their own codes
  - Codes stored as SHA-256 hashes (NOT plain text)
  - Automatic expiration after 1 year

  ### 4. Audit Triggers
  - Log recovery code generation
  - Log recovery code usage
  - Log recovery code deletion

  ## Security Notes
  - Recovery codes MUST be hashed before storage
  - Use SHA-256 for client-side hashing
  - Codes are single-use only
  - Expired codes cannot be used
*/

-- Create recovery_codes table
CREATE TABLE IF NOT EXISTS recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code_hash text NOT NULL,
  used boolean DEFAULT false NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '1 year') NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_recovery_codes_user_id ON recovery_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_unused ON recovery_codes(user_id, used) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_recovery_codes_expires_at ON recovery_codes(expires_at) WHERE used = false;

-- Add comment for documentation
COMMENT ON TABLE recovery_codes IS 'Stores hashed backup codes for MFA recovery. Codes are single-use and expire after 1 year.';
COMMENT ON COLUMN recovery_codes.code_hash IS 'SHA-256 hash of recovery code. NEVER store plain text codes.';

-- Enable Row Level Security
ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own recovery codes
CREATE POLICY "Users can view own recovery codes"
  ON recovery_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy: Users can create their own recovery codes
CREATE POLICY "Users can create own recovery codes"
  ON recovery_codes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own recovery codes (mark as used)
CREATE POLICY "Users can update own recovery codes"
  ON recovery_codes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own recovery codes
CREATE POLICY "Users can delete own recovery codes"
  ON recovery_codes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create audit trigger function for recovery_codes
CREATE OR REPLACE FUNCTION log_recovery_code_changes()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_action text;
  v_details jsonb;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'generate_recovery_codes';
    v_details := jsonb_build_object(
      'user_id', NEW.user_id,
      'expires_at', NEW.expires_at
    );

    -- Log to audit_logs
    INSERT INTO audit_logs (action, user_id, resource_type, resource_id, details)
    VALUES (v_action, NEW.user_id, 'recovery_code', NEW.id, v_details);

    -- Log to system_logs
    INSERT INTO system_logs (level, category, message, metadata, user_id)
    VALUES (
      'INFO',
      'SECURITY',
      'Recovery code generated',
      jsonb_build_object('user_id', NEW.user_id, 'code_id', NEW.id),
      NEW.user_id
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log if code was marked as used
    IF OLD.used = false AND NEW.used = true THEN
      v_action := 'recovery_code_used';
      v_details := jsonb_build_object(
        'user_id', NEW.user_id,
        'code_id', NEW.id,
        'used_at', NEW.used_at
      );

      -- Count remaining codes
      DECLARE
        v_remaining_count int;
      BEGIN
        SELECT COUNT(*) INTO v_remaining_count
        FROM recovery_codes
        WHERE user_id = NEW.user_id
          AND used = false
          AND expires_at > now();

        v_details := v_details || jsonb_build_object('remaining_codes', v_remaining_count);
      END;

      -- Log to audit_logs
      INSERT INTO audit_logs (action, user_id, resource_type, resource_id, details)
      VALUES (v_action, NEW.user_id, 'recovery_code', NEW.id, v_details);

      -- Log to system_logs with WARNING level (recovery code usage is notable)
      INSERT INTO system_logs (level, category, message, metadata, user_id)
      VALUES (
        'WARN',
        'SECURITY',
        'User logged in using recovery code',
        v_details,
        NEW.user_id
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete_recovery_code';
    v_details := jsonb_build_object(
      'user_id', OLD.user_id,
      'code_id', OLD.id,
      'was_used', OLD.used
    );

    -- Log to audit_logs
    INSERT INTO audit_logs (action, user_id, resource_type, resource_id, details)
    VALUES (v_action, OLD.user_id, 'recovery_code', OLD.id, v_details);

    -- Log to system_logs
    INSERT INTO system_logs (level, category, message, metadata, user_id)
    VALUES (
      'INFO',
      'SECURITY',
      'Recovery code deleted',
      v_details,
      OLD.user_id
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger for recovery_codes audit logging
DROP TRIGGER IF EXISTS recovery_codes_audit_trigger ON recovery_codes;
CREATE TRIGGER recovery_codes_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON recovery_codes
  FOR EACH ROW
  EXECUTE FUNCTION log_recovery_code_changes();

-- Create function to clean up expired recovery codes (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_expired_recovery_codes()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count int;
BEGIN
  -- Delete expired and used codes
  WITH deleted AS (
    DELETE FROM recovery_codes
    WHERE (expires_at < now() OR used = true)
    RETURNING *
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  -- Log cleanup action
  IF v_deleted_count > 0 THEN
    INSERT INTO system_logs (level, category, message, metadata)
    VALUES (
      'INFO',
      'DATABASE',
      'Cleaned up expired recovery codes',
      jsonb_build_object('deleted_count', v_deleted_count)
    );
  END IF;
END;
$$;

-- Add comment for maintenance function
COMMENT ON FUNCTION cleanup_expired_recovery_codes IS 'Removes expired and used recovery codes. Run periodically via cron or manually.';
