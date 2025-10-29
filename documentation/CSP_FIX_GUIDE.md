# Content Security Policy (CSP) Fix Guide

## Problem

When accessing the frontend through your domain (`test.auditproof.ca`), you get CSP errors like:

```
Refused to connect to 'http://192.168.1.246:8000/auth/v1/signup'
because it violates the following Content Security Policy directive:
"connect-src 'self' https://*.supabase.co wss://*.supabase.co"
```

## Root Cause

The frontend was built with `VITE_SUPABASE_URL` pointing to the internal IP (`http://192.168.1.246:8000`) instead of your domain. This causes two problems:

1. **CSP Violation**: The Content Security Policy only allows connections to `'self'` (same origin) and official Supabase domains
2. **Mixed Content**: Trying to make HTTP requests from an HTTPS page

## Solution

### Step 1: Update Environment Configuration

Your `.env` file should use the **same domain** as your frontend:

```bash
# WRONG - causes CSP violations
VITE_SUPABASE_URL=http://192.168.1.246:8000

# CORRECT - matches your domain
VITE_SUPABASE_URL=https://test.auditproof.ca
VITE_SUPABASE_ANON_KEY=your_actual_anon_key_here
```

### Step 2: Get Your ANON_KEY

On your Unraid server:

```bash
ssh root@192.168.1.246
cat /mnt/user/appdata/auditproof/config/secrets.txt
```

Copy the `ANON_KEY` value.

### Step 3: Update .env File

**Option A: On your development machine**

Edit `.env` in your project root:

```bash
VITE_SUPABASE_URL=https://test.auditproof.ca
VITE_SUPABASE_ANON_KEY=eyJhbGc...your_actual_key...
```

**Option B: On Unraid server**

```bash
ssh root@192.168.1.246
cd /mnt/user/appdata/auditproof/project/AuditReady

nano .env.production
```

Add:
```
VITE_SUPABASE_URL=https://test.auditproof.ca
VITE_SUPABASE_ANON_KEY=your_actual_anon_key_here
```

### Step 4: Rebuild Frontend

**On your development machine:**

```bash
npm run build
```

**Copy the new build to Unraid:**

```bash
# From your project directory
scp -r dist/* root@192.168.1.246:/mnt/user/appdata/auditproof/dist/
```

**Or build directly on Unraid:**

```bash
ssh root@192.168.1.246
cd /mnt/user/appdata/auditproof/project/AuditReady
npm run build
cp -r dist/* /mnt/user/appdata/auditproof/dist/
```

### Step 5: Restart Frontend Container

```bash
docker restart auditproof-frontend
```

Or via Unraid GUI:
1. Go to **Docker** tab
2. Find **auditproof-frontend**
3. Click **Restart**

### Step 6: Clear Browser Cache

**Hard refresh the page:**
- Chrome/Edge: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- Firefox: `Ctrl + F5` (Windows) or `Cmd + Shift + R` (Mac)

**Or clear all cache:**
1. Press `F12` to open DevTools
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

## Why This Works

### Before (Broken)
```
Browser                         SWAG Proxy           Backend
  |                                |                    |
  |-- HTTPS to test.auditproof.ca ->                   |
  |                                |                    |
  |<-- HTML/JS/CSS (HTTPS) --------|                   |
  |                                |                    |
  |-- HTTP to 192.168.1.246:8000 ---------------------->| ❌ CSP blocks this!
```

The browser blocks the HTTP request to `192.168.1.246:8000` because:
1. It violates CSP (different origin)
2. Mixed content (HTTP from HTTPS page)

### After (Fixed)
```
Browser                         SWAG Proxy           Backend
  |                                |                    |
  |-- HTTPS to test.auditproof.ca ->                   |
  |                                |                    |
  |<-- HTML/JS/CSS (HTTPS) --------|                   |
  |                                |                    |
  |-- HTTPS to test.auditproof.ca/auth/v1/signup ----->|
  |                                |                    |
  |                                |-- HTTP to 192.168.1.246:8000 -->| ✅
  |                                |                    |
  |<---------------------------HTTPS Response ---------|
```

