# Unraid Setup Scripts

Automated configuration scripts for your Audit Proof self-hosted installation.

## Your Configuration

- **Unraid IP:** 192.168.1.246
- **Domain:** test.auditproof.ca
- **SWAG IP:** 192.168.1.65

---

## Scripts Overview

### 1. `update-supabase-env.sh`
Updates your Supabase backend `.env` file with production-ready values.

**What it does:**
- ✅ Updates all URLs to use your domain (`test.auditproof.ca`)
- ✅ Configures SMTP for email (asks for your PrivateEmail password)
- ✅ Generates encryption keys (if missing)
- ✅ Adds Edge Functions environment variables
- ✅ Creates backup before making changes
- ✅ Optionally restarts Supabase services

### 2. `update-frontend-env.sh`
Updates your frontend `.env.production` and rebuilds the application.

**What it does:**
- ✅ Reads ANON_KEY from secrets.txt
- ✅ Creates `.env.production` with correct domain
- ✅ Installs dependencies (if needed)
- ✅ Builds frontend with production config
- ✅ Deploys to `/mnt/user/appdata/auditproof/dist/`
- ✅ Optionally restarts frontend container
- ✅ Verifies deployment

---

## Usage Instructions

### Step 1: Copy Scripts to Unraid

**Option A: Via SSH**

```bash
# On your local machine (where you have the project)
scp update-supabase-env.sh root@192.168.1.246:/mnt/user/appdata/auditproof/
scp update-frontend-env.sh root@192.168.1.246:/mnt/user/appdata/auditproof/
```

**Option B: Via Unraid Terminal**

1. Open Unraid web UI → Terminal icon (top right)
2. Navigate to directory:
   ```bash
   cd /mnt/user/appdata/auditproof/
   ```
3. Use `nano` to create the files and paste the script contents

### Step 2: Make Scripts Executable

```bash
ssh root@192.168.1.246
cd /mnt/user/appdata/auditproof/
chmod +x update-supabase-env.sh
chmod +x update-frontend-env.sh
```

### Step 3: Run Supabase Environment Script

```bash
cd /mnt/user/appdata/auditproof/
./update-supabase-env.sh
```

**The script will:**
1. Backup your existing `.env` file
2. Ask for your SMTP password (for email features)
3. Generate encryption keys (if needed)
4. Update all URLs and configurations
5. Ask if you want to restart Supabase services

**Example output:**
```
========================================
Audit Proof Supabase .env Update Script
========================================

Step 1: Validating environment...
✓ Found .env file

Step 2: Creating backup...
✓ Backup created: /mnt/user/appdata/auditproof/supabase-project/.env.backup.20251029_143022

Step 3: SMTP Configuration
Please enter your PrivateEmail SMTP credentials.
(Press Enter to skip and keep existing values)

SMTP Email (default: contact@auditproof.ca):
SMTP Password (required): ********

Step 4: Checking encryption keys...
⚠ Placeholder VAULT_ENC_KEY detected
Generating new encryption keys...
✓ Generated new encryption keys

Step 5: Updating .env file...
✓ .env file updated successfully

Step 6: Adding missing configurations...
Adding Edge Functions environment variables...
✓ Edge Functions configuration added

========================================
Configuration Summary
========================================

✓ Site URL: https://test.auditproof.ca
✓ SMTP Host: mail.privateemail.com:465
✓ SMTP Email: contact@auditproof.ca
✓ Email Auto-Confirm: Enabled (users can login immediately)
✓ Encryption Keys: Generated/Updated
✓ Edge Functions: Environment variables added

Would you like to restart Supabase services now? (y/N): y

Restarting Supabase services...
✓ Supabase services restarted
```

### Step 4: Run Frontend Environment Script

```bash
cd /mnt/user/appdata/auditproof/
./update-frontend-env.sh
```

**The script will:**
1. Read your ANON_KEY from secrets.txt
2. Create `.env.production` with correct configuration
3. Install npm dependencies (if needed)
4. Build the frontend
5. Deploy to production directory
6. Ask if you want to restart the frontend container

