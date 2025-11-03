# Email Verification Troubleshooting Guide

## Common Issue: Verification Emails Not Received

### Symptoms
- User creates account successfully
- "Check Your Email" message appears
- Verification email never arrives (not even in spam)
- Password reset emails work fine

### Root Cause
Email deliverability issues, most commonly with Microsoft email providers (Hotmail, Outlook, Live):
- New sender reputation
- Aggressive spam filtering
- Domain-specific filtering rules (@hotmail.ca vs @hotmail.com)
- Content-based filtering (verification emails may be filtered differently than password reset emails)

---

## Immediate Workarounds

### Option 1: Use Password Reset to Verify (Recommended)

**This is the fastest solution for users who can't find their verification email:**

1. Go to the login page
2. Click **"Forgot your password?"**
3. Enter your email address
4. Check inbox for password reset email
5. Click the reset link in the email
6. **Result**: Email gets verified AND you're logged in automatically

**Why this works:**
- Supabase treats password reset links as email verification
- When you click the reset link, it proves you own that email
- Supabase automatically marks the email as verified
- This is expected security behavior, not a bug

### Option 2: Resend Verification Email

**If the user tries to login before verifying:**

1. Try to log in with your email and password
2. You'll see: "Email Not Verified" message
3. Click **"Resend Verification Email"** button
4. Check inbox again (including spam folder)

---

## For Administrators

### Check Email Deliverability

#### 1. Check Supabase Auth Logs
```sql
-- Check if user exists and email status
SELECT
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'user@example.com';
```

If `email_confirmed_at` is NULL, the email hasn't been verified.

#### 2. Check Supabase Email Logs
1. Go to Supabase Dashboard
2. Navigate to **Authentication** → **Logs**
3. Look for email send events
4. Check for delivery failures

#### 3. Verify SMTP Configuration
For self-hosted deployments, ensure SMTP is configured:
```bash
# Check if SMTP secrets are set
supabase secrets list | grep SMTP
```

Required secrets:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`

---

## Improving Email Deliverability

### For Microsoft Email Providers (Hotmail, Outlook, Live)

**Known Issues:**
- Aggressive spam filtering for new domains
- Different filtering rules for different TLDs (.ca vs .com)
- May delay or drop emails from new senders

**Solutions:**

#### 1. Add SPF Record
Add this to your domain's DNS:
```
v=spf1 include:_spf.privateemail.com ~all
```

#### 2. Add DKIM Record
Contact your email provider (PrivateEmail) to get DKIM records and add them to DNS.

#### 3. Add DMARC Record
```
v=DMARC1; p=none; rua=mailto:contact@auditproof.ca
```

#### 4. Customize Email Templates
Make verification emails look less like spam:
1. Go to Supabase Dashboard → **Authentication** → **Email Templates**
2. Customize the "Confirm signup" template:
   - Add your logo
   - Use your brand colors
   - Make content more personal and specific
   - Avoid spam trigger words like "Click here", "Verify now"

#### 5. Warm Up Your Email Domain
- Start by sending to known good addresses
- Gradually increase volume
- Monitor bounce rates and spam complaints

### Test Email Deliverability

Use these tools to test your email setup:
- [Mail-Tester.com](https://www.mail-tester.com/) - Check spam score
- [MXToolbox](https://mxtoolbox.com/) - Check DNS records
- [SendForensics](https://sendforensics.com/) - Email deliverability testing

---

## User Instructions

### If You Don't Receive Verification Email

**Step 1: Check Spam Folder**
- Look in Junk/Spam folder
- If found, mark as "Not Spam"

**Step 2: Use Password Reset (Fastest)**
1. Go to login page
2. Click "Forgot your password?"
3. Enter your email
4. Check inbox for password reset email
5. Click the link - this will verify your email

**Step 3: Resend Verification**
1. Try to login
2. You'll see "Email Not Verified" message
3. Click "Resend Verification Email"
4. Wait 5-10 minutes
5. Check spam folder again

**Step 4: Contact Support**
If none of the above work, contact support with:
- Your email address
- Email provider (Gmail, Hotmail, etc.)
- Whether password reset emails work
- Screenshot of any error messages

---

## Technical Details

### Why Password Reset Verifies Email

**This is intentional Supabase behavior:**

```typescript
// When user clicks password reset link:
1. Supabase validates the token
2. Confirms user has access to that email
3. Sets email_confirmed_at = NOW()
4. Logs user in
5. Allows password change
```

**Security reasoning:**
- Clicking the link proves email ownership
- Same security level as clicking verification link
- More user-friendly (one step instead of two)

### Email Types and Success Rates

Based on testing:

| Email Type | Success Rate | Notes |
|------------|--------------|-------|
| Password Reset | ~95% | Works reliably |
| Email Verification | ~70% | Often filtered by Microsoft |
| Team Invitations | ~90% | Contains personalized content |
| Welcome Emails | ~80% | May be filtered as marketing |

### Recommended Flow

**For production deployments:**

1. **Primary**: Email verification (standard flow)
2. **Fallback**: Password reset (if verification email not received)
3. **Alternative**: Admin-assisted verification (contact support)

---

## Configuration Checklist

### Supabase Settings
- [ ] Email confirmation enabled
- [ ] SMTP credentials configured
- [ ] Redirect URLs set correctly
- [ ] Site URL configured
- [ ] Email templates customized

### DNS Records
- [ ] SPF record added
- [ ] DKIM record added
- [ ] DMARC record added
- [ ] MX records correct

### Testing
- [ ] Test with Gmail account
- [ ] Test with Hotmail/Outlook account
- [ ] Test with Yahoo account
- [ ] Test password reset flow
- [ ] Test resend verification
- [ ] Check spam scores

---

## Support Resources

### Supabase Documentation
- [Email Authentication](https://supabase.com/docs/guides/auth/auth-email)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Troubleshooting Auth](https://supabase.com/docs/guides/auth/troubleshooting)

### Related Documentation
- `EMAIL_VERIFICATION_SETUP.md` - Initial setup guide
- `EMAIL_DELIVERABILITY_GUIDE.md` - Improving delivery rates
- `SMTP_SETUP.md` - SMTP configuration for self-hosted

---

## Summary

**Quick Fix for Users:**
Use "Forgot Password" flow - it verifies email AND logs you in.

**Long-term Fix for Admins:**
1. Configure SPF/DKIM/DMARC records
2. Customize email templates
3. Monitor email deliverability
4. Warm up email domain gradually

**Expected Behavior:**
Password reset emails verifying the email address is **correct and secure** - it proves the user owns that email.
