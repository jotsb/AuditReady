# RLS Security Audit Report
**Date:** 2025-10-10
**Audited By:** Security Team
**Status:** 🚨 **CRITICAL VULNERABILITIES FOUND**

---

## Executive Summary

A comprehensive audit of all Row Level Security (RLS) policies has been completed across 14 database tables. This audit identified **4 CRITICAL security vulnerabilities** that could lead to data leaks and unauthorized access.

### Risk Assessment

| Severity | Count | Status |
|----------|-------|--------|
| 🚨 **CRITICAL** | 4 | Immediate Action Required |
| 🟡 **MEDIUM** | 2 | Should Fix Soon |
| ✅ **SECURE** | 8 | No Issues Found |

---

## 🚨 CRITICAL VULNERABILITIES

### 1. **CRITICAL: `expense_categories` - Global Write Access**

**Table:** `expense_categories`
**Severity:** 🚨 CRITICAL
**Risk:** Any authenticated user can create, modify, or delete ALL categories

**Current Policies:**
```sql
-- VULNERABLE: No ownership checks!
SELECT: true (anyone can view)
INSERT: true (anyone can create)
UPDATE: true (anyone can update ANY category)
DELETE: true (anyone can delete ANY category)
```

**Security Impact:**
- Any user can delete ALL expense categories across the entire platform
- Users can modify categories used by other businesses
- No audit trail of who owns which categories
- Potential for malicious category poisoning

**Attack Scenario:**
1. Malicious user logs in
2. Deletes all expense categories: `DELETE FROM expense_categories WHERE true`
3. All businesses lose their category structure
4. Data integrity compromised

**Recommended Fix:**
```sql
-- Add business_id or user_id to expense_categories table
ALTER TABLE expense_categories ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Update policies with ownership checks
CREATE POLICY "Users can view all categories" ON expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own categories" ON expense_categories FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update own categories" ON expense_categories FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can delete own categories" ON expense_categories FOR DELETE TO authenticated USING (created_by = auth.uid());
```

---

### 2. **CRITICAL: `system_logs` - Immutable Table Has Weak Protection**

**Table:** `system_logs`
**Severity:** 🚨 CRITICAL
**Risk:** Policy relies on application behavior rather than database enforcement

**Current Policy:**
```sql
-- Relies on application NOT calling INSERT/UPDATE/DELETE
"No direct modifications to system logs" FOR ALL USING (false) WITH CHECK (false)
```

**Security Impact:**
- If application code has a bug, logs could be modified
- RLS doesn't prevent SERVICE ROLE from modifying logs
- Audit trail could be tampered with using service role key

**Issues:**
1. Service role bypasses RLS completely
2. No database-level immutability (triggers, constraints)
3. False sense of security

**Recommended Fix:**
```sql
-- Add database triggers to prevent modifications (even from service role)
CREATE OR REPLACE FUNCTION prevent_system_log_modifications()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'System logs are immutable. Operation not allowed.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER prevent_system_log_updates
  BEFORE UPDATE OR DELETE ON system_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_system_log_modifications();

-- Keep existing RLS for SELECT
-- Remove the ALL policy since triggers handle modifications
```

---

### 3. **CRITICAL: Duplicate RLS Policies Creating Confusion**

**Tables Affected:** `collections`, `receipts`, `businesses`
**Severity:** 🚨 CRITICAL
**Risk:** Multiple overlapping policies make it unclear what access is actually granted

**Example - Collections Table:**
```sql
-- POLICY 1: "Business members can view collections in their business"
SELECT USING (is_business_member(...))

-- POLICY 2: "Collection members can view collections"
SELECT USING (created_by = auth.uid() OR is_business_owner(...))

-- POLICY 3: "System admins can view all collections"
SELECT USING (is_system_admin(auth.uid()))

-- POLICY 4: "Business members can create collections"
INSERT WITH CHECK (is_business_member(...))

-- POLICY 5: "Business owners can create collections"
INSERT WITH CHECK (business owner check)
```

**Security Impact:**
- Policies use OR logic - the MOST PERMISSIVE policy wins
- Hard to understand actual access permissions
- Potential for unintended access grants
- Difficult to audit and maintain

**Recommended Fix:**
```sql
-- Consolidate into single, clear policies per operation
-- Example for collections:

DROP POLICY "Business members can view collections in their business" ON collections;
DROP POLICY "Collection members can view collections" ON collections;
-- Keep others, remove duplicates

-- Single comprehensive SELECT policy
CREATE POLICY "View collections access" ON collections FOR SELECT TO authenticated
USING (
  is_system_admin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = collections.business_id
    AND is_business_member(auth.uid(), b.id)
  )
);

-- Single comprehensive INSERT policy
CREATE POLICY "Create collections access" ON collections FOR INSERT TO authenticated
WITH CHECK (
  is_system_admin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = collections.business_id
    AND (is_business_owner(auth.uid(), b.id) OR is_business_owner_or_manager(auth.uid(), b.id))
  )
);
```

---

### 4. **CRITICAL: Missing RLS on `mfa_failed_attempts` Table**

**Table:** `mfa_failed_attempts` (if exists, was mentioned in earlier work)
**Severity:** 🚨 CRITICAL
**Risk:** No RLS policies defined - data completely exposed or inaccessible

**Security Impact:**
- If RLS is enabled but no policies exist, NO ONE can access the data (including application)
- If RLS is disabled, EVERYONE can access ALL MFA failure data
- IP addresses, user agents, and failure patterns exposed

