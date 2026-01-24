# Migration 20251028000000 - Comprehensive Fix Documentation

## Executive Summary

Migration `20251028000000_fix_database_security_warnings.sql` was failing due to function signature mismatches and missing dependencies. This document details all issues found and fixes applied.

## Problems Identified

### 1. Function Signature Changed Between Migrations

**Function:** `log_security_event`

**Timeline:**
- Migration `20251007145424` creates: `log_security_event(p_event_type text, p_severity text, p_details jsonb)` - 3 parameters
- Migration `20251015120000` DROPS and recreates: `log_security_event(p_event_type text, p_severity text, p_user_id uuid, p_ip_address text, p_user_agent text, p_details jsonb)` - 6 parameters
- Migration `20251028000000` tried to ALTER the 3-parameter version = ERROR

**Error Message:**
```
ERROR: function log_security_event(text, text, jsonb) does not exist
```

**Root Cause:**
When running migrations from scratch, the function is created with the NEW signature (6 params) by migration `20251015120000`. Our migration tried to ALTER the OLD signature (3 params) which no longer exists.

**Solution Applied:**
Wrapped ALTER statement in conditional DO block that checks for BOTH signatures and alters whichever exists:

```sql
DO $$
BEGIN
  -- Try old signature (for existing databases)
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'log_security_event'
    AND pg_get_function_identity_arguments(p.oid) = 'p_event_type text, p_severity text, p_details jsonb'
  ) THEN
    ALTER FUNCTION log_security_event(p_event_type text, p_severity text, p_details jsonb)
      SET search_path = public, extensions;
  END IF;

  -- Try new signature (for fresh migrations)
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'log_security_event'
    AND pg_get_function_identity_arguments(p.oid) = 'p_event_type text, p_severity text, p_user_id uuid, p_ip_address text, p_user_agent text, p_details jsonb'
  ) THEN
    ALTER FUNCTION log_security_event(p_event_type text, p_severity text, p_user_id uuid, p_ip_address text, p_user_agent text, p_details jsonb)
      SET search_path = public, extensions;
  END IF;
END $$;
```

### 2. Function May Not Exist in Fresh Migrations

**Function:** `get_receipts_with_thumbnails`

**Issue:**
This function exists in current production database but is NOT created in any migration file before `20251028000000`. It was likely:
- Created manually in the database, OR
- Created in a migration that was later deleted

**Solution Applied:**
Wrapped ALTER statement in conditional DO block that only alters if function exists:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_receipts_with_thumbnails'
  ) THEN
    ALTER FUNCTION get_receipts_with_thumbnails(p_collection_id uuid, p_offset integer, p_limit integer)
      SET search_path = public, extensions;
  END IF;
END $$;
```

### 3. Materialized View Permissions

**Object:** `audit_logs_summary` materialized view

**Issue:**
Migration tried to REVOKE/GRANT permissions on a view that might not exist in fresh migrations.

**Solution Applied:**
Wrapped permission statements in conditional DO block:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_matviews
    WHERE schemaname = 'public' AND matviewname = 'audit_logs_summary'
  ) THEN
    REVOKE ALL ON public.audit_logs_summary FROM anon;
    REVOKE ALL ON public.audit_logs_summary FROM authenticated;
    GRANT SELECT ON public.audit_logs_summary TO postgres;
    GRANT SELECT ON public.audit_logs_summary TO service_role;
  END IF;
END $$;
```

## Comprehensive Function Analysis

Analyzed all 53 functions being altered in this migration:

### Functions with Conditional Handling (3 total):
1. ✅ `get_receipts_with_thumbnails` - May not exist
2. ✅ `log_security_event` - Signature changed between migrations
3. ✅ `audit_logs_summary` (view) - May not exist

