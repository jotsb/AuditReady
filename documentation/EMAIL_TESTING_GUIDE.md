# Email Deliverability Testing Guide

## Step 1: Verify DNS Configuration (2 minutes)

### Option A: Use the Automated Script
```bash
./check-dns.sh
```

This will check if all DNS records (SPF, DKIM, DMARC, MX) are properly configured.

### Option B: Online DNS Checker
1. Visit: https://mxtoolbox.com/SuperTool.aspx
2. Enter: `auditproof.ca`
3. Check each type:
   - SPF Record Lookup
   - DKIM Record Lookup (use `default._domainkey.auditproof.ca`)
   - DMARC Record Lookup
   - MX Lookup

### Option C: Manual Command Line
```bash
# Check SPF
dig TXT auditproof.ca +short | grep spf

# Check DKIM (adjust selector if needed)
dig TXT default._domainkey.auditproof.ca +short

# Check DMARC
dig TXT _dmarc.auditproof.ca +short

# Check MX
dig MX auditproof.ca +short
```

**Expected Results:**
- ✅ SPF: Should contain `v=spf1 include:_spf.privateemail.com`
- ✅ DKIM: Should contain `v=DKIM1; k=rsa; p=`
- ✅ DMARC: Should contain `v=DMARC1; p=quarantine` or `p=reject`
- ✅ MX: Should point to `mail.privateemail.com`

---

## Step 2: Deploy Updated Edge Function (3 minutes)

The Edge Function has been updated with anti-spam headers. You need to deploy it:

### Check if Function Needs Update
The updated function includes these anti-spam headers:
- Message-ID
- Reply-To
- X-Mailer
- List-Unsubscribe
- X-Priority

### Deploy via Supabase Dashboard
1. Go to Supabase Dashboard
2. Navigate to **Edge Functions**
3. Find `send-invitation-email`
4. Click **Deploy** or **Redeploy**
5. Wait for deployment to complete

### Or Deploy via CLI (if available)
```bash
supabase functions deploy send-invitation-email
```

---

## Step 3: Test Email Deliverability (5 minutes)

### Test 1: Mail-Tester.com (Most Important)

This gives you a spam score out of 10.

**Steps:**
1. Visit: https://www.mail-tester.com/
2. Copy the unique test email address shown (e.g., `test-abc123@mail-tester.com`)
3. Go to your application
4. Navigate to the **Team** page
5. Click **Invite Team Member**
6. Enter the mail-tester email address
7. Select any role (e.g., "Employee")
8. Send the invitation
9. Go back to mail-tester.com
10. Click **Then check your score**

**What to Look For:**
- 🎯 **Target Score**: 9/10 or 10/10
- ✅ SPF: PASS
- ✅ DKIM: PASS
- ✅ DMARC: PASS
- ✅ No spam keywords detected
- ✅ Valid HTML structure
- ✅ No blacklist issues

**If Score is Low:**
- Check which tests failed
- Review the detailed feedback
- Fix issues mentioned
- Wait 15 minutes and test again

---

### Test 2: Real Email Test

**Steps:**
1. Send invitation to your own Gmail address
2. Check if it arrives in **Inbox** or **Spam**
3. Open the email
4. Click the **three dots** (⋮) in Gmail
5. Select **Show original**
6. Look for authentication results:

```
spf=pass
dkim=pass
dmarc=pass
```

**Test Multiple Providers:**
- Gmail (most strict)
- Outlook/Hotmail
- Yahoo Mail
- Apple Mail (iCloud)

---

### Test 3: Check Email Headers

When you receive the test email:

**In Gmail:**
1. Open the email
2. Click three dots (⋮)
3. Select "Show original"
4. Look for these sections:

```
Authentication-Results:
    spf=pass smtp.mailfrom=auditproof.ca
    dkim=pass header.d=auditproof.ca
    dmarc=pass header.from=auditproof.ca
```

**What Each Means:**
- `spf=pass`: Server is authorized to send
- `dkim=pass`: Email signature is valid
- `dmarc=pass`: Alignment policy passed

**If Any Fail:**
- `spf=fail`: Check SPF DNS record
- `dkim=fail`: Check DKIM DNS record or PrivateEmail config
- `dmarc=fail`: Check DMARC policy and SPF/DKIM alignment

---

## Step 4: Verify SMTP Secrets (if emails aren't sending)

### Check Supabase Secrets

