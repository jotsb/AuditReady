/*
  # Clear Email Rate Limits

  ## Overview
  Clears all email rate limit attempts to allow fresh testing with the 20-email-per-hour limit.
  This is a one-time cleanup migration for existing installations.

  ## Changes
  - Deletes all email rate limit attempts from `rate_limit_attempts` table
  - Allows users to test with the new 20-email-per-hour limit without old attempts blocking them

  ## Notes
  - This is safe to run multiple times (idempotent)
  - Only affects email rate limits, not login or other action types
*/

-- Delete all email rate limit attempts
DELETE FROM rate_limit_attempts WHERE action_type = 'email';
