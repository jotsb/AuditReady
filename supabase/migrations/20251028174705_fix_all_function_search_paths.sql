/*
  # Fix All Function Search Path Security Warnings

  This migration fixes all 70 SECURITY DEFINER functions identified by Supabase's security audit.

  ## Security Impact
  - Prevents search_path hijacking attacks on privileged functions
  - All SECURITY DEFINER functions now have locked search paths
  - Reduces attack surface for privilege escalation

  ## What's Fixed
  - 70 functions now have `SET search_path = public, extensions`
  - Materialized view permissions restricted
  - System log entry created for audit trail

  ## Notes
  - pg_trgm extension remains in public schema (indexes depend on it - acceptable)
  - Materialized views don't support RLS (access controlled at application layer)
*/

-- Fix all 70 SECURITY DEFINER functions
ALTER FUNCTION admin_reset_user_mfa(target_user_id uuid, admin_user_id uuid, reset_reason text) SET search_path = public, extensions;
ALTER FUNCTION audit_account_lockouts() SET search_path = public, extensions;
ALTER FUNCTION audit_business_admin_changes() SET search_path = public, extensions;
ALTER FUNCTION audit_email_receipt_changes() SET search_path = public, extensions;
ALTER FUNCTION audit_receipt_soft_delete() SET search_path = public, extensions;
ALTER FUNCTION audit_system_config_changes() SET search_path = public, extensions;
ALTER FUNCTION calculate_business_storage(business_id_param uuid) SET search_path = public, extensions;
ALTER FUNCTION check_account_lockout(p_email text) SET search_path = public, extensions;
ALTER FUNCTION check_rate_limit(p_identifier text, p_action_type text, p_max_attempts integer, p_window_minutes integer) SET search_path = public, extensions;
ALTER FUNCTION check_storage_limit(business_id_param uuid) SET search_path = public, extensions;
ALTER FUNCTION check_user_exists(user_email text) SET search_path = public, extensions;
ALTER FUNCTION check_user_mfa_status(check_user_id uuid) SET search_path = public, extensions;
ALTER FUNCTION cleanup_expired_exports() SET search_path = public, extensions;
ALTER FUNCTION cleanup_expired_recovery_codes() SET search_path = public, extensions;
ALTER FUNCTION cleanup_old_rate_limits() SET search_path = public, extensions;
ALTER FUNCTION create_business_owner_membership() SET search_path = public, extensions;
ALTER FUNCTION delete_storage_object(bucket_name text, object_path text) SET search_path = public, extensions;
ALTER FUNCTION get_audit_stats(p_start_date timestamp with time zone, p_end_date timestamp with time zone) SET search_path = public, extensions;
ALTER FUNCTION get_business_id_from_collection(collection_id_param uuid) SET search_path = public, extensions;
ALTER FUNCTION get_business_role(user_id uuid, business_id uuid) SET search_path = public, extensions;
ALTER FUNCTION get_parent_receipt(receipt_uuid uuid) SET search_path = public, extensions;
ALTER FUNCTION get_receipt_pages(receipt_uuid uuid) SET search_path = public, extensions;
ALTER FUNCTION get_receipts_with_thumbnails(p_collection_id uuid, p_offset integer, p_limit integer) SET search_path = public, extensions;
ALTER FUNCTION get_system_config() SET search_path = public, extensions;
ALTER FUNCTION get_user_email(user_id uuid) SET search_path = public, extensions;
ALTER FUNCTION is_business_member(user_id uuid, business_id uuid) SET search_path = public, extensions;
ALTER FUNCTION is_business_owner(user_id uuid, business_id uuid) SET search_path = public, extensions;
ALTER FUNCTION is_business_owner_or_manager(user_id uuid, business_id uuid) SET search_path = public, extensions;
ALTER FUNCTION is_business_soft_deleted(business_id_param uuid) SET search_path = public, extensions;
ALTER FUNCTION is_business_suspended(business_id_param uuid) SET search_path = public, extensions;
ALTER FUNCTION is_system_admin(user_id uuid) SET search_path = public, extensions;
ALTER FUNCTION is_technical_support(user_id uuid) SET search_path = public, extensions;
ALTER FUNCTION log_audit_event(p_action text, p_resource_type text, p_resource_id uuid, p_details jsonb, p_snapshot_before jsonb, p_snapshot_after jsonb, p_status text, p_error_message text, p_execution_time_ms integer) SET search_path = public, extensions;
ALTER FUNCTION log_auth_event(p_event_type text, p_user_id uuid, p_success boolean, p_metadata jsonb) SET search_path = public, extensions;
ALTER FUNCTION log_business_action() SET search_path = public, extensions;
ALTER FUNCTION log_business_changes_enhanced() SET search_path = public, extensions;
ALTER FUNCTION log_business_changes_with_delete() SET search_path = public, extensions;
ALTER FUNCTION log_business_member_changes() SET search_path = public, extensions;
ALTER FUNCTION log_collection_action() SET search_path = public, extensions;
ALTER FUNCTION log_collection_changes_enhanced() SET search_path = public, extensions;
ALTER FUNCTION log_collection_member_changes() SET search_path = public, extensions;
ALTER FUNCTION log_expense_category_changes() SET search_path = public, extensions;
ALTER FUNCTION log_failed_operation(p_action text, p_resource_type text, p_resource_id uuid, p_error_message text, p_details jsonb) SET search_path = public, extensions;
ALTER FUNCTION log_invitation_changes() SET search_path = public, extensions;
ALTER FUNCTION log_log_level_config_changes() SET search_path = public, extensions;
ALTER FUNCTION log_performance_event(p_operation text, p_execution_time_ms integer, p_metadata jsonb) SET search_path = public, extensions;
ALTER FUNCTION log_permission_denied(p_action text, p_resource_type text, p_resource_id uuid, p_reason text) SET search_path = public, extensions;
ALTER FUNCTION log_profile_changes() SET search_path = public, extensions;
ALTER FUNCTION log_receipt_approval_changes() SET search_path = public, extensions;
ALTER FUNCTION log_receipt_delete() SET search_path = public, extensions;
ALTER FUNCTION log_receipt_delete_enhanced() SET search_path = public, extensions;
ALTER FUNCTION log_receipt_insert() SET search_path = public, extensions;
ALTER FUNCTION log_receipt_insert_enhanced() SET search_path = public, extensions;
ALTER FUNCTION log_receipt_update() SET search_path = public, extensions;
ALTER FUNCTION log_receipt_update_enhanced() SET search_path = public, extensions;
ALTER FUNCTION log_recovery_code_changes() SET search_path = public, extensions;
ALTER FUNCTION log_security_event(p_event_type text, p_severity text, p_details jsonb) SET search_path = public, extensions;
ALTER FUNCTION log_system_event(p_level text, p_category text, p_message text, p_metadata jsonb, p_user_id uuid, p_session_id text, p_ip_address inet, p_user_agent text, p_stack_trace text, p_execution_time_ms integer) SET search_path = public, extensions;
ALTER FUNCTION log_system_role_changes() SET search_path = public, extensions;
ALTER FUNCTION prevent_audit_log_modifications() SET search_path = public, extensions;
ALTER FUNCTION prevent_system_log_modifications() SET search_path = public, extensions;
ALTER FUNCTION record_failed_login(p_email text, p_ip_address inet, p_user_agent text, p_failure_reason text) SET search_path = public, extensions;
ALTER FUNCTION refresh_audit_logs_summary() SET search_path = public, extensions;
ALTER FUNCTION scan_failed_extractions() SET search_path = public, extensions;
ALTER FUNCTION scan_orphaned_files() SET search_path = public, extensions;
ALTER FUNCTION scan_soft_deleted_receipts() SET search_path = public, extensions;
ALTER FUNCTION search_audit_logs(p_search_query text, p_limit integer) SET search_path = public, extensions;
ALTER FUNCTION send_invitation_email_webhook() SET search_path = public, extensions;
ALTER FUNCTION should_log_event(p_category text, p_level text) SET search_path = public, extensions;
ALTER FUNCTION sync_user_email_to_profile() SET search_path = public, extensions;
ALTER FUNCTION unlock_account(p_email text, p_unlock_reason text) SET search_path = public, extensions;
ALTER FUNCTION update_system_config(p_storage_settings jsonb, p_email_settings jsonb, p_app_settings jsonb, p_feature_flags jsonb) SET search_path = public, extensions;

-- Secure materialized view - revoke public access
REVOKE ALL ON public.audit_logs_summary FROM anon;
REVOKE ALL ON public.audit_logs_summary FROM authenticated;
GRANT SELECT ON public.audit_logs_summary TO postgres;
GRANT SELECT ON public.audit_logs_summary TO service_role;

-- Log this security fix
INSERT INTO system_logs (level, category, message, metadata)
VALUES (
  'INFO',
  'SECURITY',
  'Database security audit warnings resolved',
  jsonb_build_object(
    'functions_fixed', 70,
    'materialized_view_secured', true,
    'impact', 'All SECURITY DEFINER functions now have locked search paths, preventing privilege escalation attacks',
    'remaining_warnings', jsonb_build_object(
      'pg_trgm_in_public', 'Acceptable - indexes depend on it',
      'materialized_view', 'Access controlled at application layer'
    ),
    'migration', '20251028000002_fix_all_function_search_paths.sql'
  )
);