1. Go to Supabase Dashboard
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Verify these secrets exist:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASSWORD`

### Check Edge Function Logs

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions**
3. Click on `send-invitation-email`
4. View **Logs**
5. Look for errors like:
   - Connection refused
   - Authentication failed
   - Timeout errors

---

## Step 5: End-to-End Test (5 minutes)

### Full Invitation Flow Test

1. **Create Test User Account** (if needed)
2. **Go to Team Page** in your app
3. **Send Invitation**:
   - Enter a real email you have access to
   - Select role: "Employee" or "Manager"
   - Click Send Invitation
4. **Check Application Response**:
   - Should show success message
   - No error alerts
5. **Check Email Inbox**:
   - Email should arrive within 1-2 minutes
   - Should be in Inbox (not Spam)
   - Email should look professional
6. **Click Invitation Link**:
   - Should redirect to accept invitation page
   - Should work properly
7. **Accept Invitation**:
   - Complete the signup/login flow
   - Verify user is added to team

---

## Step 6: Check System Logs

Your application logs all email operations.

**Steps:**
1. Log into your application as admin
2. Go to **System Logs** page
3. Filter by:
   - Category: `EXTERNAL_API`
   - Message contains: `invitation`
4. Look for:
   - "Invitation email sent successfully via SMTP"
   - Any error messages

**Common Errors and Solutions:**

| Error | Cause | Solution |
|-------|-------|----------|
| Connection refused | Wrong port or blocked | Use port 465, check firewall |
| Authentication failed | Wrong credentials | Verify SMTP_USER and SMTP_PASSWORD |
| SMTP not configured | Missing secrets | Add SMTP secrets in Supabase |
| SSL/TLS error | Certificate issue | Verify SSL is enabled, port 465 |

---

## Troubleshooting Guide

### Issue: Email Goes to Spam

**Quick Checks:**
1. Run `./check-dns.sh` - all records present?
2. Check mail-tester.com score - below 8?
3. View email headers - any FAIL results?
4. Check domain reputation - blacklisted?

**Solutions:**
- Wait 24-48 hours for DNS propagation
- Ensure all three records (SPF, DKIM, DMARC) are configured
- Contact PrivateEmail to verify DKIM is enabled
- Check content for spam trigger words

### Issue: Email Not Sending

**Quick Checks:**
1. Edge Function logs show errors?
2. SMTP secrets configured in Supabase?
3. System Logs show SMTP errors?

**Solutions:**
- Verify SMTP_HOST=mail.privateemail.com
- Verify SMTP_PORT=465 (not 993)
- Verify SMTP_USER=contact@auditproof.ca
- Check SMTP_PASSWORD is correct
- Redeploy Edge Function

### Issue: Email Delayed

**Normal Delays:**
- 30 seconds - 2 minutes: Normal
- 2-5 minutes: Acceptable
- 5-15 minutes: DNS propagation or greylisting
- 15+ minutes: Problem

**Solutions:**
- Check Supabase Edge Function logs
- Verify PrivateEmail service status
- Check recipient's email provider for delays

---

## Success Criteria Checklist

After testing, you should have:

- [ ] DNS records verified (SPF, DKIM, DMARC)
- [ ] Mail-tester score: 9/10 or 10/10
- [ ] Test emails arrive in Inbox (not Spam)
- [ ] Email headers show: spf=pass, dkim=pass, dmarc=pass
- [ ] Edge Function deploys without errors
- [ ] SMTP secrets configured in Supabase
- [ ] Full invitation flow works end-to-end
- [ ] System Logs show successful sends
- [ ] Emails have professional appearance
- [ ] Invitation links work correctly

---

## Ongoing Monitoring

### Daily (First Week)
- Send test invitations
- Check if they land in Inbox
- Monitor System Logs for errors

### Weekly
- Check DMARC reports at dmarc@auditproof.ca
- Review spam complaints (should be zero)
- Monitor delivery rates

### Monthly
- Run mail-tester.com check
- Verify DNS records haven't changed
- Check domain not on blacklists

---

## Quick Reference Commands

```bash
# Check all DNS records
./check-dns.sh

# Check SPF
dig TXT auditproof.ca +short | grep spf

# Check DKIM
dig TXT default._domainkey.auditproof.ca +short

# Check DMARC
dig TXT _dmarc.auditproof.ca +short

# Test deliverability
# Visit: https://www.mail-tester.com/

# Check if blacklisted
# Visit: https://mxtoolbox.com/blacklists.aspx
```

---

## Support Resources

- **Mail-Tester**: https://www.mail-tester.com/
- **MXToolbox**: https://mxtoolbox.com/
- **Google Admin Toolbox**: https://toolbox.googleapps.com/apps/checkmx/
- **DMARC Analyzer**: https://dmarc.postmarkapp.com/

Need help? Check:
- EMAIL_DELIVERABILITY_GUIDE.md (detailed DNS setup)
- SMTP_SETUP.md (SMTP configuration)
- QUICK_FIX_SPAM.md (quick fixes)
