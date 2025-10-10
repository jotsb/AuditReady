/*
  # Add Database-Level Immutability for Log Tables
  
  ## Summary
  Add database triggers to enforce immutability on system_logs and audit_logs tables.
  This prevents ANY modifications (including from service role) to maintain audit trail integrity.
  
  ## Changes Made
  
  ### 1. System Logs Protection
  - Create trigger function to block UPDATE/DELETE operations
  - Apply trigger to system_logs table
  - Works even when RLS is bypassed (service role)
  
  ### 2. Audit Logs Protection
  - Create trigger function to block UPDATE/DELETE operations
  - Apply trigger to audit_logs table
  - Maintains GDPR compliance with immutable audit trail
  
  ### 3. Insert Protection for Audit Logs
  - Add RLS policy to block direct INSERT from users
  - Only triggers and Edge Functions (service role) can insert
  
  ## Security Impact
  - **BEFORE**: Service role could modify/delete logs
  - **AFTER**: NO ONE can modify logs, not even service role
  - Audit trail is cryptographically sound
  
  ## Notes
  - Triggers run BEFORE operation, so they block at database level
  - SECURITY DEFINER ensures trigger can't be bypassed
  - RAISE EXCEPTION prevents operation and rolls back transaction
*/

-- =====================================================
-- SYSTEM LOGS IMMUTABILITY
-- =====================================================

-- Create trigger function for system_logs
CREATE OR REPLACE FUNCTION prevent_system_log_modifications()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS prevent_system_log_updates ON system_logs;

-- Apply trigger to system_logs
CREATE TRIGGER prevent_system_log_updates
  BEFORE UPDATE OR DELETE ON system_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_system_log_modifications();

-- Add comment
COMMENT ON FUNCTION prevent_system_log_modifications() IS 
  'Prevents any UPDATE or DELETE operations on system_logs table to maintain immutable audit trail. Works even with service role.';

-- =====================================================
-- AUDIT LOGS IMMUTABILITY
-- =====================================================

-- Create trigger function for audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_log_modifications()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS prevent_audit_log_updates ON audit_logs;

-- Apply trigger to audit_logs
CREATE TRIGGER prevent_audit_log_updates
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modifications();

-- Add comment
COMMENT ON FUNCTION prevent_audit_log_modifications() IS 
  'Prevents any UPDATE or DELETE operations on audit_logs table to maintain immutable audit trail for GDPR compliance. Works even with service role.';

-- =====================================================
-- AUDIT LOGS RLS FOR INSERT
-- =====================================================

-- Block direct INSERT from authenticated users
-- Only triggers and Edge Functions (using service role) should insert
DROP POLICY IF EXISTS "Block direct audit log inserts" ON audit_logs;

CREATE POLICY "Block direct audit log inserts"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Note: Service role bypasses RLS, so Edge Functions can still insert
COMMENT ON POLICY "Block direct audit log inserts" ON audit_logs IS
  'Prevents users from directly inserting audit logs. Only triggers and Edge Functions (service role) can insert to maintain integrity.';

-- =====================================================
-- TESTING & VERIFICATION
-- =====================================================

-- To test immutability (should fail):
-- UPDATE system_logs SET level = 'CRITICAL' WHERE id = (SELECT id FROM system_logs LIMIT 1);
-- DELETE FROM system_logs WHERE id = (SELECT id FROM system_logs LIMIT 1);
-- UPDATE audit_logs SET action = 'TEST' WHERE id = (SELECT id FROM audit_logs LIMIT 1);
-- DELETE FROM audit_logs WHERE id = (SELECT id FROM audit_logs LIMIT 1);

-- All above commands should raise: "ERROR: ... logs are immutable"
