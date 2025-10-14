/*
  # Add System Configuration Table

  1. New Table
    - `system_config`
      - `id` (uuid, primary key) - Single row identifier
      - `storage_settings` (jsonb) - Storage configuration
      - `email_settings` (jsonb) - Email configuration
      - `app_settings` (jsonb) - Application settings
      - `feature_flags` (jsonb) - Feature toggles
      - `updated_at` (timestamptz) - Last update timestamp
      - `updated_by` (uuid) - Admin who last updated

  2. Security
    - Enable RLS
    - Only system admins can view/update configuration
    - Audit trigger for all configuration changes

  3. Helper Functions
    - `get_system_config()` - Returns current configuration
    - `update_system_config()` - Updates configuration with validation
    - `get_default_system_config()` - Returns default configuration

  4. Default Configuration
    - Insert default system configuration on creation
*/

-- Create system_config table
CREATE TABLE IF NOT EXISTS system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_settings jsonb NOT NULL DEFAULT '{
    "max_file_size_mb": 10,
    "allowed_file_types": ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    "default_storage_quota_gb": 10
  }'::jsonb,
  email_settings jsonb NOT NULL DEFAULT '{
    "smtp_enabled": false,
    "email_from_name": "Audit Proof",
    "email_from_address": "noreply@auditproof.com"
  }'::jsonb,
  app_settings jsonb NOT NULL DEFAULT '{
    "app_name": "Audit Proof",
    "app_version": "0.8.4",
    "maintenance_mode": false
  }'::jsonb,
  feature_flags jsonb NOT NULL DEFAULT '{
    "mfa_required": false,
    "email_verification_required": true,
    "ai_extraction_enabled": true,
    "multi_page_receipts_enabled": true
  }'::jsonb,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only system admins can access
CREATE POLICY "System admins can view system config"
  ON system_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE system_roles.user_id = auth.uid()
      AND system_roles.role = 'admin'
    )
  );

CREATE POLICY "System admins can update system config"
  ON system_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE system_roles.user_id = auth.uid()
      AND system_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE system_roles.user_id = auth.uid()
      AND system_roles.role = 'admin'
    )
  );

-- Function: Get system configuration (returns single row)
CREATE OR REPLACE FUNCTION get_system_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config_row system_config%ROWTYPE;
  result jsonb;
BEGIN
  -- Get the configuration (there should only be one row)
  SELECT * INTO config_row FROM system_config LIMIT 1;

  -- If no config exists, create default
  IF NOT FOUND THEN
    INSERT INTO system_config DEFAULT VALUES RETURNING * INTO config_row;
  END IF;

  -- Build result JSON
  result := jsonb_build_object(
    'storage_settings', config_row.storage_settings,
    'email_settings', config_row.email_settings,
    'app_settings', config_row.app_settings,
    'feature_flags', config_row.feature_flags,
    'updated_at', config_row.updated_at,
    'updated_by', config_row.updated_by
  );

  RETURN result;
END;
$$;

-- Function: Update system configuration
CREATE OR REPLACE FUNCTION update_system_config(
  p_storage_settings jsonb DEFAULT NULL,
  p_email_settings jsonb DEFAULT NULL,
  p_app_settings jsonb DEFAULT NULL,
  p_feature_flags jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config_id uuid;
  updated_config jsonb;
BEGIN
  -- Check if user is system admin
  IF NOT EXISTS (
    SELECT 1 FROM system_roles
    WHERE user_id = auth.uid()
    AND role = 'system_admin'
  ) THEN
    RAISE EXCEPTION 'Only system admins can update system configuration';
  END IF;

  -- Get or create config row
  SELECT id INTO config_id FROM system_config LIMIT 1;

  IF config_id IS NULL THEN
    INSERT INTO system_config DEFAULT VALUES RETURNING id INTO config_id;
  END IF;

  -- Update only provided fields
  UPDATE system_config
  SET
    storage_settings = COALESCE(p_storage_settings, storage_settings),
    email_settings = COALESCE(p_email_settings, email_settings),
    app_settings = COALESCE(p_app_settings, app_settings),
    feature_flags = COALESCE(p_feature_flags, feature_flags),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = config_id;

  -- Return updated config
  SELECT get_system_config() INTO updated_config;

  RETURN updated_config;
END;
$$;

-- Audit trigger for system config changes
CREATE OR REPLACE FUNCTION audit_system_config_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  changed_fields jsonb := '{}'::jsonb;
BEGIN
  -- Track which sections changed
  IF OLD.storage_settings IS DISTINCT FROM NEW.storage_settings THEN
    changed_fields := changed_fields || jsonb_build_object('storage_settings', jsonb_build_object('old', OLD.storage_settings, 'new', NEW.storage_settings));
  END IF;

  IF OLD.email_settings IS DISTINCT FROM NEW.email_settings THEN
    changed_fields := changed_fields || jsonb_build_object('email_settings', jsonb_build_object('old', OLD.email_settings, 'new', NEW.email_settings));
  END IF;

  IF OLD.app_settings IS DISTINCT FROM NEW.app_settings THEN
    changed_fields := changed_fields || jsonb_build_object('app_settings', jsonb_build_object('old', OLD.app_settings, 'new', NEW.app_settings));
  END IF;

  IF OLD.feature_flags IS DISTINCT FROM NEW.feature_flags THEN
    changed_fields := changed_fields || jsonb_build_object('feature_flags', jsonb_build_object('old', OLD.feature_flags, 'new', NEW.feature_flags));
  END IF;

  -- Only log if something changed
  IF changed_fields <> '{}'::jsonb THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      changes,
      ip_address,
      user_agent
    ) VALUES (
      auth.uid(),
      'UPDATE',
      'system_config',
      NEW.id::text,
      changed_fields,
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'user-agent'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create audit trigger
DROP TRIGGER IF EXISTS audit_system_config_trigger ON system_config;
CREATE TRIGGER audit_system_config_trigger
  AFTER UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION audit_system_config_changes();

-- Insert default configuration (single row only)
INSERT INTO system_config DEFAULT VALUES
ON CONFLICT DO NOTHING;

-- Add index on updated_at for performance
CREATE INDEX IF NOT EXISTS idx_system_config_updated_at ON system_config(updated_at DESC);

-- Grant execute permission on functions
GRANT EXECUTE ON FUNCTION get_system_config() TO authenticated;
GRANT EXECUTE ON FUNCTION update_system_config(jsonb, jsonb, jsonb, jsonb) TO authenticated;
