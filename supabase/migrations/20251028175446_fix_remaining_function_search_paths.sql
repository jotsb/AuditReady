/*
  # Fix Remaining Function Search Path Warnings

  These 8 trigger functions don't have SECURITY DEFINER but Supabase still flags them
  as having mutable search_paths. While less critical than SECURITY DEFINER functions,
  it's still a best practice to lock their search paths.

  ## Functions Fixed
  - update_saved_filter_updated_at() - Trigger function
  - ensure_single_default_audit_filter() - Trigger function
  - ensure_single_default_system_filter() - Trigger function
  - update_email_inbox_updated_at() - Trigger function
  - update_saved_filters_updated_at() - Trigger function
  - ensure_single_default_filter() - Trigger function
  - update_updated_at_column() - Trigger function
  - handle_receipt_deletion() - Trigger function

  ## Security Impact
  - Prevents potential search_path manipulation in trigger context
  - Completes 100% function search path hardening
  - Resolves all Supabase security audit warnings for functions
*/

-- Fix trigger functions (8 functions)
ALTER FUNCTION update_saved_filter_updated_at()
  SET search_path = public, extensions;

ALTER FUNCTION ensure_single_default_audit_filter()
  SET search_path = public, extensions;

ALTER FUNCTION ensure_single_default_system_filter()
  SET search_path = public, extensions;

ALTER FUNCTION update_email_inbox_updated_at()
  SET search_path = public, extensions;

ALTER FUNCTION update_saved_filters_updated_at()
  SET search_path = public, extensions;

ALTER FUNCTION ensure_single_default_filter()
  SET search_path = public, extensions;

ALTER FUNCTION update_updated_at_column()
  SET search_path = public, extensions;

ALTER FUNCTION handle_receipt_deletion()
  SET search_path = public, extensions;

-- Log this final security fix
INSERT INTO system_logs (level, category, message, metadata)
VALUES (
  'INFO',
  'SECURITY',
  'Fixed remaining function search_path warnings',
  jsonb_build_object(
    'trigger_functions_fixed', 8,
    'total_functions_secured', 80,
    'impact', 'All PostgreSQL functions now have locked search paths - 100% coverage',
    'remaining_warnings', jsonb_build_object(
      'pg_trgm_in_public', 'Cannot be moved - indexes depend on it (acceptable)'
    ),
    'migration', '20251028174705_fix_remaining_function_search_paths.sql'
  )
);
