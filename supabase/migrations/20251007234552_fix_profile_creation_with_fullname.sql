/*
  # Fix Profile Creation to Include Full Name

  ## Problem
  The trigger that creates profiles on signup sets full_name to NULL,
  even though the signup form collects it and passes it in user metadata.

  ## Solution
  Update the trigger function to extract full_name from auth.users.raw_user_meta_data
  where Supabase stores the custom data passed during signup.

  ## Changes
  1. Update sync_user_email_to_profile() function to read full_name from metadata
  2. This ensures full_name is set immediately when profile is created
  3. No need to update profile separately after signup

  ## Technical Details
  - User metadata is stored in auth.users.raw_user_meta_data as JSONB
  - We extract the full_name field using the ->> operator
  - If full_name is not in metadata, it defaults to NULL (existing behavior)
*/

-- Update the trigger function to include full_name from metadata
CREATE OR REPLACE FUNCTION public.sync_user_email_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Insert new profile with email and full_name from auth.users
  -- full_name is extracted from raw_user_meta_data if available
  INSERT INTO public.profiles (id, email, full_name, mfa_enabled)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    false
  )
  ON CONFLICT (id) 
  DO UPDATE SET 
    email = NEW.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  
  RETURN NEW;
END;
$$;
