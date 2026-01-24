# Business Creation RLS Error - Comprehensive Diagnostic Report

## Problem Statement

When a user tries to create a business during onboarding, they receive:
```
Error: new row violates row-level security policy for table "businesses"
HTTP 403 Forbidden
```

## What SHOULD Happen

1. User fills out business name in onboarding wizard
2. Frontend calls: `supabase.from('businesses').insert({ name, owner_id, created_by, currency, suspended })`
3. Database INSERT succeeds with these steps:
   - BEFORE INSERT trigger sets `created_by = auth.uid()` if NULL
   - Row is inserted into `businesses` table
   - AFTER INSERT trigger creates audit log entry
   - AFTER INSERT trigger creates owner membership in `business_members`
4. User proceeds to create collection
5. Onboarding completes successfully

## What IS Happening

INSERT transaction fails and rolls back with RLS policy error.

## Database Architecture

### Tables Involved
1. **businesses** - Main table for business entities
2. **business_members** - Junction table for user-business relationships
3. **audit_logs** - Audit trail for all operations
4. **profiles** - User profile data (linked via FK from businesses.owner_id)

### Triggers on businesses Table (INSERT)

**BEFORE INSERT:**
- `trigger_set_business_created_by` → Calls `set_business_created_by()` (SECURITY DEFINER)
  - Sets `created_by = auth.uid()` if NULL

**AFTER INSERT:**
- `audit_business_changes` → Calls `log_business_changes_with_delete()` (SECURITY DEFINER)
  - Calls `log_audit_event()` (SECURITY DEFINER)
  - Inserts into `audit_logs` table

- `on_business_created` → Calls `create_business_owner_membership()` (SECURITY DEFINER)
  - Inserts into `business_members` table

### Foreign Keys
- `businesses.owner_id` → `profiles.id` (CASCADE DELETE)
- `businesses.created_by` → `auth.users.id`

## RLS Policies Investigation

### businesses Table Policies

**INSERT Policy:**
```sql
CREATE POLICY "Users can create businesses"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- Allows all authenticated users
```
✅ **Status:** Correct - allows INSERT

**SELECT Policies:**
- "Business members can view their businesses" - PERMISSIVE
- "System admins can view all businesses" - PERMISSIVE
- "Block access to suspended businesses" - RESTRICTIVE

**UPDATE/DELETE:**
- Various owner/admin policies

### business_members Table Policies

**INSERT Policy:**
```sql
CREATE POLICY "Owners and managers can add members"
  ON business_members FOR INSERT
  TO authenticated
  WITH CHECK (is_system_admin(auth.uid()) OR is_business_owner_or_manager(auth.uid(), business_id));
```
✅ **Status:** Fixed - chicken-egg problem resolved

**RESTRICTIVE Policies (Fixed):**
- "Block select from suspended business members" - SELECT only
- "Block update to suspended business members" - UPDATE only
- "Block delete from suspended business members" - DELETE only
- ❌ Originally was FOR ALL (blocked INSERT) - **NOW FIXED**

### audit_logs Table Policies

**INSERT Policy:**
```sql
-- REMOVED in migration 20251103051000
-- Was: WITH CHECK (false) - blocked ALL inserts
```
✅ **Status:** Fixed - blocking policy removed

**SELECT Policies:**
- Users can view own logs
- Business owners/managers can view team logs
- System admins can view all logs

## Fixes Applied (In Order)

### Migration 1: `20251103040500_fix_business_insert_rls_policy.sql`
- **Attempted:** Modified businesses INSERT policy
- **Result:** Didn't work (wrong table)

### Migration 2: `20251103041243_allow_all_authenticated_business_creation.sql`
- **Attempted:** Split RESTRICTIVE policies on businesses
- **Result:** Didn't work (wrong table)

### Migration 3: `20251103041752_20251103042000_add_business_created_by_trigger.sql`
- **Added:** BEFORE INSERT trigger for `created_by` field
- **Result:** Good practice but not the blocker

### Migration 4: `20251103045000_simplify_business_insert_policy.sql`
- **Changed:** businesses INSERT WITH CHECK to `true`
- **Result:** Good but not the blocker

### Migration 5: `20251103050000_fix_business_members_restrictive_policy.sql`
- **Fixed:** Split RESTRICTIVE policy on business_members
- **Changed:** FOR ALL → separate FOR SELECT/UPDATE/DELETE
- **Reason:** RESTRICTIVE FOR ALL was blocking trigger INSERT
- **Result:** Should have fixed it but didn't

### Migration 6: `20251103051000_fix_audit_logs_insert_policy.sql` ⭐
- **Fixed:** Removed `WITH CHECK (false)` from audit_logs
- **Reason:** Was blocking SECURITY DEFINER trigger from logging
- **Result:** Should fix the issue

