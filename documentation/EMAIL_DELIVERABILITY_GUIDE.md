# Email Deliverability Guide

This guide helps you configure your DNS settings to prevent emails from being marked as spam.

## Critical DNS Records Required

### 1. SPF (Sender Policy Framework)

SPF tells receiving servers which mail servers are allowed to send email for your domain.

**Add this TXT record to your DNS in Cloudflare:**

```
Type: TXT
Name: @ (or auditproof.ca)
Content: v=spf1 include:_spf.privateemail.com ~all
TTL: Auto
```

**Explanation:**
- `v=spf1` - SPF version
- `include:_spf.privateemail.com` - Authorizes PrivateEmail servers
- `~all` - Soft fail for other servers (marks as suspicious but doesn't reject)

### 2. DKIM (DomainKeys Identified Mail)

DKIM adds a digital signature to your emails to verify they haven't been tampered with.

**Steps to set up DKIM:**

1. Log into your PrivateEmail control panel
2. Navigate to Email → DKIM Settings
3. Generate a DKIM key for auditproof.ca
4. You'll receive a DNS record like this:

```
Type: TXT
Name: default._domainkey (or the selector provided by PrivateEmail)
Content: v=DKIM1; k=rsa; p=MIGfMA0GCSq... (long public key)
TTL: Auto
```

5. Add this record to Cloudflare DNS

### 3. DMARC (Domain-based Message Authentication)

DMARC tells receiving servers what to do with emails that fail SPF or DKIM checks.

**Add this TXT record to your DNS in Cloudflare:**

```
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=quarantine; rua=mailto:dmarc@auditproof.ca; ruf=mailto:dmarc@auditproof.ca; pct=100
TTL: Auto
```

**Explanation:**
- `v=DMARC1` - DMARC version
- `p=quarantine` - Quarantine failed emails (starts lenient, can move to `reject` later)
- `rua=mailto:dmarc@auditproof.ca` - Send aggregate reports here
- `ruf=mailto:dmarc@auditproof.ca` - Send forensic reports here
- `pct=100` - Apply policy to 100% of emails

### 4. Reverse DNS (PTR Record)

This is typically set by your email provider (PrivateEmail). Verify with them that:
- The IP address sending your emails has a PTR record
- The PTR record points back to mail.privateemail.com

## Verification Steps

### Check Current DNS Records

Use these online tools to verify your DNS configuration:

1. **MXToolbox** (https://mxtoolbox.com/)
   - Check SPF: https://mxtoolbox.com/spf.aspx
   - Check DKIM: https://mxtoolbox.com/dkim.aspx
   - Check DMARC: https://mxtoolbox.com/dmarc.aspx

2. **Mail Tester** (https://www.mail-tester.com/)
   - Send a test email to the provided address
   - Get a spam score out of 10
   - See specific issues to fix

3. **Google Admin Toolbox** (https://toolbox.googleapps.com/apps/checkmx/)
   - Enter auditproof.ca
   - Check all records at once

### Command Line Verification

```bash
# Check SPF
dig TXT auditproof.ca +short

# Check DKIM (replace 'default' with your selector)
dig TXT default._domainkey.auditproof.ca +short

# Check DMARC
dig TXT _dmarc.auditproof.ca +short

# Check MX records
dig MX auditproof.ca +short
```

## Email Content Best Practices

The code has been updated with these anti-spam measures:

### Headers Added:
- `X-Mailer`: Identifies the sending application
- `Message-ID`: Unique identifier for each email
- `Reply-To`: Where replies should go
- `List-Unsubscribe`: Helps email clients show unsubscribe options
- `X-Priority`: Normal priority (spam often has high priority)

### Content Guidelines:
- ✅ Professional HTML templates
- ✅ Plain text alternative included
- ✅ No excessive links
- ✅ Clear sender identity
- ✅ Legitimate business purpose

## Common Issues and Solutions

### Issue: Emails still going to spam

**Check:**
1. SPF record is properly configured
2. DKIM is enabled and DNS record is added
3. DMARC policy is set
4. Your domain is not on any blacklists (check at https://mxtoolbox.com/blacklists.aspx)
5. Email content doesn't trigger spam filters (avoid all caps, excessive exclamation marks, spam words)

### Issue: SPF "too many DNS lookups"

If you have multiple services sending email, you might hit the 10 DNS lookup limit.

**Solution:** Use SPF flattening services or consolidate your email sending through fewer services.

### Issue: DKIM not validating

**Check:**
1. DKIM record was copied correctly (no spaces or line breaks)
2. Wait for DNS propagation (up to 48 hours)
3. Verify the selector name matches what PrivateEmail provided

### Issue: Different spam behavior across providers

- **Gmail**: Very strict, requires all three (SPF, DKIM, DMARC)
- **Outlook/Hotmail**: Moderate, SPF + DKIM usually sufficient
- **Yahoo**: Requires DMARC
- **Apple Mail**: Usually lenient

## Monitoring and Maintenance

### Set Up DMARC Reports

1. Create a dedicated email: `dmarc@auditproof.ca`
2. You'll receive daily/weekly XML reports showing:
   - How many emails were sent
   - How many passed/failed SPF/DKIM
   - Which IPs are sending on your behalf

3. Use DMARC report analyzers:
   - Postmark DMARC Digests (https://dmarc.postmarkapp.com/)
   - Dmarcian (https://dmarcian.com/)

### Warm Up Your Domain

If this is a new sending domain:
1. Start with low volume (5-10 emails/day)
2. Gradually increase over 2-4 weeks
3. Monitor spam complaints
4. Build sender reputation gradually

### Regular Checks

- Monthly: Check your domain isn't blacklisted
- Quarterly: Review DMARC reports
- Annually: Rotate DKIM keys

## Testing Your Configuration

After setting up DNS records:

1. **Send a test email** from your application
2. **Check email headers** in the received email:
   ```
   SPF: PASS
   DKIM: PASS
   DMARC: PASS
   ```

3. **View full headers** (in Gmail: Show original)
   - Look for "spf=pass"
   - Look for "dkim=pass"
   - Look for "dmarc=pass"

4. **Use mail-tester.com**:
   - Send test email to the provided address
   - Aim for 9/10 or 10/10 score

## Example: Complete Cloudflare DNS Setup

Here's what your DNS records should look like in Cloudflare:

| Type | Name | Content |
|------|------|---------|
| TXT | @ | v=spf1 include:_spf.privateemail.com ~all |
| TXT | default._domainkey | v=DKIM1; k=rsa; p=MIGfMA0GCS... (from PrivateEmail) |
| TXT | _dmarc | v=DMARC1; p=quarantine; rua=mailto:dmarc@auditproof.ca |
| MX | @ | mail.privateemail.com (Priority: 10) |
| A | mail | (IP provided by PrivateEmail) |

## Progressive DMARC Policy

Start lenient, then tighten:

**Week 1-2:**
```
v=DMARC1; p=none; rua=mailto:dmarc@auditproof.ca
```
(Monitor only, don't reject/quarantine)

**Week 3-4:**
```
v=DMARC1; p=quarantine; pct=50; rua=mailto:dmarc@auditproof.ca
```
(Quarantine 50% of failures)

**Week 5+:**
```
v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@auditproof.ca
```
(Quarantine all failures)

**After confidence:**
```
v=DMARC1; p=reject; pct=100; rua=mailto:dmarc@auditproof.ca
```
(Reject all failures - most strict)

## Support Resources

- **PrivateEmail Support**: Contact them to ensure DKIM is properly configured
- **Cloudflare Support**: For DNS configuration issues
- **Email deliverability forums**: For complex issues

## Expected Timeline

- DNS changes: 5 minutes - 48 hours to propagate
- Reputation building: 2-4 weeks for consistent delivery
- Full trust: 2-3 months for maximum deliverability

Remember: Email deliverability is an ongoing process, not a one-time setup!
