/*
  # Complete Rollback of Phase B Security

  1. Summary
    Completely removes all Phase B security features:
    - Signed URL management tables
    - Rate limiting tables and functions
    - Suspicious activity detection
    - User activity patterns
    - Security metrics and analytics
    - All related functions, views, indexes

  2. Changes
    - Drop all Phase B tables
    - Drop all Phase B functions
    - Drop all Phase B views
    - Drop all Phase B policies
    - Drop all Phase B indexes
*/

-- ============================================================================
-- DROP VIEWS
-- ============================================================================
DROP VIEW IF EXISTS security_metrics_summary CASCADE;
DROP VIEW IF EXISTS anomaly_summary CASCADE;

-- ============================================================================
-- DROP FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS generate_tracked_signed_url(text, integer) CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_signed_urls() CASCADE;
DROP FUNCTION IF EXISTS check_rate_limit(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS block_ip(inet, text, integer) CASCADE;
DROP FUNCTION IF EXISTS unblock_ip(inet) CASCADE;
DROP FUNCTION IF EXISTS detect_login_anomaly(uuid, inet, text) CASCADE;
DROP FUNCTION IF EXISTS update_user_activity_pattern(uuid, text, jsonb) CASCADE;

-- ============================================================================
-- DROP TABLES (CASCADE to remove all dependencies)
-- ============================================================================
DROP TABLE IF EXISTS signed_url_requests CASCADE;
DROP TABLE IF EXISTS rate_limit_config CASCADE;
DROP TABLE IF EXISTS user_rate_limit_overrides CASCADE;
DROP TABLE IF EXISTS blocked_ips CASCADE;
DROP TABLE IF EXISTS user_activity_patterns CASCADE;
DROP TABLE IF EXISTS detected_anomalies CASCADE;
DROP TABLE IF EXISTS security_events CASCADE;
