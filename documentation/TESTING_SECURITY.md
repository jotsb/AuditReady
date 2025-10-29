# Security Testing Guide

This guide walks you through testing all the security features we just implemented.

## Prerequisites

1. Make sure your app is running: `npm run dev`
2. Have access to Supabase Dashboard
3. Have a test email account for creating test users

---

## Test 1: Login Rate Limiting & Account Lockout

### Objective
Verify that after 5 failed login attempts, the account gets locked for 30 minutes.

### Steps

1. **Start Fresh**
   - Use an email that you know exists in the system (or create a test user)
   - Example: `test@example.com`

2. **Attempt Failed Logins**
   - Go to the login page
   - Enter the correct email but WRONG password
   - Click "Sign In"
   - Repeat this 5 times

3. **Expected Behavior**
   - Attempts 1-4: "Invalid login credentials" error
   - Attempt 5: Account should be locked
   - Attempt 6+: "Account temporarily locked due to multiple failed login attempts. Please try again in X minutes."

4. **Verify in Database**
   ```sql
   -- Check failed login attempts
   SELECT * FROM failed_login_attempts
   WHERE email = 'test@example.com'
   ORDER BY attempt_time DESC
   LIMIT 10;

   -- Check account lockout
   SELECT * FROM account_lockouts
   WHERE email = 'test@example.com'
   AND is_active = true;
   ```

5. **Expected Database State**
   - `failed_login_attempts`: Should have 5+ entries
   - `account_lockouts`: Should have 1 active entry with:
     - `locked_at`: Current timestamp
     - `locked_until`: ~30 minutes from now
     - `attempts_count`: 5 or more
     - `is_active`: true

### Testing Admin Unlock

1. **As System Admin**, unlock the account:
   ```sql
   SELECT unlock_account('test@example.com', 'Testing unlock functionality');
   ```

2. **Verify**
   - Try logging in with correct password
   - Should work immediately
   - Check database:
   ```sql
   SELECT * FROM account_lockouts
   WHERE email = 'test@example.com'
   ORDER BY locked_at DESC
   LIMIT 1;
   ```
   - `is_active` should be `false`
   - `unlocked_at` should be set
   - `unlock_reason` should be "Testing unlock functionality"

---

## Test 2: Receipt Upload Rate Limiting

### Objective
Verify that users can only upload 10 receipts per hour.

### Steps

1. **Prepare Test Images**
   - Have 11 small test receipt images ready
   - Or use the same image 11 times

2. **Upload Receipts Rapidly**
   - Go to Receipts page
   - Upload receipts one after another
   - Don't wait between uploads

3. **Expected Behavior**
   - Uploads 1-10: Should succeed
   - Upload 11: Should fail with:
     - "Rate limit exceeded. You can upload again in X minutes."
     - HTTP 429 status code

4. **Verify in Database**
   ```sql
   -- Check rate limit attempts
   SELECT * FROM rate_limit_attempts
   WHERE action_type = 'upload'
   ORDER BY window_start DESC
   LIMIT 5;
   ```

5. **Expected Database State**
   - `attempts`: Should be 11
   - `is_blocked`: Should be `true`
   - `block_expires_at`: Should be ~2 hours from now (2x the window)

### Testing Rate Limit Reset

**Option 1: Wait it out** (1 hour)
- Wait 1 hour
- Try uploading again
- Should work

**Option 2: Manual reset (for testing only)**
```sql
-- Reset upload rate limits for a specific user
DELETE FROM rate_limit_attempts
WHERE identifier = 'YOUR_USER_ID'
AND action_type = 'upload';
```

---

## Test 3: Email Invitation Rate Limiting

### Objective
Verify that only 3 invitation emails can be sent per hour.

### Steps

1. **Send Invitations**
   - Go to Team page
   - Send 4 invitations to different email addresses
   - Do them quickly (within a few minutes)

2. **Expected Behavior**
   - Invitations 1-3: Should succeed
   - Invitation 4: Should fail with rate limit error