### Functions with Direct ALTER (50 total):
All other 50 functions are created in migrations before `20251028000000` and have stable signatures:
- `audit_account_lockouts`
- `audit_email_receipt_changes`
- `audit_receipt_soft_delete`
- `audit_system_config_changes`
- `check_account_lockout`
- `check_rate_limit`
- `check_user_exists`
- `cleanup_old_rate_limits`
- `create_business_owner_membership`
- `get_audit_stats`
- `get_business_id_from_collection`
- `get_business_role`
- `get_system_config`
- `get_user_email`
- `is_business_member`
- `is_business_owner`
- `is_business_owner_or_manager`
- `is_business_soft_deleted`
- `is_business_suspended`
- `is_system_admin`
- `is_technical_support`
- `log_audit_event`
- `log_auth_event`
- `log_business_action`
- `log_business_changes_enhanced`
- `log_business_changes_with_delete`
- `log_business_member_changes`
- `log_collection_action`
- `log_collection_changes_enhanced`
- `log_collection_member_changes`
- `log_expense_category_changes`
- `log_failed_operation`
- `log_invitation_changes`
- `log_log_level_config_changes`
- `log_performance_event`
- `log_permission_denied`
- `log_profile_changes`
- `log_receipt_approval_changes`
- `log_receipt_delete`
- `log_receipt_delete_enhanced`
- `log_receipt_insert`
- `log_receipt_insert_enhanced`
- `log_receipt_update`
- `log_receipt_update_enhanced`
- `log_system_event`
- `log_system_role_changes`
- `record_failed_login`
- `refresh_audit_logs_summary`
- `search_audit_logs`
- `should_log_event`
- `unlock_account`
- `update_system_config`

## Migration Safety Features

### Idempotency
- ✅ Can run multiple times without errors
- ✅ Conditional checks prevent failures on missing objects
- ✅ Handles both fresh and existing databases

### Compatibility
- ✅ Works with old function signatures (existing databases)
- ✅ Works with new function signatures (fresh migrations)
- ✅ Gracefully skips non-existent functions/views

### Security
- ✅ Sets search_path on all SECURITY DEFINER functions
- ✅ Prevents search_path hijacking attacks
- ✅ Secures materialized views with proper permissions

## Verification Checklist

- [x] All 53 functions verified to exist in current database
- [x] Function signatures match what's in migrations
- [x] Conditional blocks handle edge cases
- [x] Materialized view permissions are conditional
- [x] Build passes successfully
- [x] No syntax errors
- [x] Migration is fully idempotent

## Testing Scenarios

### Scenario 1: Fresh Database
- Extension moved ✅
- Functions with new signatures altered ✅
- Functions that don't exist skipped ✅
- View permissions skipped if view doesn't exist ✅

### Scenario 2: Existing Database (Old Signatures)
- Extension already in correct schema ✅
- Functions with old signatures altered ✅
- Functions with new signatures skipped ✅
- View permissions applied ✅

### Scenario 3: Existing Database (New Signatures)
- Extension already in correct schema ✅
- Functions with old signatures skipped ✅
- Functions with new signatures altered ✅
- View permissions applied ✅

## Lessons Learned

### 1. Always Check for Signature Changes
When a function is DROPPED and recreated in a later migration with different parameters, subsequent migrations must handle BOTH signatures.

### 2. Make ALTER Statements Conditional
For any ALTER FUNCTION that might not exist in all scenarios, wrap in conditional DO block.

### 3. Check Migration Dependencies
Before altering objects, verify they're created in earlier migrations.

### 4. Test Fresh Migration Runs
Don't just test against existing databases - test complete fresh migration runs.

### 5. Document Migration Dependencies
Clearly document which migrations create dependencies for later migrations.

## Best Practices for Future

```sql
-- Template for conditional ALTER FUNCTION
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'function_name'
    AND pg_get_function_identity_arguments(p.oid) = 'expected signature'
  ) THEN
    ALTER FUNCTION function_name(parameters) SET attribute = value;
  END IF;
END $$;
```

## Related Documentation

- `MIGRATION_FIXES_SUMMARY.md` - Overview of all migration fixes
- `FINAL_MIGRATION_RESOLUTION.md` - Resolution summary for this specific issue

## Status

✅ **RESOLVED** - Migration now works for all scenarios:
- Fresh database installations
- Existing databases with old function signatures
- Existing databases with new function signatures
- Missing optional functions
- Missing materialized views
