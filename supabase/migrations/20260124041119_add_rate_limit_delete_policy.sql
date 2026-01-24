/*
  # Add Rate Limit Management Policies

  ## Overview
  Adds DELETE policy to allow system admins to manage rate limit entries from the admin UI.

  ## Security Changes
  - Add DELETE policy for system admins on rate_limit_attempts table
*/

CREATE POLICY "System admins can delete rate limits"
  ON rate_limit_attempts FOR DELETE
  TO authenticated
  USING (is_system_admin(auth.uid()));