3. **Verify in Database**
   ```sql
   SELECT * FROM rate_limit_attempts
   WHERE action_type = 'email'
   ORDER BY window_start DESC;
   ```

---

## Test 4: Export Rate Limiting

### Objective
Verify that only 5 exports can be done per hour.

### Steps

1. **Attempt Multiple Exports**
   - Go to Reports page
   - Try to export 6 times in a row
   - Use any export format (CSV, PDF, ZIP)

2. **Expected Behavior**
   - Exports 1-5: Should succeed
   - Export 6: Should fail with "Export limit reached"

3. **Verify in Database**
   ```sql
   SELECT * FROM rate_limit_attempts
   WHERE action_type = 'export'
   ORDER BY window_start DESC;
   ```

---

## Test 5: Input Sanitization (XSS Protection)

### Objective
Verify that malicious input is sanitized.

### Test Cases

#### Test 1: Receipt Manual Entry

1. **Try to inject scripts**
   - Go to Receipts → Add Manual Entry
   - In vendor name, enter: `<script>alert('XSS')</script>Test Vendor`
   - Fill other fields normally
   - Save

2. **Expected Behavior**
   - Receipt should save successfully
   - When viewing the receipt, vendor name should display: `Test Vendor` (script removed)
   - No alert popup should appear
   - No console errors

3. **Verify in Database**
   ```sql
   SELECT vendor_name FROM receipts
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   - Should NOT contain `<script>` tags
   - Should be: `Test Vendor` or empty string

#### Test 2: Business Name

1. **Create/Edit Business**
   - Try to set business name: `<img src=x onerror=alert('XSS')>My Business`

2. **Expected Behavior**
   - Should save as: `My Business` (tags removed)

#### Test 3: Category Name

1. **Create Category**
   - Name: `<iframe src="evil.com">Travel</iframe>`

2. **Expected Behavior**
   - Should save as: `Travel`

#### Test 4: Notes Field (Rich Text)

1. **Add Receipt with Notes**
   - Notes: `<b>Bold text</b> <script>alert('XSS')</script> <i>Italic</i>`

2. **Expected Behavior**
   - Should save as: `<b>Bold text</b>  <i>Italic</i>`
   - Bold and italic should render
   - Script should be completely removed

---

## Test 6: Database Rate Limit Functions

### Test Direct Database Calls

#### Test 1: Check Rate Limit Function

```sql
-- Simulate checking rate limit for login
SELECT check_rate_limit(
  '192.168.1.1',  -- identifier (IP or user ID)
  'login',         -- action type
  5,               -- max attempts
  15               -- window in minutes
);
```

**Expected Result:**
```json
{
  "allowed": true,
  "blocked": false,
  "remaining": 4,
  "limit": 5,
  "resetAt": "2025-10-21T..."
}
```

#### Test 2: Trigger Rate Limit

```sql
-- Call it 6 times to trigger block
SELECT check_rate_limit('192.168.1.1', 'login', 5, 15);
SELECT check_rate_limit('192.168.1.1', 'login', 5, 15);
SELECT check_rate_limit('192.168.1.1', 'login', 5, 15);
SELECT check_rate_limit('192.168.1.1', 'login', 5, 15);
SELECT check_rate_limit('192.168.1.1', 'login', 5, 15);
SELECT check_rate_limit('192.168.1.1', 'login', 5, 15); -- This should block
```

**6th Call Expected Result:**
```json
{
  "allowed": false,
  "blocked": true,
  "retryAfter": 1800,
  "resetAt": "2025-10-21T..."
}
```

#### Test 3: Check Account Lockout

```sql
-- Check if an account is locked
SELECT check_account_lockout('test@example.com');
```

**Expected Results:**

If not locked:
```json
{
  "locked": false
}
```

If locked:
```json
{
  "locked": true,
  "lockedAt": "2025-10-21T...",
  "lockedUntil": "2025-10-21T...",
  "attemptsCount": 5,
  "retryAfter": 1234
}
```

#### Test 4: Record Failed Login

```sql
-- Simulate a failed login
SELECT record_failed_login(
  'test@example.com',
  '192.168.1.100',
  'Mozilla/5.0...',
  'invalid_credentials'
);
```

**Expected Results:**

First 4 attempts:
```json
{
  "locked": false,
  "attempts": 1,
  "remainingAttempts": 4
}
```

5th attempt (triggers lockout):
```json
{
  "locked": true,
  "attempts": 5,
  "lockedUntil": "2025-10-21T...",
  "message": "Account temporarily locked due to multiple failed login attempts"
}
```

---

## Test 7: Monitoring & Cleanup

### View All Current Rate Limits

```sql
-- See all active rate limits
SELECT
  identifier,
  action_type,
  attempts,
  is_blocked,
  window_start,
  window_end,
  block_expires_at
