/*
  # Fix pg_net function call in invitation email trigger

  1. Changes
    - Update send_invitation_email_webhook to use correct pg_net.http_post function
    - pg_net functions are in the net schema, not extensions schema
  
  2. Notes
    - The correct function is net.http_post (after extension is enabled)
    - This fixes the "function extensions.http_post does not exist" error
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
BEGIN
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-invitation-email';
  
  IF function_url IS NULL OR function_url = '/functions/v1/send-invitation-email' THEN
    function_url := 'https://fvddlksirpbwqopqhwud.supabase.co/functions/v1/send-invitation-email';
  END IF;

  SELECT p.full_name INTO inviter_name
  FROM profiles p
  WHERE p.id = NEW.invited_by;

  SELECT b.name INTO business_name
  FROM businesses b
  WHERE b.id = NEW.business_id;

  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'email', NEW.email,
      'role', NEW.role,
      'token', NEW.token,
      'inviterName', inviter_name,
      'businessName', business_name
    )
  ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send invitation email: %', SQLERRM;
    RETURN NEW;
END;
$$;