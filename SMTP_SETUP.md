# SMTP Email Configuration

The application has been updated to use your private email server (mail.privateemail.com) instead of Resend for sending invitation emails.

## Required Environment Variables

You need to add the following secrets to your Supabase project:

### Via Supabase Dashboard:
1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Add the following secrets:

```
SMTP_HOST=mail.privateemail.com
SMTP_PORT=465
SMTP_USER=contact@auditproof.ca
SMTP_PASSWORD=<your-password>
```

### Via Supabase CLI:
```bash
# Set SMTP host
supabase secrets set SMTP_HOST=mail.privateemail.com

# Set SMTP port (465 for SSL/TLS)
supabase secrets set SMTP_PORT=465

# Set SMTP username
supabase secrets set SMTP_USER=contact@auditproof.ca

# Set SMTP password
supabase secrets set SMTP_PASSWORD=<your-password>
```

## Email Configuration Details

- **Server**: mail.privateemail.com
- **Port**: 465 (SSL/TLS)
- **Username**: contact@auditproof.ca
- **From Address**: Audit Proof <contact@auditproof.ca>
- **Connection Type**: SSL/TLS

## Important Notes

1. **Port 465**: The application uses port 465 with SSL/TLS encryption. This is the standard secure SMTP port.

2. **Password Security**: Never commit the SMTP password to version control. Always use environment variables/secrets.

3. **Fallback Behavior**: If SMTP credentials are not configured, the Edge Function will still work but will return the invitation link without sending an email. Users can manually share the invitation link.

4. **Email Format**:
   - HTML emails with styled templates
   - Plain text fallback for email clients that don't support HTML
   - Responsive design for mobile devices

5. **Testing**: After adding the secrets, test the invitation flow:
   - Go to Team page
   - Send an invitation
   - Check that the email is received
   - Verify the invitation link works

## Updating the Edge Function

After adding the secrets, you need to deploy the updated Edge Function:

```bash
# Deploy the send-invitation-email function
supabase functions deploy send-invitation-email
```

Or if deploying via the Supabase dashboard, make sure to redeploy the function after adding the secrets.

## Troubleshooting

If emails are not being sent:

1. **Check the secrets are set correctly**:
   ```bash
   supabase secrets list
   ```

2. **Check the Edge Function logs**:
   - Go to Supabase Dashboard → Edge Functions → send-invitation-email
   - View the logs for any error messages

3. **Common issues**:
   - Wrong port (use 465, not 993 which is for IMAP)
   - Incorrect password
   - Firewall blocking outbound connections on port 465
   - Email provider rate limiting

4. **System logs**: Check the System Logs page in the application for detailed error information including SMTP connection errors.

## Migration from Resend

The old `RESEND_API_KEY` environment variable is no longer used and can be removed once you confirm SMTP is working correctly.