FROM rate_limit_attempts
WHERE window_end > now() OR (is_blocked = true AND block_expires_at > now())
ORDER BY window_start DESC;
```

### View All Active Lockouts

```sql
-- See all locked accounts
SELECT
  email,
  locked_at,
  locked_until,
  attempts_count,
  locked_by_ip
FROM account_lockouts
WHERE is_active = true
ORDER BY locked_at DESC;
```

### Test Cleanup Function

```sql
-- Clean up old rate limit data (should be run periodically)
SELECT cleanup_old_rate_limits();
```

**Expected Result:**
- Returns number of deleted entries
- Should remove entries older than 7 days

---

## Test 8: System Logs Verification

### Check That Security Events Are Logged

```sql
-- View recent security-related logs
SELECT
  level,
  category,
  message,
  metadata,
  created_at
FROM system_logs
WHERE category IN ('AUTH', 'SECURITY')
ORDER BY created_at DESC
LIMIT 20;
```

**Expected Entries:**
- Login failures
- Account lockouts
- Rate limit violations
- Admin unlock actions

---

## Test 9: Edge Function Rate Limits

### Test Using Supabase Dashboard

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click on `extract-receipt-data` function
3. Use the "Invoke" button to test:

```json
{
  "filePath": "test/receipt.jpg",
  "collectionId": "YOUR_COLLECTION_ID"
}
```

4. **Invoke 11 times rapidly**
5. **Expected:** 11th call should return 429 status

### Test Using curl

```bash
# Set your variables
SUPABASE_URL="your-project-url"
ANON_KEY="your-anon-key"
USER_TOKEN="your-user-token"

# Call the function 11 times
for i in {1..11}; do
  echo "Attempt $i"
  curl -X POST \
    "$SUPABASE_URL/functions/v1/extract-receipt-data" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"filePath":"test.jpg","collectionId":"test-id"}'
  echo ""
done
```

---

## Test 10: Performance Testing

### Monitor Rate Limit Query Performance

```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM rate_limit_attempts
WHERE identifier = 'test-user-id'
  AND action_type = 'upload'
  AND window_end > now()
  AND is_blocked = false;
```

**Expected:**
- Should use index: `idx_rate_limit_identifier_action`
- Execution time: < 5ms

---

## Common Issues & Solutions

### Issue 1: "Can't test because I'm always logged in"

**Solution:** Use incognito/private browsing mode for login tests

### Issue 2: "Rate limits reset too quickly"

**Solution:** Check your system clock. The database uses `now()` which is server time.

### Issue 3: "Can't see rate limit data in database"

**Solution:** You need to be a system admin. Check:
```sql
SELECT * FROM system_roles WHERE user_id = auth.uid();
```

### Issue 4: "Want to reset everything for clean testing"

**Solution:** Run these queries (CAREFUL - deletes all rate limit data):
```sql
-- Delete all rate limit data
DELETE FROM rate_limit_attempts;
DELETE FROM failed_login_attempts;
DELETE FROM account_lockouts;
```

---

## Automated Testing Script

Create this file: `test-rate-limits.sql`

```sql
-- Test Suite: Rate Limiting System
-- Run this in Supabase SQL Editor

