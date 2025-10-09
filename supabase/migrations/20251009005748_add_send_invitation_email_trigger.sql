/*
  # Add automatic invitation email sending

  1. New Functions
    - `send_invitation_email_webhook()` - Trigger function that calls the edge function to send invitation emails
  
  2. New Triggers
    - `on_invitation_created` - Automatically sends email when invitation is created
  
  3. Notes
    - Uses pg_net extension to make HTTP requests to edge function
    - Runs asynchronously to not block the invitation creation
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
END;
$$;

DROP TRIGGER IF EXISTS on_invitation_created ON invitations;

CREATE TRIGGER on_invitation_created
  AFTER INSERT ON invitations
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION send_invitation_email_webhook();