## Current State

### All SECURITY DEFINER Functions
✅ All trigger functions use SECURITY DEFINER
✅ Should bypass RLS for their operations

### All Blocking Policies Removed
✅ businesses: INSERT allows authenticated (WITH CHECK true)
✅ business_members: No RESTRICTIVE policy for INSERT
✅ audit_logs: No INSERT policy (SECURITY DEFINER bypasses RLS)

### Foreign Keys
✅ User has profile in profiles table
✅ User exists in auth.users table

## Remaining Possibilities

If business creation STILL fails after these fixes, the issue could be:

### 1. Supabase Cloud vs Code Mismatch
- Migrations applied to wrong database instance
- Need to verify connection string in `.env`
- Check if migrations list matches what's actually applied

### 2. Cached Policies
- Supabase might be caching old RLS policies
- May need to restart Supabase services
- Try: `SELECT pg_reload_conf();`

### 3. Hidden RESTRICTIVE Policies
Run this to find ALL RESTRICTIVE policies:
```sql
SELECT schemaname, tablename, policyname, cmd, qual::text
FROM pg_policies
WHERE permissive = 'RESTRICTIVE'
  AND schemaname = 'public'
ORDER BY tablename, cmd;
```

### 4. Function Execution Context
Even with SECURITY DEFINER, functions might not be executing as expected.
Test with:
```sql
-- As authenticated user
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"90a4731e-76e0-4734-bca8-86d56e8dbc6d"}';
INSERT INTO businesses (name, owner_id, created_by, currency)
VALUES ('Test Business', '90a4731e-76e0-4734-bca8-86d56e8dbc6d', '90a4731e-76e0-4734-bca8-86d56e8dbc6d', 'CAD');
```

### 5. Supabase REST API vs Direct SQL
The error comes from the REST API. Try using the service_role key instead of anon key to bypass RLS entirely:
```typescript
// In frontend code temporarily
const supabaseAdmin = createClient(url, SERVICE_ROLE_KEY);
await supabaseAdmin.from('businesses').insert(...);
```

### 6. Other Table Dependencies
Check if there are other tables with FK constraints that might be blocking:
```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'businesses'
  AND tc.constraint_type = 'FOREIGN KEY';
```

## Testing Checklist

- [ ] Clear browser cache and reload
- [ ] Verify user is actually authenticated (check JWT token)
- [ ] Check browser console for the exact request payload
- [ ] Verify migrations were applied: `SELECT * FROM supabase_migrations.schema_migrations;`
- [ ] Check Supabase dashboard logs for more detailed error
- [ ] Try creating business via SQL directly
- [ ] Check if RLS is actually enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'businesses';`

## Debug SQL Queries

### Check if RLS is enabled
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('businesses', 'business_members', 'audit_logs');
```

### Check all RESTRICTIVE policies
```sql
SELECT tablename, policyname, cmd, qual::text, with_check::text
FROM pg_policies
WHERE permissive = 'RESTRICTIVE'
  AND schemaname = 'public'
ORDER BY tablename, cmd;
```

### Test INSERT as service role (bypasses RLS)
```sql
-- Using service_role connection
INSERT INTO businesses (name, owner_id, created_by, currency, suspended)
VALUES ('Test Co', '90a4731e-76e0-4734-bca8-86d56e8dbc6d', '90a4731e-76e0-4734-bca8-86d56e8dbc6d', 'CAD', false)
RETURNING *;
```

### Check trigger execution
```sql
-- Enable trigger logging
SET log_statement = 'all';
-- Then try INSERT and check logs
```

## Contact Information for External Help

**Database:** Supabase (PostgreSQL 15.x)
**Framework:** React + TypeScript + Vite
**Auth:** Supabase Auth (JWT-based)
**User ID:** `90a4731e-76e0-4734-bca8-86d56e8dbc6d`
**User Email:** `contact@auditproof.ca`
**Environment:** Bolt.new Cloud (Supabase hosted instance)

## Files to Review

1. `/supabase/migrations/` - All migration files (especially recent ones)
2. `/src/components/onboarding/OnboardingWizard.tsx` - Frontend code
3. `/src/lib/supabase.ts` - Supabase client configuration
4. `/.env` - Database connection configuration

## Summary

This is a complex RLS policy cascade issue where:
1. User INSERT to businesses is allowed
2. Triggers fire to create related records
3. One of the dependent tables (business_members OR audit_logs) has blocking RLS
4. Transaction rolls back with misleading error message

**Latest fix (Migration 6)** removed the `WITH CHECK (false)` policy on audit_logs that was blocking the audit logging trigger. This SHOULD resolve the issue.

If not, the problem is likely at a different level (API, caching, or another hidden dependency).
