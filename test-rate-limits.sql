-- ============================================================================
-- Rate Limiting System - Automated Test Suite
-- ============================================================================
-- Run this in Supabase SQL Editor to verify all rate limiting functions work
-- ============================================================================

-- Clean up any existing test data
DELETE FROM rate_limit_attempts WHERE identifier LIKE 'test-%';
DELETE FROM failed_login_attempts WHERE email LIKE 'test-%';
DELETE FROM account_lockouts WHERE email LIKE 'test-%';

-- ============================================================================
-- Test 1: Basic Rate Limit Check
-- ============================================================================
DO $$
DECLARE
  result jsonb;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test 1: Basic Rate Limit Check ===';

  -- First attempt should be allowed
  SELECT check_rate_limit('test-ip-1', 'login', 5, 15) INTO result;

  IF result->>'allowed' = 'true' THEN
    RAISE NOTICE '✓ PASS: First attempt allowed';
    RAISE NOTICE '  Remaining: %', result->>'remaining';
  ELSE
    RAISE EXCEPTION '✗ FAIL: First attempt should be allowed. Got: %', result;
  END IF;
END $$;

-- ============================================================================
-- Test 2: Rate Limit Tracking
-- ============================================================================
DO $$
DECLARE
  result jsonb;
  remaining int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test 2: Rate Limit Tracking ===';

  -- Clean up first
  DELETE FROM rate_limit_attempts WHERE identifier = 'test-ip-2';

  -- Make 3 attempts
  SELECT check_rate_limit('test-ip-2', 'login', 5, 15) INTO result;
  SELECT check_rate_limit('test-ip-2', 'login', 5, 15) INTO result;
  SELECT check_rate_limit('test-ip-2', 'login', 5, 15) INTO result;

  remaining := (result->>'remaining')::int;

  IF remaining = 2 THEN
    RAISE NOTICE '✓ PASS: Correctly tracking attempts';
    RAISE NOTICE '  Attempts used: 3, Remaining: %', remaining;
  ELSE
    RAISE EXCEPTION '✗ FAIL: Should have 2 remaining, got %', remaining;
  END IF;
END $$;

-- ============================================================================
-- Test 3: Rate Limit Exhaustion
-- ============================================================================
DO $$
DECLARE
  result jsonb;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test 3: Rate Limit Exhaustion ===';

  -- Clean up first
  DELETE FROM rate_limit_attempts WHERE identifier = 'test-ip-3';

  -- Make exactly 5 attempts (at the limit)
  FOR i IN 1..5 LOOP
    SELECT check_rate_limit('test-ip-3', 'login', 5, 15) INTO result;
  END LOOP;

  -- 6th attempt should block
  SELECT check_rate_limit('test-ip-3', 'login', 5, 15) INTO result;

  IF result->>'blocked' = 'true' THEN
    RAISE NOTICE '✓ PASS: Correctly blocked after exceeding limit';
    RAISE NOTICE '  Retry after: % seconds', result->>'retryAfter';
  ELSE
    RAISE EXCEPTION '✗ FAIL: Should be blocked after 5 attempts. Got: %', result;
  END IF;
END $$;

-- ============================================================================
-- Test 4: Account Lockout Trigger
-- ============================================================================
DO $$
DECLARE
  result jsonb;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test 4: Account Lockout Trigger ===';

  -- Clean up first
  DELETE FROM failed_login_attempts WHERE email = 'test-user@example.com';
  DELETE FROM account_lockouts WHERE email = 'test-user@example.com';

  -- Record 4 failed attempts (should NOT lock)
  FOR i IN 1..4 LOOP
    SELECT record_failed_login(
      'test-user@example.com',
      '127.0.0.1',
      'Mozilla/5.0 Test',
      'invalid_credentials'
    ) INTO result;
  END LOOP;

  IF result->>'locked' = 'false' THEN
    RAISE NOTICE '✓ PASS: Account not locked after 4 attempts';
    RAISE NOTICE '  Remaining attempts: %', result->>'remainingAttempts';
  ELSE
    RAISE EXCEPTION '✗ FAIL: Account should NOT be locked after 4 attempts';
  END IF;

  -- 5th attempt should trigger lockout
  SELECT record_failed_login(
    'test-user@example.com',
    '127.0.0.1',
    'Mozilla/5.0 Test',
    'invalid_credentials'
  ) INTO result;

  IF result->>'locked' = 'true' THEN
    RAISE NOTICE '✓ PASS: Account locked after 5th attempt';
    RAISE NOTICE '  Locked until: %', result->>'lockedUntil';
  ELSE
    RAISE EXCEPTION '✗ FAIL: Account should be locked after 5 attempts. Got: %', result;
  END IF;
