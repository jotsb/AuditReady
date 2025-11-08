# Email Invitations Deployment Guide for Self-Hosted Supabase

## Overview

This guide will help you configure email invitations for your self-hosted AuditProof instance on Unraid. The system requires SMTP credentials to send invitation emails to team members.

## Problem Symptoms

If email invitations are not working, you may see:
- ✗ Frontend shows "Invitation sent successfully" but no email arrives
- ✗ Console shows 429 (Too Many Requests) errors
- ✗ System logs show "Edge function send-invitation-email: success" but no SMTP logs
- ✗ No emails in recipient inbox or spam folder

## Root Cause

The edge function returns "success" even when SMTP is not configured, making it appear as if emails were sent when they actually weren't.

## Solution: Configure SMTP

### Step 1: Choose an SMTP Provider

#### Option A: Gmail (Easiest for Testing)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # NOT your regular password!
```

**Important**: Create an [App Password](https://myaccount.google.com/apppasswords) in Gmail.

#### Option B: Your Domain Email
```bash
SMTP_HOST=mail.auditproof.ca
SMTP_PORT=465
SMTP_USER=noreply@auditproof.ca
SMTP_PASSWORD=your-password
```

#### Option C: SendGrid/Mailgun/Other
Refer to your provider's SMTP documentation.

---

### Step 2: Configure SMTP (Choose ONE method)

#### Method 1: Interactive Configuration Script (Recommended)

```bash
cd /path/to/auditproof
./scripts/configure-smtp-unraid.sh
```

This script will:
- Prompt you for SMTP credentials
- Create `.env.functions` file with your configuration
- Generate docker-compose snippet
- Provide deployment instructions

#### Method 2: Manual docker-compose.yml Configuration

1. Edit your Supabase `docker-compose.yml`:

```yaml
services:
  functions:
    image: supabase/edge-runtime:latest
    environment:
      # Existing variables
      - SUPABASE_URL=http://kong:8000
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

      # Add these SMTP variables
      - SMTP_HOST=smtp.gmail.com
      - SMTP_PORT=465
      - SMTP_USER=your-email@gmail.com
      - SMTP_PASSWORD=your-app-password
      - FRONTEND_URL=https://test.auditproof.ca
```

2. Restart the functions container:
```bash
docker-compose restart functions
```

#### Method 3: Unraid Docker Template

1. Go to **Docker** tab in Unraid
2. Click on your **Supabase edge-runtime** container
3. Click **Edit**
4. Add these environment variables:
   - Name: `SMTP_HOST`, Value: `smtp.gmail.com`
   - Name: `SMTP_PORT`, Value: `465`
   - Name: `SMTP_USER`, Value: `your-email@gmail.com`
   - Name: `SMTP_PASSWORD`, Value: `your-app-password`
   - Name: `FRONTEND_URL`, Value: `https://test.auditproof.ca`
5. Click **Apply** and restart the container

---

### Step 3: Deploy Updated Edge Function

The edge function has been updated to:
- Return proper error when SMTP is not configured
- Log missing SMTP variables for debugging
- Increase rate limit from 3 to 20 emails per hour

Deploy the updated function:

```bash
# Copy the updated edge function to your server
scp -r supabase/functions/send-invitation-email your-server:/path/to/supabase/functions/

# SSH into your server
ssh your-server

# Navigate to Supabase directory
cd /path/to/supabase

# Restart the functions container
docker-compose restart functions
```

---

### Step 4: Deploy Updated Frontend

```bash
# Build is already done in dist/ folder
# Copy to your web server
sudo cp -r dist/* /var/www/auditproof/

# Or if using Docker
docker cp dist/. auditproof-frontend:/app/dist/
```

---

### Step 5: Verify Configuration

Run the verification script:

```bash
./scripts/verify-smtp-config.sh
```

Expected output:
```
✓ All SMTP variables are configured:
  SMTP_HOST: smtp.gmail.com
  SMTP_PORT: 465
  SMTP_USER: your-email@gmail.com
  SMTP_PASSWORD: [HIDDEN]

✓ Successfully connected to smtp.gmail.com:465

SMTP configuration is complete!
```

---

### Step 6: Check System Logs

After configuring SMTP, check the logs to confirm it's working:

```sql
SELECT
  level,
  category,
  message,
  metadata,
  created_at
FROM system_logs
WHERE category = 'EDGE_FUNCTION'
  AND message LIKE '%SMTP%'
ORDER BY created_at DESC
LIMIT 10;
```

**Before configuration** (ERROR):
```
ERROR | EDGE_FUNCTION | SMTP credentials not configured - emails cannot be sent
```

