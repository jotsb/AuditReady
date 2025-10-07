/*
  # Comprehensive Logging System
  
  ## Overview
  This migration creates a complete audit and system logging infrastructure with:
  - Full snapshot support (before/after states)
  - System logs with multiple severity levels
  - Structured metadata for all log types
  - Complete coverage of all operations
  
  ## Changes
  
  ### 1. Enhanced Audit Logs
  - Add `snapshot_before` column - complete state before change
  - Add `snapshot_after` column - complete state after change
  - Add `actor_role` column - role of user performing action
  - Add `ip_address` column - IP address of actor
  - Add `user_agent` column - browser/client info
  - Add `status` column - success/failure/denied
  - Add `error_message` column - for failed actions
  
  ### 2. New System Logs Table
  - `id` - unique identifier
  - `timestamp` - when event occurred
  - `level` - DEBUG, INFO, WARN, ERROR, CRITICAL
  - `category` - AUTH, DATABASE, API, EDGE_FUNCTION, CLIENT_ERROR, SECURITY
  - `message` - human-readable log message
  - `metadata` - structured JSON data
  - `user_id` - optional user associated with log
  - `session_id` - optional session identifier
  - `ip_address` - source IP
  - `user_agent` - client info
  - `stack_trace` - for errors
  - `execution_time_ms` - for performance tracking
  
  ### 3. Helper Functions
  - `log_system_event()` - generic system logging
  - `log_auth_event()` - authentication events
  - `log_performance_event()` - performance metrics
  - `log_security_event()` - security-related events
  
  ## Security
  - RLS enabled on both tables
  - Audit logs viewable by business owners and system admins
  - System logs viewable by system admins only
  - Write operations restricted to SECURITY DEFINER functions
*/

-- Step 1: Enhance existing audit_logs table
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS snapshot_before jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_after jsonb,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS error_message text;

-- Add check constraint for status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'audit_logs_status_check'
  ) THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_status_check 
      CHECK (status IN ('success', 'failure', 'denied'));
  END IF;
END $$;

-- Step 2: Create system_logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz DEFAULT now() NOT NULL,
  level text NOT NULL,
  category text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  ip_address inet,
  user_agent text,
  stack_trace text,
  execution_time_ms integer,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_role ON audit_logs(actor_role);

-- Add check constraints for system_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'system_logs_level_check'
  ) THEN
    ALTER TABLE system_logs
      ADD CONSTRAINT system_logs_level_check 
      CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'system_logs_category_check'
  ) THEN
    ALTER TABLE system_logs
      ADD CONSTRAINT system_logs_category_check 
      CHECK (category IN ('AUTH', 'DATABASE', 'API', 'EDGE_FUNCTION', 'CLIENT_ERROR', 'SECURITY', 'PERFORMANCE'));
  END IF;
END $$;

-- Enable RLS
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Step 3: Create helper functions

-- Generic system logging function
CREATE OR REPLACE FUNCTION log_system_event(
  p_level text,
  p_category text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_stack_trace text DEFAULT NULL,
  p_execution_time_ms integer DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO system_logs (
    level, category, message, metadata, user_id, session_id,
    ip_address, user_agent, stack_trace, execution_time_ms
  ) VALUES (
    p_level, p_category, p_message, p_metadata, p_user_id, p_session_id,
    p_ip_address, p_user_agent, p_stack_trace, p_execution_time_ms
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auth event logging
CREATE OR REPLACE FUNCTION log_auth_event(
  p_event_type text,
  p_user_id uuid,
  p_success boolean,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
BEGIN
  RETURN log_system_event(
    CASE WHEN p_success THEN 'INFO' ELSE 'WARN' END,
    'AUTH',
    format('Authentication event: %s', p_event_type),
    p_metadata || jsonb_build_object('event_type', p_event_type, 'success', p_success),
    p_user_id,
    NULL,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Performance event logging
CREATE OR REPLACE FUNCTION log_performance_event(
  p_operation text,
  p_execution_time_ms integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
BEGIN
  RETURN log_system_event(
    CASE 
      WHEN p_execution_time_ms > 5000 THEN 'WARN'
      WHEN p_execution_time_ms > 10000 THEN 'ERROR'
      ELSE 'INFO'
    END,
    'PERFORMANCE',
    format('Operation %s took %sms', p_operation, p_execution_time_ms),
    p_metadata || jsonb_build_object('operation', p_operation),
    auth.uid(),
    NULL,
    NULL,
    NULL,
    NULL,
    p_execution_time_ms
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Security event logging
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type text,
  p_severity text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
BEGIN
  RETURN log_system_event(
    p_severity,
    'SECURITY',
    format('Security event: %s', p_event_type),
    p_details || jsonb_build_object('event_type', p_event_type),
    auth.uid(),
    NULL,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced audit logging function
CREATE OR REPLACE FUNCTION log_audit_event(
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_snapshot_before jsonb DEFAULT NULL,
  p_snapshot_after jsonb DEFAULT NULL,
  p_status text DEFAULT 'success',
  p_error_message text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_audit_id uuid;
  v_role text;
BEGIN
  -- Get user's role for this resource if applicable
  v_role := 'member'; -- default
  
  IF p_resource_type IN ('business', 'collection', 'receipt') THEN
    -- Try to determine role from business_members
    SELECT role INTO v_role
    FROM business_members bm
    WHERE bm.user_id = auth.uid()
    LIMIT 1;
  END IF;

  INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id, details,
    snapshot_before, snapshot_after, actor_role, status, error_message,
    ip_address, user_agent
  ) VALUES (
    auth.uid(), p_action, p_resource_type, p_resource_id, p_details,
    p_snapshot_before, p_snapshot_after, v_role, p_status, p_error_message,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Update RLS policies for system_logs

-- Only system admins can view system logs
CREATE POLICY "System admins can view all system logs"
  ON system_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- No direct insert/update/delete for users
CREATE POLICY "No direct modifications to system logs"
  ON system_logs FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
