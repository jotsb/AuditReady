# Quick Fix for Spam Folder Issues

## Immediate Actions Required

### 1. Add DNS Records in Cloudflare (5 minutes)

Log into Cloudflare → Select auditproof.ca → DNS → Add these 3 TXT records:

#### SPF Record
```
Type: TXT
Name: @
Content: v=spf1 include:_spf.privateemail.com ~all
TTL: Auto
```

#### DMARC Record
```
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=quarantine; rua=mailto:dmarc@auditproof.ca; pct=100
TTL: Auto
```

#### DKIM Record
You need to get this from PrivateEmail:
1. Log into PrivateEmail control panel
2. Find DKIM settings for auditproof.ca
3. Copy the DKIM TXT record
4. Add it to Cloudflare DNS

```
Type: TXT
Name: default._domainkey (or selector provided by PrivateEmail)
Content: v=DKIM1; k=rsa; p=MIGfM... (long key from PrivateEmail)
TTL: Auto
```

### 2. Verify DNS Configuration (1 minute)

Run the check script:
```bash
./check-dns.sh
```

Or check online:
- https://mxtoolbox.com/spf.aspx
- https://mxtoolbox.com/dmarc.aspx
- Enter domain: auditproof.ca

### 3. Test Email Deliverability (2 minutes)

1. Visit: https://www.mail-tester.com/
2. Copy the test email address provided
3. Send a test invitation to that address from your app
4. Go back and check your score
5. **Target: 9/10 or 10/10**

### 4. Deploy Updated Edge Function

The code has been updated with anti-spam headers. Deploy it:

```bash
supabase functions deploy send-invitation-email
```

Or use the Supabase dashboard to redeploy the function.

## Why Emails Go to Spam

Without proper DNS records, email providers can't verify:
- ✅ SPF: "Is this server allowed to send for auditproof.ca?"
- ✅ DKIM: "Is this email authentic and unmodified?"
- ✅ DMARC: "What should I do if SPF/DKIM fail?"

**Missing any of these = High chance of spam folder**

## Expected Results

- **Before DNS setup**: 3-5/10 spam score → spam folder
- **After DNS setup**: 9-10/10 spam score → inbox

## Timeline

- DNS propagation: 5 minutes to 48 hours
- Most changes visible within: 15-30 minutes
- Full propagation: 24 hours

## Common Mistakes to Avoid

❌ Using port 993 (that's IMAP, not SMTP)
❌ Forgetting to enable DKIM in PrivateEmail
❌ Not updating DNS after getting DKIM key
❌ Setting DMARC to p=reject immediately (use p=quarantine first)

## If Still Going to Spam After DNS Setup

1. **Wait 24 hours** for DNS propagation
2. **Check email headers** - look for SPF: PASS, DKIM: PASS, DMARC: PASS
3. **Review content** - avoid spam trigger words
4. **Build reputation** - start with low volume, increase gradually
5. **Check blacklists**: https://mxtoolbox.com/blacklists.aspx

## Need Help?

See detailed guides:
- **SMTP_SETUP.md** - SMTP configuration
- **EMAIL_DELIVERABILITY_GUIDE.md** - Complete DNS setup
- **check-dns.sh** - Automated DNS verification

## Pro Tips

- Use mail-tester.com after every change
- Monitor DMARC reports at dmarc@auditproof.ca
- Keep email content professional
- Avoid all caps, excessive punctuation!!!
- Include unsubscribe option (already done in code)