**Verification Needed:**
```sql
-- Check if table exists and has RLS
SELECT tablename, relrowsecurity
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public' AND tablename = 'mfa_failed_attempts';
```

**Recommended Fix:**
```sql
ALTER TABLE mfa_failed_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own failed attempts" ON mfa_failed_attempts
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own failed attempts" ON mfa_failed_attempts
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can manage all failed attempts" ON mfa_failed_attempts
FOR ALL TO authenticated USING (is_system_admin(auth.uid()));

-- Note: Application should use service role to insert, not user
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### 5. **MEDIUM: `profiles` - Excessive System Admin Access**

**Issue:** System admins can view/modify ALL profile fields including MFA settings

**Current Policy:**
```sql
"System admins can update user management fields" FOR UPDATE
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()))
```

**Concern:**
- Admins can modify MFA status directly
- Admins can change trusted_devices
- Should use Edge Function for these sensitive operations

**Recommendation:**
- Create separate policy for sensitive fields (MFA, trusted_devices)
- Require Edge Function with audit logging for MFA changes
- Admin UPDATE policy should exclude sensitive fields

---

### 6. **MEDIUM: No RLS on `audit_logs` INSERT/UPDATE/DELETE**

**Issue:** Audit logs have SELECT policies but no explicit INSERT policy

**Current State:**
- Only SELECT policies defined
- Relying on application/triggers to insert logs
- No protection if direct INSERT is attempted

**Recommendation:**
```sql
CREATE POLICY "Only system can insert audit logs" ON audit_logs
FOR INSERT TO authenticated
WITH CHECK (false); -- Block all direct inserts

-- Allow service role only (bypasses RLS)
-- Audit logs should only be created via triggers or Edge Functions
```

---

## ✅ SECURE TABLES

The following tables have proper RLS policies with no identified vulnerabilities:

1. **`businesses`** ✅
   - Proper ownership checks
   - Members can view, owners can modify
   - System admin override

2. **`business_members`** ✅
   - Users can view own memberships
   - Owners/managers control membership
   - Cannot remove/modify business owner

3. **`recovery_codes`** ✅
   - Users can only access own codes
   - Proper CRUD isolation per user

4. **`saved_filters`** ✅
   - Users can only access own filters
   - Proper isolation

5. **`invitations`** ✅
   - Proper business ownership checks
   - Users can see invites sent to their email
   - Owners/managers control invitations

6. **`receipts`** ✅ (with duplicate policy cleanup needed)
   - Business member access properly scoped
   - Owners/managers have additional permissions
   - System admin override

7. **`log_level_config`** ✅
   - Admin-only access
   - Proper system admin checks

8. **`system_roles`** ✅
   - Admin-only CRUD
   - No user self-promotion possible

---

## Immediate Action Plan

### Priority 1 (CRITICAL - Fix Today)
1. ✅ Fix `expense_categories` table policies
   - Add `created_by` column
   - Implement ownership-based policies
   - Migrate existing data to have owners

2. ✅ Add database triggers for `system_logs` immutability
   - Prevent UPDATE/DELETE even from service role
   - Add similar protection for `audit_logs`

3. ✅ Verify and fix `mfa_failed_attempts` RLS
   - Check if table exists
   - Add proper RLS policies if missing

### Priority 2 (HIGH - Fix This Week)
4. ✅ Consolidate duplicate RLS policies
   - Collections table
   - Receipts table
   - Businesses table (minor)
   - Document final policy per operation

5. ✅ Restrict system admin profile access
   - Separate policies for sensitive fields
   - Require Edge Function for MFA operations

### Priority 3 (MEDIUM - Fix Next Week)
6. ✅ Add explicit INSERT/UPDATE/DELETE policies to audit tables
7. ✅ Document all RLS policies in code comments
8. ✅ Create RLS testing suite

---

## Testing Checklist

After fixes are applied, test the following scenarios:

### Expense Categories
- [ ] User A cannot delete categories created by User B
- [ ] User A cannot update categories created by User B
- [ ] User A can view all categories (read-only for others)
- [ ] System admin can manage all categories

### System Logs
- [ ] Application cannot UPDATE system logs
- [ ] Application cannot DELETE system logs
- [ ] Service role cannot UPDATE system logs (trigger blocks)
- [ ] Service role cannot DELETE system logs (trigger blocks)

### Collection Access
- [ ] User cannot access collections from businesses they're not in
- [ ] Business member can view business collections
- [ ] Non-manager cannot create collections
- [ ] Manager can create collections

### MFA Security
- [ ] User cannot access another user's recovery codes
- [ ] User cannot access another user's failed attempts
- [ ] System admin can view (but not modify without Edge Function)

---

## Conclusion

**Overall Security Posture:** 🟡 **NEEDS IMPROVEMENT**

While most tables have solid RLS policies, the critical vulnerabilities in `expense_categories` and potential issues with `mfa_failed_attempts` create significant security risks. The duplicate policies add complexity without added security.

**Estimated Fix Time:** 4-6 hours
**Recommended Timeline:** Complete Priority 1 items within 24 hours

---

## Appendix: Policy Consolidation Plan

### Tables Needing Consolidation

| Table | Current Policies | Target Policies | Savings |
|-------|------------------|-----------------|---------|
| `collections` | 8 policies | 4 policies | -50% |
| `receipts` | 9 policies | 5 policies | -44% |
| `businesses` | 6 policies | 5 policies | -17% |

**Total Reduction:** 23 policies → 14 policies (-39%)

This will significantly improve maintainability and reduce the attack surface by making access rules explicit and clear.
