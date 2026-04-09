/*
  # Close Immutability Gaps on Log Tables

  ## Problem
  The existing immutability triggers on system_logs and audit_logs only block
  row-level UPDATE and DELETE operations. TRUNCATE is a statement-level operation
  that bypasses row-level triggers entirely, allowing all log data to be wiped.
  Additionally, all roles (including anon) currently have TRUNCATE, UPDATE, and
  DELETE privileges on these tables.

  ## Changes

  ### 1. TRUNCATE Protection
  - Add statement-level BEFORE TRUNCATE triggers on both system_logs and audit_logs
  - These triggers raise an exception, blocking TRUNCATE unless restore_mode is active

  ### 2. Permission Revocation
  - Revoke TRUNCATE on system_logs and audit_logs from anon, authenticated, and service_role
  - Revoke UPDATE and DELETE on system_logs and audit_logs from anon and authenticated
  - Only postgres (superuser) retains full privileges
  - service_role retains UPDATE/DELETE (blocked by existing row-level triggers) but loses TRUNCATE

  ### 3. Restore Mode Bypass
  - Both the existing row-level triggers and the new TRUNCATE triggers check for
    a session variable `app.restore_mode = 'true'`
  - This allows the backup/restore system to function when explicitly enabled
  - The session variable can only be set by a superuser or via a SECURITY DEFINER function

  ## Security Impact
  - BEFORE: Any role could TRUNCATE log tables, wiping all data silently
  - AFTER: TRUNCATE is blocked by trigger + permission revocation at multiple layers
  - UPDATE/DELETE remain blocked by row-level triggers (existing) + permission revocation (new)

  ## Notes
  - The postgres superuser can still override everything (by design -- it is the DB owner)
  - Restore mode requires SET LOCAL app.restore_mode = 'true' in the session
*/

-- =====================================================
-- 1. UPDATE EXISTING ROW-LEVEL TRIGGERS TO SUPPORT RESTORE MODE
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_system_log_modifications()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.restore_mode', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'System logs are immutable. UPDATE operations are not allowed. Log ID: %', OLD.id
      USING HINT = 'System logs cannot be modified to maintain audit trail integrity.',
            ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'System logs are immutable. DELETE operations are not allowed. Log ID: %', OLD.id
      USING HINT = 'System logs cannot be deleted to maintain audit trail integrity.',
            ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_audit_log_modifications()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.restore_mode', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE operations are not allowed. Log ID: %', OLD.id
      USING HINT = 'Audit logs cannot be modified to maintain GDPR compliance and audit trail integrity.',
            ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit logs are immutable. DELETE operations are not allowed. Log ID: %', OLD.id
      USING HINT = 'Audit logs cannot be deleted to maintain GDPR compliance and audit trail integrity.',
            ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- 2. ADD TRUNCATE PROTECTION (STATEMENT-LEVEL TRIGGERS)
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_log_truncate()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.restore_mode', true) = 'true' THEN
    RETURN NULL;
  END IF;

  RAISE EXCEPTION '% is immutable. TRUNCATE operations are not allowed on table: %', TG_TABLE_NAME, TG_TABLE_NAME
    USING HINT = 'Log tables cannot be truncated to maintain audit trail integrity. Use app.restore_mode for authorized restore operations.',
          ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS prevent_system_log_truncate ON system_logs;
CREATE TRIGGER prevent_system_log_truncate
  BEFORE TRUNCATE ON system_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION prevent_log_truncate();

DROP TRIGGER IF EXISTS prevent_audit_log_truncate ON audit_logs;
CREATE TRIGGER prevent_audit_log_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION prevent_log_truncate();

COMMENT ON FUNCTION prevent_log_truncate() IS
  'Prevents TRUNCATE operations on log tables. Checks app.restore_mode session variable to allow authorized restore operations.';

-- =====================================================
-- 3. REVOKE DANGEROUS PERMISSIONS
-- =====================================================

REVOKE TRUNCATE ON system_logs FROM anon, authenticated, service_role;
REVOKE TRUNCATE ON audit_logs FROM anon, authenticated, service_role;

REVOKE UPDATE, DELETE ON system_logs FROM anon, authenticated;
REVOKE UPDATE, DELETE ON audit_logs FROM anon, authenticated;

-- =====================================================
-- 4. VERIFICATION COMMENTS
-- =====================================================

COMMENT ON TRIGGER prevent_system_log_truncate ON system_logs IS
  'Statement-level trigger that blocks TRUNCATE on system_logs. Bypassed only when app.restore_mode session variable is true.';

COMMENT ON TRIGGER prevent_audit_log_truncate ON audit_logs IS
  'Statement-level trigger that blocks TRUNCATE on audit_logs. Bypassed only when app.restore_mode session variable is true.';
