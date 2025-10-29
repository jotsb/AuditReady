# Security Testing Checklist

Quick checklist for testing all security features. Check off each item as you test.

## 🚀 Quick Start

1. **Run Automated Tests First**
   ```sql
   -- Copy and paste this entire file into Supabase SQL Editor
   -- File: test-rate-limits.sql
   ```
   - [ ] All tests pass
   - [ ] No errors in console

2. **Start Your Dev Server**
   ```bash
   npm run dev
   ```

---

## ✅ Manual Testing Checklist

### 1. Login Rate Limiting (5 min)

- [ ] **Attempt 1-4:** Enter wrong password → See "Invalid credentials"
- [ ] **Attempt 5:** Account gets locked → See lockout message
- [ ] **Attempt 6:** Still locked → See "Try again in X minutes"
- [ ] **Database check:**
  ```sql
  SELECT * FROM failed_login_attempts WHERE email = 'your-test-email' ORDER BY attempt_time DESC;
  SELECT * FROM account_lockouts WHERE email = 'your-test-email' AND is_active = true;
  ```
- [ ] **Admin unlock works:**
  ```sql
  SELECT unlock_account('your-test-email', 'Testing');
  ```
- [ ] **Can login after unlock**

### 2. Receipt Upload Rate Limiting (10 min)

- [ ] **Upload 1-10:** All succeed
- [ ] **Upload 11:** Gets rejected with 429 error
- [ ] **Error message:** Shows "Try again in X minutes"
- [ ] **Database check:**
  ```sql
  SELECT * FROM rate_limit_attempts WHERE action_type = 'upload' ORDER BY window_start DESC LIMIT 1;
  ```
- [ ] **Wait 1 hour OR reset:**
  ```sql
  DELETE FROM rate_limit_attempts WHERE action_type = 'upload' AND identifier = 'YOUR_USER_ID';
  ```
- [ ] **Can upload again after reset**

### 3. Input Sanitization (5 min)

Test each field with: `<script>alert('XSS')</script>Test Value`

- [ ] **Vendor Name:** Script removed, shows "Test Value"
- [ ] **Business Name:** Script removed
- [ ] **Category Name:** Script removed
- [ ] **Notes (rich text):** Script removed, but `<b>bold</b>` works
- [ ] **No alert popups appear**
- [ ] **No console errors**

### 4. Email Rate Limiting (5 min)

- [ ] **Send 1-3 invitations:** All succeed
- [ ] **Send 4th invitation:** Gets rejected
- [ ] **Error shows:** "Too many emails sent"
- [ ] **Database check:**
  ```sql
  SELECT * FROM rate_limit_attempts WHERE action_type = 'email' ORDER BY window_start DESC;
  ```

### 5. Export Rate Limiting (5 min)

- [ ] **Export 1-5:** All succeed (CSV, PDF, or ZIP)
- [ ] **Export 6:** Gets rejected
- [ ] **Error shows:** "Export limit reached"

### 6. System Logs Verification (2 min)

- [ ] **Check security events logged:**
  ```sql
  SELECT level, category, message, created_at
  FROM system_logs
  WHERE category IN ('AUTH', 'SECURITY')
  ORDER BY created_at DESC
  LIMIT 20;
  ```
- [ ] **See failed login attempts logged**
- [ ] **See account lockouts logged**

---

## 📊 Database Verification

Run these queries to verify everything is working:

### Rate Limits Currently Active
```sql
SELECT
  identifier,
  action_type,
  attempts,
  is_blocked,
  window_end,
  block_expires_at
FROM rate_limit_attempts
WHERE window_end > now() OR (is_blocked = true AND block_expires_at > now())
ORDER BY window_start DESC;
```

### Active Account Lockouts
```sql
SELECT
  email,
  locked_at,
  locked_until,
  attempts_count,
  is_active
FROM account_lockouts
WHERE is_active = true
ORDER BY locked_at DESC;
```

### Recent Failed Logins
```sql
SELECT
  email,
  ip_address,
  attempt_time,
  failure_reason
FROM failed_login_attempts
ORDER BY attempt_time DESC
LIMIT 20;
```

---

## 🐛 Troubleshooting

### "Can't see rate limit data"
**Fix:** You need to be a system admin
```sql
-- Check your role
SELECT * FROM system_roles WHERE user_id = auth.uid();

-- If not admin, make yourself admin
INSERT INTO system_roles (user_id, role) VALUES (auth.uid(), 'admin');
```

### "Rate limits aren't working"
**Check:**
1. Migration applied? `SELECT * FROM rate_limit_attempts LIMIT 1;`
2. Functions exist? `SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE '%rate%';`
3. Check browser console for errors

### "Need to reset everything"
```sql
-- CAREFUL: This deletes ALL rate limit data
DELETE FROM rate_limit_attempts;
DELETE FROM failed_login_attempts;
DELETE FROM account_lockouts;
```

### "Account locked and can't unlock"
```sql
-- Force unlock (as admin)
UPDATE account_lockouts
SET is_active = false, unlocked_at = now()
WHERE email = 'stuck-email@example.com' AND is_active = true;
```

---

## ✅ Success Criteria

All items must pass:

- [x] ✅ Automated SQL tests pass
- [ ] ✅ Login locks after 5 attempts
- [ ] ✅ Upload blocks after 10 attempts
- [ ] ✅ Email blocks after 3 attempts
- [ ] ✅ Export blocks after 5 attempts
- [ ] ✅ XSS scripts are removed
- [ ] ✅ Admin can unlock accounts
- [ ] ✅ Security events logged
- [ ] ✅ Database queries fast (< 5ms)
- [ ] ✅ No console errors
- [ ] ✅ User-friendly error messages

---

## 📝 Test Notes

**Date Tested:** ___________

**Tester:** ___________

**Issues Found:**
-
-
-

**Notes:**
-
-
-

---

## 🎉 When All Tests Pass

1. ✅ Mark this checklist complete
2. 📸 Take screenshots of:
   - Locked account message
   - Rate limit error messages
   - Database tables with data
3. 📋 Document any adjusted rate limits
4. 🚀 System is production-ready!

---

**Total Time Required:** ~30-40 minutes for complete testing
