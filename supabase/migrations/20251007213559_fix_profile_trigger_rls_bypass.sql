/*
  # Fix Profile Trigger to Bypass RLS

  ## Problem
  The trigger function runs during signup BEFORE the user is authenticated,
  but the INSERT policy requires auth.uid() = id, causing the trigger to fail.

  ## Solution
  Update the trigger function to use SECURITY DEFINER which runs with the
  privileges of the function owner (postgres/service role), bypassing RLS.

  ## Changes
  1. Recreate the function with explicit SECURITY DEFINER
  2. Grant necessary permissions to the function
  3. This allows the trigger to insert profiles during signup

  ## Security
  - Function only inserts with NEW.id from auth.users (safe)
  - Cannot be called directly by users (only by trigger)
  - RLS still protects profiles from unauthorized access
*/

-- Recreate the function with proper permissions
CREATE OR REPLACE FUNCTION public.sync_user_email_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Insert new profile with email from auth.users
  INSERT INTO public.profiles (id, email, full_name, mfa_enabled)
  VALUES (NEW.id, NEW.email, NULL, false)
  ON CONFLICT (id) 
  DO UPDATE SET email = NEW.email;
  
  RETURN NEW;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.sync_user_email_to_profile() TO service_role;

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
CREATE TRIGGER on_auth_user_email_change
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_email_to_profile();