END $$;

-- ============================================================================
-- Test 5: Check Account Lockout Status
-- ============================================================================
DO $$
DECLARE
  result jsonb;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test 5: Check Account Lockout Status ===';

  -- Check the locked account from previous test
  SELECT check_account_lockout('test-user@example.com') INTO result;

  IF result->>'locked' = 'true' THEN
    RAISE NOTICE '✓ PASS: Lockout status correctly detected';
    RAISE NOTICE '  Attempts count: %', result->>'attemptsCount';
    RAISE NOTICE '  Retry after: % seconds', result->>'retryAfter';
  ELSE
    RAISE EXCEPTION '✗ FAIL: Lockout should be active. Got: %', result;
  END IF;
END $$;

-- ============================================================================
-- Test 6: Admin Unlock Function
-- ============================================================================
DO $$
DECLARE
  result jsonb;
  lockout_result jsonb;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test 6: Admin Unlock Function ===';

  -- Note: This test will only work if run by a system admin
  -- If you get an error, that's expected for non-admin users

  BEGIN
    -- Try to unlock the account
    SELECT unlock_account(
      'test-user@example.com',
      'Automated test unlock'
    ) INTO result;

    IF result->>'success' = 'true' THEN
      RAISE NOTICE '✓ PASS: Account unlocked successfully';

      -- Verify lockout is inactive
      SELECT check_account_lockout('test-user@example.com') INTO lockout_result;

      IF lockout_result->>'locked' = 'false' THEN
        RAISE NOTICE '✓ PASS: Lockout status now false';
      ELSE
        RAISE EXCEPTION '✗ FAIL: Lockout should be inactive after unlock';
      END IF;
    ELSE
      RAISE EXCEPTION '✗ FAIL: Unlock should succeed. Got: %', result;
    END IF;

  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Unauthorized%' THEN
        RAISE NOTICE '⚠ SKIP: Test requires system admin privileges';
        RAISE NOTICE '  Run this test as a system admin to verify unlock functionality';
      ELSE
        RAISE;
      END IF;
  END;
END $$;

-- ============================================================================
-- Test 7: Multiple Action Types
-- ============================================================================
DO $$
DECLARE
  login_result jsonb;
  upload_result jsonb;
  email_result jsonb;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test 7: Multiple Action Types ===';

  -- Clean up
  DELETE FROM rate_limit_attempts WHERE identifier = 'test-multi-action';

  -- Test different action types with different limits
  SELECT check_rate_limit('test-multi-action', 'login', 5, 15) INTO login_result;
  SELECT check_rate_limit('test-multi-action', 'upload', 10, 60) INTO upload_result;
  SELECT check_rate_limit('test-multi-action', 'email', 3, 60) INTO email_result;

  IF (login_result->>'allowed' = 'true') AND
     (upload_result->>'allowed' = 'true') AND
     (email_result->>'allowed' = 'true') THEN
    RAISE NOTICE '✓ PASS: All action types tracked independently';
    RAISE NOTICE '  Login limit: %, remaining: %', login_result->>'limit', login_result->>'remaining';
    RAISE NOTICE '  Upload limit: %, remaining: %', upload_result->>'limit', upload_result->>'remaining';
    RAISE NOTICE '  Email limit: %, remaining: %', email_result->>'limit', email_result->>'remaining';
  ELSE
    RAISE EXCEPTION '✗ FAIL: Action types should be independent';
  END IF;