**After configuration** (INFO):
```
INFO | EXTERNAL_API | Sending invitation email via SMTP
```

---

### Step 7: Test Email Sending

1. Log in to AuditProof: `https://test.auditproof.ca`
2. Go to **Team** page
3. Click **Invite Team Member**
4. Enter an email address and select a role
5. Click **Send Invitation**

**Expected behavior:**
- ✓ Success message appears
- ✓ Email arrives in recipient's inbox (check spam folder)
- ✓ Email contains correct link: `https://test.auditproof.ca/accept-invite?token=...`
- ✓ System logs show "Sending invitation email via SMTP"

---

## Troubleshooting

### Issue: Still getting 429 errors

**Solution**: Clear the rate limit cache:

```sql
DELETE FROM rate_limit_attempts
WHERE action_type = 'email';
```

Then restart the edge functions container.

---

### Issue: "Email service not configured" error

**Symptoms**:
- Frontend shows error message
- System logs show: "SMTP credentials not configured - emails cannot be sent"

**Solution**:
1. Verify SMTP environment variables are set in edge functions container:
```bash
docker exec supabase-functions env | grep SMTP
```

2. If variables are missing, add them using one of the methods in Step 2
3. Restart the container

---

### Issue: Email not arriving

**Possible causes:**

1. **SMTP credentials are wrong**
   - Verify username/password
   - For Gmail, ensure you're using an App Password

2. **Port is blocked**
   - Try port 587 instead of 465
   - Check firewall rules

3. **Email in spam folder**
   - Check recipient's spam/junk folder
   - Consider using a dedicated email service (SendGrid, etc.)

4. **SMTP server unreachable**
   - Test connection: `nc -zv smtp.gmail.com 465`
   - Check DNS resolution: `nslookup smtp.gmail.com`

---

### Issue: "Failed to fetch" errors

**Solution**: Check that edge function URL is correct:

```javascript
// Should be:
https://test.auditproof.ca/functions/v1/send-invitation-email

// NOT:
https://new-chat-5w59.bolt.host/functions/v1/send-invitation-email
```

---

## Rate Limiting

The system has rate limiting to prevent abuse:

- **Limit**: 20 emails per hour per IP address
- **Purpose**: Prevent spam and protect SMTP server
- **Reset**: Automatic after 1 hour

To temporarily clear rate limits for testing:

```sql
DELETE FROM rate_limit_attempts WHERE action_type = 'email';
```

---

## Security Best Practices

1. **Use App Passwords** (not your main password)
2. **Store credentials securely** (don't commit to git)
3. **Use environment variables** (not hardcoded)
4. **Enable 2FA** on SMTP email account
5. **Use a dedicated email** for system notifications
6. **Monitor SMTP logs** for suspicious activity

---

## Files Changed

### Edge Function
- `/supabase/functions/send-invitation-email/index.ts`
  - Fixed hardcoded URL to use `FRONTEND_URL` environment variable
  - Increased rate limit from 3 to 20 emails/hour
  - Return error (500) instead of success (200) when SMTP not configured
  - Enhanced logging with missing variables list

### Frontend
- `/src/App.tsx`
  - Added `/auth` route handler to fix browser authentication dialog

### Scripts (New)
- `/scripts/configure-smtp-unraid.sh` - Interactive SMTP configuration
- `/scripts/verify-smtp-config.sh` - Verify SMTP is configured correctly

---

## Quick Reference

### Environment Variables Required
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FRONTEND_URL=https://test.auditproof.ca
```

### Restart Commands
```bash
# docker-compose
docker-compose restart functions

# Docker
docker restart supabase-functions

# Unraid
# Use Docker tab in UI to restart container
```

### Verification Query
```sql
SELECT level, message, metadata
FROM system_logs
WHERE category = 'EXTERNAL_API'
  AND message LIKE '%SMTP%'
ORDER BY created_at DESC
LIMIT 5;
```

---

## Support

If you continue to have issues:

1. Check system logs in the Admin panel
2. Run `./scripts/verify-smtp-config.sh`
3. Verify edge function is deployed
4. Check Docker container logs: `docker logs supabase-functions`
5. Test SMTP connection manually with `telnet` or `nc`

---

## Next Steps

After email invitations are working:

1. Test both new user and existing user invitation flows
2. Configure email templates in Supabase (optional)
3. Set up monitoring for email delivery
4. Consider using a dedicated email service for production
5. Configure SPF/DKIM/DMARC records for your domain (prevents spam)

---

**Last Updated**: 2025-11-08
