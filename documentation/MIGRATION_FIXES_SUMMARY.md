# Migration Fixes Summary

## Overview
Fixed multiple migration files to ensure they are fully idempotent (can be run multiple times without errors).

## Problems Identified

### 1. **mask_ip Function Overload Issue** (20251015120000)
**Problem:** PostgreSQL couldn't create overloaded functions where one calls the other by the same name.
**Error:** `ERROR: function name "mask_ip" is not unique`

**Solution:** Used a layered approach:
- Created base functions with unique names: `mask_ip_text(text)` and `mask_ip_inet(inet)`
- Created overloaded wrapper functions `mask_ip(text)` and `mask_ip(inet)` that call the base functions
- This eliminates parser ambiguity while maintaining backward compatibility

### 2. **Wrong Table/Column References** (20251016050000)
**Problems:**
- Referenced non-existent `business_users` table (should be `business_members`)
- Referenced non-existent `c.user_id` column (should be `c.created_by`)

**Solution:** Updated all references to use correct table and column names throughout the migration.

### 3. **Wrong System Roles Check** (20251026000000)
**Problem:** Checked for `admin = true` but `system_roles` table uses `role = 'admin'`
**Error:** `ERROR: column "admin" does not exist`

**Solution:** Changed all `admin = true` checks to `role = 'admin'`

### 4. **Non-Idempotent Policies and Triggers** (20251026000000)
**Problems:**
- Policies created without DROP IF EXISTS first
- Trigger created without DROP IF EXISTS first
- Migration would fail on second run with "already exists" errors

**Solution:** Added DROP IF EXISTS before all CREATE POLICY and CREATE TRIGGER statements:
- 6 policies now have DROP statements
- 1 trigger now has DROP statement

### 5. **Incomplete Function Signatures in ALTER Statements** (20251028000000)
**Problem:** ALTER FUNCTION statements didn't include parameter types, causing PostgreSQL to fail finding the functions.
**Errors:** 22 functions reported as "does not exist" including:
- `is_system_admin()` exists as `is_system_admin(user_id uuid)`
- `get_business_role(uuid)` exists as `get_business_role(user_id uuid, business_id uuid)`
- `check_rate_limit(text, text, int, interval)` exists with full parameter names

**Root Cause:** PostgreSQL requires exact function signatures (name + parameter types) to identify functions.

**Solution:**
- Queried database to get exact signatures of all 54 SECURITY DEFINER functions
- Replaced all ALTER FUNCTION statements with correct full signatures
- Updated from incorrect signatures like `is_system_admin()` to `is_system_admin(user_id uuid)`
- Updated from shorthand types like `int` to proper types like `integer`
- Updated from missing parameters to complete signatures

### 6. **Functions Not Created in Migrations** (20251028000000)
**Problem:** Two functions (`get_receipts_with_thumbnails`, `log_security_event`) exist in the current database but are NOT created in any migration file.
**Errors:**
- `ERROR: function get_receipts_with_thumbnails(uuid, integer, integer) does not exist`
- `ERROR: function log_security_event(text, text, jsonb) does not exist`

**Root Cause:** Functions exist in production/current database but were never added to migration files, likely created manually or in deleted migrations.

**Solution:**
- Wrapped these two ALTER FUNCTION statements in conditional DO blocks
- Check if function exists before attempting to ALTER
- Migration now works both on fresh databases (skips these) and existing databases (alters them)

## Verification Results

All migrations now follow PostgreSQL best practices for idempotency:

✅ **Tables:** All use `CREATE TABLE IF NOT EXISTS`
✅ **Indexes:** All use `CREATE INDEX IF NOT EXISTS`
✅ **Functions:** All use `CREATE OR REPLACE FUNCTION`
✅ **Policies:** All have `DROP POLICY IF EXISTS` before `CREATE POLICY`
✅ **Triggers:** All have `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`

## Files Modified

1. `20251015120000_security_hardening_phase_a.sql`
   - Fixed mask_ip function overloading
   - Added layered function approach

2. `20251016050000_add_dashboard_analytics_table.sql`
   - Changed `business_users` → `business_members`
   - Changed `c.user_id` → `c.created_by`

3. `20251026000000_add_duplicate_detection_and_admin_features.sql`
   - Changed `admin = true` → `role = 'admin'` (7 occurrences)
   - Added DROP statements for 6 policies
   - Added DROP statement for 1 trigger

4. `20251028000000_fix_database_security_warnings.sql`
   - Fixed 54 ALTER FUNCTION statements with complete signatures
   - Corrected parameter type names (int → integer, timestamptz → timestamp with time zone)
   - Added full parameter names and types for all functions

## Testing

All migrations can now be run multiple times without errors. The verification script confirms:
- 0 non-idempotent table creates
- 0 non-idempotent index creates
- 0 non-idempotent function creates
- 6/6 policies have DROP statements
- 1/1 triggers have DROP statements

## Migration Best Practices for Future

### Always Use:
```sql
-- Tables
CREATE TABLE IF NOT EXISTS table_name ...

-- Indexes
CREATE INDEX IF NOT EXISTS idx_name ...

-- Functions
CREATE OR REPLACE FUNCTION func_name() ...

-- Policies (no IF NOT EXISTS support)
DROP POLICY IF EXISTS "policy_name" ON table_name;
CREATE POLICY "policy_name" ...

-- Triggers (no IF NOT EXISTS support)
DROP TRIGGER IF EXISTS trigger_name ON table_name;
CREATE TRIGGER trigger_name ...
```

### Function Overloading:
When creating overloaded functions where one calls another:
1. Use unique names for base implementations
2. Create thin wrappers for the overloaded interface
3. Avoid direct recursive calls between same-named overloads

### Schema References:
1. Always verify table names exist in the schema
2. Always verify column names exist in referenced tables
3. Check enum types and their valid values
4. Use `information_schema` or `pg_catalog` to verify before writing migrations

### ALTER FUNCTION Requirements:
When altering functions, you MUST include the complete function signature:
```sql
-- WRONG - Missing parameters
ALTER FUNCTION is_system_admin() SET search_path = public;

-- CORRECT - Full signature with parameter names and types
ALTER FUNCTION is_system_admin(user_id uuid) SET search_path = public;

-- Query to get correct signatures:
SELECT
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prokind = 'f';
```

## Related Documentation
- `MASK_IP_OVERLOAD_ISSUE.md` - Detailed analysis of function overloading problem
- `MASK_IP_SOLUTION.md` - Complete solution for mask_ip functions
