/*
  # Add Rate Limit Configuration Settings

  ## Overview
  Adds configurable rate limit settings to the system_config table so admins can
  adjust rate limits without code changes.

  ## Changes
  1. Add rate_limit_settings column to system_config
  2. Update get_system_config function to include rate limits
  3. Update update_system_config function to save rate limits

  ## Default Rate Limits
  - upload: 50 per 60 minutes
  - export: 5 per 60 minutes
  - email: 20 per 60 minutes
  - api_call: 10 per 60 minutes
  - login: 5 per 15 minutes
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_config' AND column_name = 'rate_limit_settings'
  ) THEN
    ALTER TABLE system_config ADD COLUMN rate_limit_settings jsonb DEFAULT '{
      "upload": {"max_attempts": 50, "window_minutes": 60},
      "export": {"max_attempts": 5, "window_minutes": 60},
      "email": {"max_attempts": 20, "window_minutes": 60},
      "api_call": {"max_attempts": 10, "window_minutes": 60},
      "login": {"max_attempts": 5, "window_minutes": 15}
    }'::jsonb;
  END IF;
END $$;

UPDATE system_config 
SET rate_limit_settings = '{
  "upload": {"max_attempts": 50, "window_minutes": 60},
  "export": {"max_attempts": 5, "window_minutes": 60},
  "email": {"max_attempts": 20, "window_minutes": 60},
  "api_call": {"max_attempts": 10, "window_minutes": 60},
  "login": {"max_attempts": 5, "window_minutes": 15}
}'::jsonb
WHERE rate_limit_settings IS NULL;

CREATE OR REPLACE FUNCTION get_system_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config system_config%ROWTYPE;
BEGIN
  SELECT * INTO v_config FROM system_config LIMIT 1;
  
  IF v_config IS NULL THEN
    RETURN jsonb_build_object(
      'storage_settings', jsonb_build_object(
        'max_file_size_mb', 10,
        'allowed_file_types', '["image/jpeg","image/png","image/webp","application/pdf"]'::jsonb,
        'default_storage_quota_gb', 10
      ),
      'email_settings', jsonb_build_object(
        'smtp_enabled', false,
        'email_from_name', 'Audit Proof',
        'email_from_address', 'noreply@auditproof.com'
      ),
      'app_settings', jsonb_build_object(
        'app_name', 'Audit Proof',
        'app_version', '0.8.4',
        'maintenance_mode', false
      ),
      'feature_flags', jsonb_build_object(
        'mfa_required', false,
        'email_verification_required', true,
        'ai_extraction_enabled', true,
        'multi_page_receipts_enabled', true
      ),
      'rate_limit_settings', jsonb_build_object(
        'upload', jsonb_build_object('max_attempts', 50, 'window_minutes', 60),
        'export', jsonb_build_object('max_attempts', 5, 'window_minutes', 60),
        'email', jsonb_build_object('max_attempts', 20, 'window_minutes', 60),
        'api_call', jsonb_build_object('max_attempts', 10, 'window_minutes', 60),
        'login', jsonb_build_object('max_attempts', 5, 'window_minutes', 15)
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'storage_settings', v_config.storage_settings,
    'email_settings', v_config.email_settings,
    'app_settings', v_config.app_settings,
    'feature_flags', v_config.feature_flags,
    'rate_limit_settings', COALESCE(v_config.rate_limit_settings, jsonb_build_object(
      'upload', jsonb_build_object('max_attempts', 50, 'window_minutes', 60),
      'export', jsonb_build_object('max_attempts', 5, 'window_minutes', 60),
      'email', jsonb_build_object('max_attempts', 20, 'window_minutes', 60),
      'api_call', jsonb_build_object('max_attempts', 10, 'window_minutes', 60),
      'login', jsonb_build_object('max_attempts', 5, 'window_minutes', 15)
    ))
  );
END;
$$;

CREATE OR REPLACE FUNCTION update_system_config(
  p_storage_settings jsonb DEFAULT NULL,
  p_email_settings jsonb DEFAULT NULL,
  p_app_settings jsonb DEFAULT NULL,
  p_feature_flags jsonb DEFAULT NULL,
  p_rate_limit_settings jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config_id uuid;
  v_admin_id uuid;
BEGIN
  IF NOT is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only system admins can update system configuration';
  END IF;

  v_admin_id := auth.uid();

  SELECT id INTO v_config_id FROM system_config LIMIT 1;

  IF v_config_id IS NULL THEN
    INSERT INTO system_config (
      storage_settings,
      email_settings,
      app_settings,
      feature_flags,
      rate_limit_settings,
      updated_by
    ) VALUES (
      COALESCE(p_storage_settings, '{"max_file_size_mb": 10, "allowed_file_types": ["image/jpeg","image/png","image/webp","application/pdf"], "default_storage_quota_gb": 10}'::jsonb),
      COALESCE(p_email_settings, '{"smtp_enabled": false, "email_from_name": "Audit Proof", "email_from_address": "noreply@auditproof.com"}'::jsonb),
      COALESCE(p_app_settings, '{"app_name": "Audit Proof", "app_version": "0.8.4", "maintenance_mode": false}'::jsonb),
      COALESCE(p_feature_flags, '{"mfa_required": false, "email_verification_required": true, "ai_extraction_enabled": true, "multi_page_receipts_enabled": true}'::jsonb),
      COALESCE(p_rate_limit_settings, '{"upload": {"max_attempts": 50, "window_minutes": 60}, "export": {"max_attempts": 5, "window_minutes": 60}, "email": {"max_attempts": 20, "window_minutes": 60}, "api_call": {"max_attempts": 10, "window_minutes": 60}, "login": {"max_attempts": 5, "window_minutes": 15}}'::jsonb),
      v_admin_id
    )
    RETURNING id INTO v_config_id;
  ELSE
    UPDATE system_config
    SET
      storage_settings = COALESCE(p_storage_settings, storage_settings),
      email_settings = COALESCE(p_email_settings, email_settings),
      app_settings = COALESCE(p_app_settings, app_settings),
      feature_flags = COALESCE(p_feature_flags, feature_flags),
      rate_limit_settings = COALESCE(p_rate_limit_settings, rate_limit_settings),
      updated_at = now(),
      updated_by = v_admin_id
    WHERE id = v_config_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Configuration updated successfully');
END;
$$;

CREATE OR REPLACE FUNCTION get_rate_limit_config(p_action_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
  v_action_config jsonb;
BEGIN
  SELECT rate_limit_settings INTO v_settings 
  FROM system_config 
  LIMIT 1;

  IF v_settings IS NULL THEN
    v_settings := '{
      "upload": {"max_attempts": 50, "window_minutes": 60},
      "export": {"max_attempts": 5, "window_minutes": 60},
      "email": {"max_attempts": 20, "window_minutes": 60},
      "api_call": {"max_attempts": 10, "window_minutes": 60},
      "login": {"max_attempts": 5, "window_minutes": 15}
    }'::jsonb;
  END IF;

  v_action_config := v_settings->p_action_type;

  IF v_action_config IS NULL THEN
    RETURN jsonb_build_object('max_attempts', 10, 'window_minutes', 60);
  END IF;

  RETURN v_action_config;
END;
$$;

GRANT EXECUTE ON FUNCTION get_rate_limit_config TO authenticated, anon;