**Example output:**
```
========================================
Frontend .env Update Script
========================================

Step 1: Validating environment...
✓ Project directory found
✓ Secrets file found

Step 2: Reading ANON_KEY...
✓ ANON_KEY retrieved

Step 3: Creating .env.production file...
✓ .env.production created/updated

Step 4: Checking for Node.js...
✓ Node.js: v18.19.0
✓ npm: 10.2.3

Step 5: Checking dependencies...
✓ Dependencies already installed

Step 6: Building frontend...
This may take 1-2 minutes...

> audit-proof@0.0.0 build
> vite build

vite v5.4.8 building for production...
✓ 2420 modules transformed.
✓ built in 11.82s

✓ Frontend built successfully

Step 7: Deploying to production directory...
Clearing old files...
Copying new build...
✓ Frontend deployed to: /mnt/user/appdata/auditproof/dist

Step 8: Verifying deployment...
✓ index.html found
✓ Domain URL found in built files

Step 9: Restarting frontend container...
Would you like to restart the frontend container now? (y/N): y
✓ Frontend container restarted

========================================
Frontend Update Complete!
========================================
```

### Step 5: Clear Browser Cache and Test

1. **Hard refresh your browser:**
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **Open your application:**
   ```
   https://test.auditproof.ca
   ```

3. **Verify no CSP errors:**
   - Press `F12` to open DevTools
   - Check Console tab - should be no CSP errors
   - Try to register a new user

4. **Check Network tab:**
   - Open Network tab (F12 → Network)
   - Try to register
   - Verify API calls go to `https://test.auditproof.ca/auth/v1/...`
   - NOT `http://192.168.1.246:8000/...`

---

## What Gets Changed

### Supabase `.env` File Changes

**File:** `/mnt/user/appdata/auditproof/supabase-project/.env`

| Setting | Before | After |
|---------|--------|-------|
| `SITE_URL` | `http://localhost:3000` | `https://test.auditproof.ca` |
| `API_EXTERNAL_URL` | `http://localhost:8000` | `https://test.auditproof.ca` |
| `SUPABASE_PUBLIC_URL` | `http://192.168.1.246:8000` | `https://test.auditproof.ca` |
| `SMTP_HOST` | `supabase-mail` (fake) | `mail.privateemail.com` |
| `SMTP_PORT` | `2500` (fake) | `465` |
| `SMTP_USER` | `fake_mail_user` | `contact@auditproof.ca` |
| `SMTP_PASS` | `fake_mail_password` | Your actual password |
| `SMTP_SENDER_NAME` | `fake_sender` | `Audit Proof` |
| `ENABLE_EMAIL_AUTOCONFIRM` | `false` | `true` |
| `ENABLE_PHONE_SIGNUP` | `true` | `false` |
| `VAULT_ENC_KEY` | `your-encryption-key...` | Generated 32-char key |
| `PG_META_CRYPTO_KEY` | `your-encryption-key...` | Generated 32-char key |

**Added:**
```bash
ADDITIONAL_REDIRECT_URLS=https://test.auditproof.ca/**

# Edge Functions Environment Variables
SUPABASE_URL=http://kong:8000
SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
SMTP_FROM=${SMTP_ADMIN_EMAIL}
SMTP_PASSWORD=${SMTP_PASS}
```

### Frontend `.env.production` File

**File:** `/mnt/user/appdata/auditproof/project/AuditReady/.env.production`

**Created/Updated:**
```bash
VITE_SUPABASE_URL=https://test.auditproof.ca
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Troubleshooting

### Script Says "File Not Found"

**Problem:** Script can't find the `.env` file or project directory.

**Solution:**
```bash
# Check if paths exist
ls -la /mnt/user/appdata/auditproof/supabase-project/.env
ls -la /mnt/user/appdata/auditproof/project/AuditReady

# Adjust paths in script if needed
nano update-supabase-env.sh
# Look for ENV_FILE and PROJECT_DIR variables at the top
```

### Node.js Not Found

**Problem:** Frontend script says "Node.js not found".

**Solution:**
1. Go to Unraid Apps
2. Search for "Node.js"
3. Install "Node.js" by ich777
4. Run the script again

### SMTP Password Not Working

**Problem:** Email not sending after configuration.

**Solution:**
```bash
# Test SMTP connection
telnet mail.privateemail.com 465

