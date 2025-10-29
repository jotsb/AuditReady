# How to Add SMTP Password (PrivateMail)

After running the deployment, follow these steps to add your SMTP password:

## Step 1: Edit the Secrets File

```bash
ssh root@192.168.1.246
cd /mnt/user/appdata/auditproof
vim secrets.txt
```

## Step 2: Find the SMTP Section

Look for:
```
# Email (SMTP)
SMTP_ADMIN_EMAIL=contact@auditproof.ca
SMTP_HOST=mail.privateemail.com
SMTP_PORT=587
SMTP_USER=contact@auditproof.ca
SMTP_PASS=
SMTP_SENDER_NAME=AuditProof
```

## Step 3: Add Your Password

Replace the empty `SMTP_PASS=` with:
```
SMTP_PASS=uest1onQ?
```

So it looks like:
```
SMTP_PASS=uest1onQ?
```

## Step 4: Regenerate Environment Files

```bash
cd /mnt/user/appdata/auditproof/project/AuditReady/infrastructure-scripts
./04-configure-env.sh
```

This will update both .env files with your SMTP password.

## Step 5: Restart Services

```bash
./09-start-services.sh
```

This restarts the services to pick up the new SMTP configuration.

## Step 6: Test Email

Test that emails work:

1. Go to https://test.auditproof.ca
2. Try "Forgot Password" or user invitation
3. Check that emails are sent successfully

## Security Note

- The password is stored in `secrets.txt` with 600 permissions (only root can read)
- Never commit `secrets.txt` to git
- Backup `secrets.txt` securely

## Credentials Summary

```
Email Account: contact@auditproof.ca
SMTP Host:     mail.privateemail.com
SMTP Port:     587 (TLS)
Username:      contact@auditproof.ca
Password:      uest1onQ?
```

## Troubleshooting

If emails don't send:

1. **Check credentials in .env**:
   ```bash
   grep SMTP /mnt/user/appdata/auditproof/supabase-project/.env
   ```

2. **Check GoTrue logs**:
   ```bash
   docker logs supabase-auth | grep -i smtp
   ```

3. **Test SMTP connection**:
   ```bash
   telnet mail.privateemail.com 587
   ```

4. **Verify PrivateMail settings**:
   - Login to PrivateMail
   - Check that SMTP is enabled
   - Verify sending limits not exceeded

---

**Created**: 2025-10-29
**Account**: contact@auditproof.ca
**Status**: Configured, password to be added post-deployment
