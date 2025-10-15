/*
  # Rollback Phase B Security Changes

  1. Summary
    Removes Phase B advanced security features that are causing issues:
    - Removes brute force protection triggers
    - Removes suspicious activity detection
    - Removes advanced rate limiting
    - Removes image metadata stripping functions
    - Removes advanced monitoring

  2. Changes
    - Drop Phase B functions
    - Drop Phase B triggers
    - Drop Phase B policies
*/

-- Drop brute force protection
DROP TRIGGER IF EXISTS check_brute_force_attempts ON auth.audit_log_entries;
DROP FUNCTION IF EXISTS check_brute_force_attempts() CASCADE;

-- Drop suspicious activity detection
DROP TRIGGER IF EXISTS detect_suspicious_activity_trigger ON audit_logs;
DROP FUNCTION IF EXISTS detect_suspicious_activity() CASCADE;

-- Drop advanced rate limiting
DROP TABLE IF EXISTS rate_limit_windows CASCADE;
DROP FUNCTION IF EXISTS check_advanced_rate_limit(TEXT, TEXT, INTEGER, INTEGER) CASCADE;

-- Drop image security functions
DROP FUNCTION IF EXISTS strip_image_metadata(BYTEA) CASCADE;
DROP FUNCTION IF EXISTS validate_image_content(BYTEA) CASCADE;

-- Drop monitoring functions
DROP FUNCTION IF EXISTS monitor_failed_logins() CASCADE;
DROP FUNCTION IF EXISTS get_security_alerts(TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;

-- Drop security event logs if created
DROP TABLE IF EXISTS security_events CASCADE;
