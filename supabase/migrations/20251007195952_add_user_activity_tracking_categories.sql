/*
  # Add User Activity Tracking Categories
  
  ## Overview
  Extends the logging system to track user interactions and page views.
  
  ## Changes
  
  ### 1. Add New Log Categories
  - Add `USER_ACTION` - for button clicks, form submissions, interactions
  - Add `PAGE_VIEW` - for page navigation and loading
  - Add `NAVIGATION` - for route changes
  
  ### 2. Add session_id index
  - Improves query performance when filtering by session
  
  ### 3. Add log_level_config table
  - Allows dynamic log level configuration per category
  - System admins can adjust logging verbosity without code changes
  - Supports investigation mode (enable DEBUG/TRACE)
  
  ## Notes
  - Log levels: DEBUG, INFO, WARN, ERROR, CRITICAL
  - Default level: INFO for production, DEBUG for investigations
  - Session IDs generated client-side for tracking user activity
*/

-- Step 1: Update category check constraint to include new categories
ALTER TABLE system_logs
  DROP CONSTRAINT IF EXISTS system_logs_category_check;

ALTER TABLE system_logs
  ADD CONSTRAINT system_logs_category_check 
  CHECK (category IN (
    'AUTH', 'DATABASE', 'API', 'EDGE_FUNCTION', 
    'CLIENT_ERROR', 'SECURITY', 'PERFORMANCE',
    'USER_ACTION', 'PAGE_VIEW', 'NAVIGATION'
  ));

-- Step 2: Add session_id index for better filtering
CREATE INDEX IF NOT EXISTS idx_system_logs_session_id ON system_logs(session_id) WHERE session_id IS NOT NULL;

-- Step 3: Create log level configuration table
CREATE TABLE IF NOT EXISTS log_level_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text UNIQUE NOT NULL,
  min_level text NOT NULL DEFAULT 'INFO',
  enabled boolean NOT NULL DEFAULT true,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add check constraint for log level
ALTER TABLE log_level_config
  ADD CONSTRAINT log_level_config_level_check 
  CHECK (min_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'));

-- Step 4: Insert default configuration
INSERT INTO log_level_config (category, min_level, enabled, description)
VALUES 
  ('AUTH', 'INFO', true, 'Authentication and authorization events'),
  ('DATABASE', 'INFO', true, 'Database operations and queries'),
  ('API', 'INFO', true, 'External API calls'),
  ('EDGE_FUNCTION', 'INFO', true, 'Edge function execution'),
  ('CLIENT_ERROR', 'WARN', true, 'Client-side errors and exceptions'),
  ('SECURITY', 'INFO', true, 'Security-related events'),
  ('PERFORMANCE', 'INFO', true, 'Performance metrics and timing'),
  ('USER_ACTION', 'INFO', true, 'User interactions (clicks, submissions)'),
  ('PAGE_VIEW', 'INFO', true, 'Page navigation and views'),
  ('NAVIGATION', 'INFO', true, 'Route changes and navigation')
ON CONFLICT (category) DO NOTHING;

-- Enable RLS on log_level_config
ALTER TABLE log_level_config ENABLE ROW LEVEL SECURITY;

-- System admins can view and modify log configuration
CREATE POLICY "System admins can view log config"
  ON log_level_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System admins can update log config"
  ON log_level_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Step 5: Create function to check if log should be recorded
CREATE OR REPLACE FUNCTION should_log_event(
  p_category text,
  p_level text
)
RETURNS boolean AS $$
DECLARE
  v_config record;
  v_level_priority int;
  v_min_priority int;
BEGIN
  -- Get configuration for category
  SELECT * INTO v_config
  FROM log_level_config
  WHERE category = p_category;
  
  -- If no config or disabled, don't log
  IF v_config IS NULL OR NOT v_config.enabled THEN
    RETURN false;
  END IF;
  
  -- Convert levels to priorities (higher = more severe)
  v_level_priority := CASE p_level
    WHEN 'DEBUG' THEN 1
    WHEN 'INFO' THEN 2
    WHEN 'WARN' THEN 3
    WHEN 'ERROR' THEN 4
    WHEN 'CRITICAL' THEN 5
    ELSE 2
  END;
  
  v_min_priority := CASE v_config.min_level
    WHEN 'DEBUG' THEN 1
    WHEN 'INFO' THEN 2
    WHEN 'WARN' THEN 3
    WHEN 'ERROR' THEN 4
    WHEN 'CRITICAL' THEN 5
    ELSE 2
  END;
  
  -- Log if level is at or above minimum
  RETURN v_level_priority >= v_min_priority;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
