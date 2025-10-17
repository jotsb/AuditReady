/*
  # Capture IP Addresses in Logs

  1. Changes
    - Update `log_system_event` function to automatically capture client IP address
    - Uses PostgreSQL's built-in `inet_client_addr()` to get the connection IP
    - Overrides null parameter with actual IP when available

  2. Notes
    - Client-side code cannot access IP addresses due to browser security
    - Database can see the IP from the PostgreSQL connection
    - This captures the real client IP for all system logs
*/

-- Update the log_system_event function to capture IP automatically
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
  v_actual_ip inet;
BEGIN
  -- Capture the actual client IP address from the connection
  -- Use inet_client_addr() if p_ip_address is null
  v_actual_ip := COALESCE(p_ip_address, inet_client_addr());

  INSERT INTO system_logs (
    level, category, message, metadata, user_id, session_id,
    ip_address, user_agent, stack_trace, execution_time_ms
  ) VALUES (
    p_level, p_category, p_message, p_metadata, p_user_id, p_session_id,
    v_actual_ip, p_user_agent, p_stack_trace, p_execution_time_ms
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