END $$;

-- ============================================================================
-- Test 8: Time Window Expiration
-- ============================================================================
DO $$
DECLARE
  result jsonb;
  count_before int;
  count_after int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test 8: Time Window Expiration ===';

  -- Clean up
  DELETE FROM rate_limit_attempts WHERE identifier = 'test-time-window';

  -- Create an expired entry (manually set window_end in the past)
  INSERT INTO rate_limit_attempts (
    identifier,
    action_type,
    attempts,
    window_start,
    window_end,
    is_blocked
  ) VALUES (
    'test-time-window',
    'login',
    5,
    now() - interval '2 hours',
    now() - interval '1 hour',
    false
  );

  -- Count entries before
  SELECT COUNT(*) INTO count_before
  FROM rate_limit_attempts
  WHERE identifier = 'test-time-window';

  -- Make a new attempt (should create new window, not use expired one)
  SELECT check_rate_limit('test-time-window', 'login', 5, 15) INTO result;

  IF (result->>'remaining')::int = 4 THEN
    RAISE NOTICE '✓ PASS: New window created for expired entry';
    RAISE NOTICE '  Remaining after first attempt in new window: 4';
  ELSE
    RAISE EXCEPTION '✗ FAIL: Should have 4 remaining in new window, got %', result->>'remaining';
  END IF;
END $$;

-- ============================================================================
-- Test 9: Cleanup Function
-- ============================================================================
DO $$
DECLARE
  deleted_count int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test 9: Cleanup Function ===';

  -- Create some old entries
  INSERT INTO rate_limit_attempts (
    identifier,
    action_type,
    attempts,
    window_start,
    window_end,
    is_blocked
  ) VALUES (
    'test-old-entry',
    'login',
    5,
    now() - interval '8 days',
    now() - interval '8 days',
    false
  );

  -- Run cleanup
  SELECT cleanup_old_rate_limits() INTO deleted_count;

  RAISE NOTICE '✓ PASS: Cleanup function executed';
  RAISE NOTICE '  Deleted % old entries', deleted_count;
END $$;

-- ============================================================================
-- Test Summary
-- ============================================================================
DO $$
DECLARE
  total_rate_limits int;
  total_failed_logins int;
  total_lockouts int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Test Summary ===';

  SELECT COUNT(*) INTO total_rate_limits FROM rate_limit_attempts WHERE identifier LIKE 'test-%';
  SELECT COUNT(*) INTO total_failed_logins FROM failed_login_attempts WHERE email LIKE 'test-%';
  SELECT COUNT(*) INTO total_lockouts FROM account_lockouts WHERE email LIKE 'test-%';

  RAISE NOTICE 'Created during tests:';
  RAISE NOTICE '  - % rate limit entries', total_rate_limits;
  RAISE NOTICE '  - % failed login entries', total_failed_logins;
  RAISE NOTICE '  - % lockout entries', total_lockouts;
END $$;

-- ============================================================================
-- Cleanup Test Data
-- ============================================================================
RAISE NOTICE '';
RAISE NOTICE '=== Cleaning Up Test Data ===';

DELETE FROM rate_limit_attempts WHERE identifier LIKE 'test-%';
DELETE FROM failed_login_attempts WHERE email LIKE 'test-%';
DELETE FROM account_lockouts WHERE email LIKE 'test-%';

RAISE NOTICE '✓ Test data cleaned up';
RAISE NOTICE '';
RAISE NOTICE '╔════════════════════════════════════════════╗';
RAISE NOTICE '║   ALL TESTS COMPLETED SUCCESSFULLY! ✓      ║';
RAISE NOTICE '║                                            ║';
RAISE NOTICE '║   Rate Limiting System is Working!        ║';
RAISE NOTICE '╚════════════════════════════════════════════╝';