# If it connects, your SMTP settings are correct
# If not, check:
# 1. Firewall settings
# 2. Password is correct
# 3. Email provider allows SMTP access

# Check auth logs for SMTP errors
docker logs supabase-auth | grep -i smtp
```

### CSP Errors Still Appearing

**Problem:** Still seeing CSP errors after running scripts.

**Solution:**
```bash
# 1. Verify domain URL is in built files
grep -r "test.auditproof.ca" /mnt/user/appdata/auditproof/dist/assets/*.js | head -1

# If it doesn't appear:
cd /mnt/user/appdata/auditproof/project/AuditReady
cat .env.production
# Should show: VITE_SUPABASE_URL=https://test.auditproof.ca

# 2. Rebuild if needed
npm run build
cp -r dist/* /mnt/user/appdata/auditproof/dist/
docker restart auditproof-frontend

# 3. Clear browser cache completely
# Chrome: F12 → Application → Clear storage → Clear site data
```

### Services Won't Start After Update

**Problem:** Supabase services fail to start after running script.

**Solution:**
```bash
# Check logs for errors
cd /mnt/user/appdata/auditproof/supabase-src/docker
docker compose logs

# Common issues:
# 1. Invalid encryption key format
# 2. SMTP connection blocked
# 3. Port conflicts

# Restore backup if needed
cp /mnt/user/appdata/auditproof/supabase-project/.env.backup.* \
   /mnt/user/appdata/auditproof/supabase-project/.env

# Restart services
docker compose down
docker compose up -d
```

---

## Manual Rollback

If something goes wrong, you can restore the backups:

```bash
# Restore Supabase .env
cd /mnt/user/appdata/auditproof/supabase-project

# List backups
ls -la .env.backup.*

# Restore a specific backup
cp .env.backup.20251029_143022 .env

# Restart services
cd /mnt/user/appdata/auditproof/supabase-src/docker
docker compose down
docker compose up -d
```

```bash
# Restore frontend .env.production
cd /mnt/user/appdata/auditproof/project/AuditReady

# List backups
ls -la .env.production.backup.*

# Restore a specific backup
cp .env.production.backup.20251029_143530 .env.production

# Rebuild
npm run build
cp -r dist/* /mnt/user/appdata/auditproof/dist/
docker restart auditproof-frontend
```

---

## Files Modified by Scripts

### By `update-supabase-env.sh`:
- ✏️ `/mnt/user/appdata/auditproof/supabase-project/.env` (modified)
- 💾 `/mnt/user/appdata/auditproof/supabase-project/.env.backup.*` (created)

### By `update-frontend-env.sh`:
- ✏️ `/mnt/user/appdata/auditproof/project/AuditReady/.env.production` (created/modified)
- 💾 `/mnt/user/appdata/auditproof/project/AuditReady/.env.production.backup.*` (created)
- 📦 `/mnt/user/appdata/auditproof/project/AuditReady/dist/*` (built files)
- 🚀 `/mnt/user/appdata/auditproof/dist/*` (deployed files)

### Nothing is deleted:
- All modifications create backups first
- Original files are preserved with timestamp
- Safe to run multiple times

---

## Security Notes

1. **SMTP Password:** The scripts store your SMTP password in the `.env` file. This is standard practice but ensure your Unraid server is properly secured.

2. **Encryption Keys:** New encryption keys are generated automatically. Keep backups of your `.env` file in a secure location.

3. **ANON_KEY:** This is safe to expose in frontend code (it's designed for public use). The SERVICE_ROLE_KEY should never be exposed.

4. **Backups:** All scripts create timestamped backups before making changes. Keep at least one backup in a secure location.

---

## Support

If you encounter issues:

1. Check the **Troubleshooting** section above
2. Review logs: `docker compose logs` (in Supabase directory)
3. See `documentation/UNRAID_MIGRATION_GUIDE.md` for detailed setup
4. See `documentation/CSP_FIX_GUIDE.md` for CSP-specific issues

---

**Generated:** 2025-10-29
**For:** Audit Proof Self-Hosted Installation
**Your Config:** 192.168.1.246 → test.auditproof.ca
