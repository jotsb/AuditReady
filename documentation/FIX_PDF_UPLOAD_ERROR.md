# Fix: PDF Upload Fails with MIME Type Error

## Problem

Uploading scanned PDFs fails with the error:
```
Failed to convert PDF: Setting up fake worker failed:
"Failed to fetch dynamically imported module:
https://test.auditproof.ca/assets/pdf.worker.min-qwK7q_zL.mjs"
```

Console shows:
```
Failed to load module script: Expected a JavaScript-or-Wasm module script
but the server responded with a MIME type of "application/octet-stream"
```

## Root Cause

Nginx is serving `.mjs` files (PDF.js worker) with the wrong MIME type:
- **Current:** `application/octet-stream` (generic binary)
- **Required:** `application/javascript` or `text/javascript`

Browsers enforce strict MIME type checking for ES6 modules (`.mjs` files) and reject them if served with incorrect MIME types.

## Why It Works on Bolt Cloud

Bolt Cloud's web server (likely using different configuration or CDN) already serves `.mjs` files with the correct MIME type.

## Solution

### Quick Fix (Self-Hosted)

Run this script to fix your existing deployment:

```bash
cd /mnt/user/auditproof
bash scripts/fix-pdf-worker-mime-type.sh
```

This will:
1. Backup your current `nginx.conf`
2. Add `.mjs` MIME type mapping
3. Test and reload Nginx
4. No downtime required

### Manual Fix

If you prefer to do it manually:

1. **Edit nginx.conf:**
```bash
nano /mnt/user/auditproof/config/nginx.conf
```

2. **Add MIME type mapping** in the `http` block:
```nginx
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Add this block:
    types {
        application/javascript mjs;
        text/javascript js mjs;
    }

    # ... rest of config
}
```

3. **Test and reload:**
```bash
docker exec auditproof-nginx nginx -t
docker exec auditproof-nginx nginx -s reload
```

### Permanent Fix (Future Deployments)

The file `infrastructure-scripts/06-setup-nginx.sh` has been updated to include the `.mjs` MIME type mapping automatically.

Next time you run the full infrastructure setup, the fix will be included automatically.

## Verification

After applying the fix:

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Hard refresh** the page (Ctrl+Shift+R)
3. Go to **Receipts > Upload**
4. Select a **scanned PDF** file
5. Should now work without errors

## Technical Details

### What is .mjs?

`.mjs` is the file extension for JavaScript ES6 modules. PDF.js uses a web worker (separate thread) to process PDFs without blocking the main UI thread.

### Why Strict MIME Type?

Modern browsers enforce strict MIME type checking for module scripts to prevent:
- Security vulnerabilities
- Accidental execution of non-JavaScript files
- Cross-site scripting attacks

### Affected Files

- `pdf.worker.min-qwK7q_zL.mjs` - PDF.js worker compiled by Vite
- Any other `.mjs` files in `/assets/` directory

## Related Files

- **Fix Script:** `scripts/fix-pdf-worker-mime-type.sh`
- **Nginx Setup:** `infrastructure-scripts/06-setup-nginx.sh`
- **This Guide:** `FIX_PDF_UPLOAD_ERROR.md`

## Troubleshooting

### Still Getting Errors?

1. **Check nginx config was applied:**
```bash
docker exec auditproof-nginx cat /etc/nginx/nginx.conf | grep -A 3 "types {"
```

Should show:
```nginx
types {
    application/javascript mjs;
    text/javascript js mjs;
}
```

2. **Check file MIME type:**
```bash
curl -I https://test.auditproof.ca/assets/pdf.worker.min-qwK7q_zL.mjs
```

Should show:
```
Content-Type: application/javascript
```

3. **Clear ALL browser cache:**
- Chrome: Settings > Privacy > Clear browsing data
- Select "Cached images and files"
- Time range: "All time"

4. **Try incognito/private mode** to rule out caching issues

### Error Persists?

Check browser console for:
- Any 404 errors (file not found)
- CSP violations (Content Security Policy blocking the file)
- Network errors (firewall/proxy issues)

## Why This Wasn't Caught Earlier

1. **Development server** (Vite) serves `.mjs` files correctly automatically
2. **Bolt Cloud** infrastructure handles MIME types correctly
3. **Self-hosted Nginx** requires explicit configuration for newer file types like `.mjs`

## Prevention

Going forward:
- ✅ Infrastructure scripts updated
- ✅ Quick fix script created
- ✅ Documentation added
- Future deployments will include this fix automatically
