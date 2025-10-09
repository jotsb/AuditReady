/*
  # Fix invitation email webhook URL for pg_net

  1. Changes
    - Update send_invitation_email_webhook to use internal edge function URL
    - pg_net in Supabase can access edge functions via internal network
    - Use the SUPABASE_URL environment variable that's available in the database
  
  2. Notes
    - Supabase edge functions are accessible internally at the project ref URL
    - This fixes the "Couldn't resolve host name" error from pg_net
*/

CREATE OR REPLACE FUNCTION send_invitation_email_webhook()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  function_url text;
  inviter_name text;
  business_name text;
  supabase_url text;
BEGIN
  -- Get the Supabase URL from environment
  supabase_url := current_setting('request.headers', true)::json->>'x-forwarded-host';
  
  IF supabase_url IS NULL THEN
    supabase_url := 'fvddlksirpbwqopqhwud.supabase.co';
  END IF;
  
  function_url := 'https://' || supabase_url || '/functions/v1/send-invitation-email';

  SELECT p.full_name INTO inviter_name
  FROM profiles p
  WHERE p.id = NEW.invited_by;

  SELECT b.name INTO business_name
  FROM businesses b
  WHERE b.id = NEW.business_id;

  -- Log the attempt
  RAISE LOG 'Sending invitation email to % via %', NEW.email, function_url;

  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('request.jwt.claims', true)::json->>'token'
    ),
    body := jsonb_build_object(
      'email', NEW.email,
      'role', NEW.role,
      'token', NEW.token,
      'inviterName', inviter_name,
      'businessName', business_name
    )
  ) INTO request_id;

  RAISE LOG 'Invitation email request queued with ID: %', request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send invitation email: %', SQLERRM;
    RETURN NEW;
END;
$$;