All requests from the browser go to `test.auditproof.ca` (same origin, allowed by CSP), and SWAG proxy internally routes them to the backend.

## Verify the Fix

### Check Environment in Built Files

```bash
# On Unraid
grep -r "test.auditproof.ca" /mnt/user/appdata/auditproof/dist/assets/*.js | head -1
```

You should see your domain URL in the JavaScript bundles.

### Check Browser Network Tab

1. Open your site: `https://test.auditproof.ca`
2. Press `F12` → **Network** tab
3. Try to register a user
4. Look at the API requests

**Should see:**
- ✅ `https://test.auditproof.ca/auth/v1/signup`
- ✅ Status: 200 or 400 (not blocked)

**Should NOT see:**
- ❌ `http://192.168.1.246:8000/auth/v1/signup`
- ❌ Status: (blocked:csp)

### Check Console

Press `F12` → **Console** tab

**Should NOT see:**
- ❌ "Refused to connect"
- ❌ "violates Content Security Policy"

## Troubleshooting

### Still Getting CSP Errors After Rebuild

**Problem:** Browser is using cached files

**Solution:**
1. Hard refresh: `Ctrl + Shift + R`
2. Clear all site data:
   - Press `F12`
   - **Application** tab → **Storage** → **Clear site data**
3. Try incognito/private window

### 404 Errors on API Calls

**Problem:** SWAG proxy isn't routing correctly

**Solution:**
1. Check SWAG config: `/mnt/user/appdata/swag/nginx/proxy-confs/auditproof.subdomain.conf`
2. Verify these location blocks exist:
   - `/auth/`
   - `/rest/`
   - `/storage/`
   - `/functions/`
3. Restart SWAG: `docker restart swag-reverse-proxy`

### SSL Certificate Errors

**Problem:** SWAG hasn't generated cert for your domain

**Solution:**
```bash
# Check SWAG logs
docker logs swag-reverse-proxy

# Check if certificate exists
docker exec swag-reverse-proxy ls -la /config/keys/letsencrypt/

# Force certificate renewal
docker restart swag-reverse-proxy
```

### Can't Connect to Backend

**Problem:** Backend services not running

**Solution:**
```bash
# Check all services are running
docker ps | grep -E "kong|postgres|gotrue|postgrest|storage|realtime"

# Check Kong Gateway specifically
curl http://192.168.1.246:8000/health

# Restart Kong if needed
docker restart supabase-kong
```

## Production Checklist

Before going live, verify:

- [ ] `.env` or `.env.production` uses your domain URL
- [ ] ANON_KEY is correct (from secrets.txt)
- [ ] Frontend rebuilt with new environment
- [ ] New build copied to `/mnt/user/appdata/auditproof/dist/`
- [ ] Frontend container restarted
- [ ] Browser cache cleared
- [ ] No CSP errors in console
- [ ] Can successfully register a user
- [ ] Can successfully login
- [ ] API calls show your domain in Network tab

## Environment Variable Reference

### Self-Hosted Setup

```bash
# Use your domain - requests go through SWAG proxy
VITE_SUPABASE_URL=https://test.auditproof.ca
VITE_SUPABASE_ANON_KEY=your_anon_key_from_secrets.txt
```

### Why Not Use Internal IP?

```bash
# DON'T USE THIS - causes CSP violations
VITE_SUPABASE_URL=http://192.168.1.246:8000
```

**Problems with internal IP:**
1. ❌ CSP blocks requests (different origin)
2. ❌ Mixed content warnings (HTTP from HTTPS page)
3. ❌ Won't work from external networks
4. ❌ Bypasses SWAG proxy (no SSL, no logging)

**Benefits of domain URL:**
1. ✅ Matches CSP 'self' origin
2. ✅ All HTTPS (secure)
3. ✅ Works from any network
4. ✅ All traffic through SWAG (logging, security)
5. ✅ Single configuration for dev and prod

## Related Documentation

- `UNRAID_MIGRATION_GUIDE.md` - Complete setup guide
- `SWAG_PROXY_CONFIG.md` - Reverse proxy configuration
- Phase 4: Deploy Frontend - Build and deployment steps
- Phase 5: Configure SWAG - SSL and proxy setup
