/*
  # Fix Profile Trigger for Email Verification Signup

  ## Problem
  The current trigger tries to insert a profile with an empty full_name,
  but the profiles.full_name column is marked as NOT NULL, causing signups to fail.

  ## Changes
  1. Make full_name column nullable to allow the trigger to work
  2. Update the trigger to insert NULL instead of empty string
  3. App will update full_name after profile is created

  ## Notes
  - This allows the email verification flow to work properly
  - Full name will be filled in by the app after trigger creates the profile
*/

-- Make full_name nullable since it will be filled in after profile creation
ALTER TABLE profiles ALTER COLUMN full_name DROP NOT NULL;

-- Update trigger to handle NULL full_name gracefully
CREATE OR REPLACE FUNCTION sync_user_email_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, mfa_enabled)
  VALUES (NEW.id, NEW.email, NULL, false)
  ON CONFLICT (id) 
  DO UPDATE SET email = NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