-- Test 1: Basic rate limit check
DO $$
DECLARE
  result jsonb;
BEGIN
  RAISE NOTICE '=== Test 1: Basic Rate Limit Check ===';

  SELECT check_rate_limit('test-ip', 'login', 5, 15) INTO result;

  IF result->>'allowed' = 'true' THEN
    RAISE NOTICE '✓ First attempt allowed';
  ELSE
    RAISE EXCEPTION '✗ First attempt should be allowed';
  END IF;
END $$;

-- Test 2: Rate limit exhaustion
DO $$
DECLARE
  result jsonb;
  i integer;
BEGIN
  RAISE NOTICE '=== Test 2: Rate Limit Exhaustion ===';

  -- Clean up first
  DELETE FROM rate_limit_attempts WHERE identifier = 'test-ip-2';

  -- Make 5 attempts
  FOR i IN 1..5 LOOP
    SELECT check_rate_limit('test-ip-2', 'login', 5, 15) INTO result;
  END LOOP;

  -- 6th attempt should block
  SELECT check_rate_limit('test-ip-2', 'login', 5, 15) INTO result;

  IF result->>'blocked' = 'true' THEN
    RAISE NOTICE '✓ Correctly blocked after 5 attempts';
  ELSE
    RAISE EXCEPTION '✗ Should be blocked after 5 attempts';
  END IF;

  -- Cleanup
  DELETE FROM rate_limit_attempts WHERE identifier = 'test-ip-2';
END $$;

-- Test 3: Account lockout
DO $$
DECLARE
  result jsonb;
  i integer;
BEGIN
  RAISE NOTICE '=== Test 3: Account Lockout ===';

  -- Clean up first
  DELETE FROM failed_login_attempts WHERE email = 'test@test.com';
  DELETE FROM account_lockouts WHERE email = 'test@test.com';

  -- Record 5 failed attempts
  FOR i IN 1..5 LOOP
    SELECT record_failed_login('test@test.com', '127.0.0.1', 'test-agent', 'test') INTO result;
  END LOOP;

  IF result->>'locked' = 'true' THEN
    RAISE NOTICE '✓ Account locked after 5 attempts';
  ELSE
    RAISE EXCEPTION '✗ Account should be locked after 5 attempts';
  END IF;

  -- Check lockout status
  SELECT check_account_lockout('test@test.com') INTO result;

  IF result->>'locked' = 'true' THEN
    RAISE NOTICE '✓ Lockout status correctly returned';
  ELSE
    RAISE EXCEPTION '✗ Lockout status should be true';
  END IF;

  -- Cleanup
  DELETE FROM failed_login_attempts WHERE email = 'test@test.com';
  DELETE FROM account_lockouts WHERE email = 'test@test.com';
END $$;

RAISE NOTICE '=== All Tests Passed ===';
```

---

## Success Criteria

✅ **Login Rate Limiting**
- 5 failed attempts trigger lockout
- Lockout lasts 30 minutes
- Error message shows time remaining
- Database records attempts and lockout

✅ **Upload Rate Limiting**
- 10 uploads per hour enforced
- 11th upload gets 429 error
- Error message shows retry time
- Works for both user ID and IP

✅ **Input Sanitization**
- Script tags removed from all fields
- XSS patterns detected and cleaned
- Rich text fields allow safe HTML only
- No JavaScript execution from user input

✅ **Database Functions**
- All functions return correct JSON
- Rate limits respect time windows
- Cleanup function removes old data
- Admin unlock works correctly

✅ **Audit Logging**
- Security events logged to system_logs
- Failed logins recorded
- Lockouts tracked
- IP addresses captured

---

## Next Steps After Testing

1. **Fix any issues found**
2. **Adjust rate limits** if too strict/lenient
3. **Set up monitoring alerts** for:
   - High number of failed logins
   - Rate limit blocks
   - Account lockouts
4. **Document** any custom rate limits for your use case
5. **Train staff** on unlocking accounts if needed

---

**Testing Complete!** Once all tests pass, your security system is production-ready.
