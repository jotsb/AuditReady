# Quick Fix: PDF Upload MIME Type Error

## The Problem
PDF uploads fail with: `Failed to load module script: MIME type of "application/octet-stream"`

## The Solution (30 seconds)

Run this ONE command on your Unraid server:

```bash
bash /mnt/user/auditproof/scripts/fix-pdf-worker-mime-type.sh
```

That's it! PDF uploads will now work.

## What It Does
- Backs up your nginx config
- Adds `.mjs` MIME type mapping
- Reloads nginx (no downtime)

## After Running
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+Shift+R)
3. Try uploading a PDF - should work now

## Why This Happened
- Bolt Cloud: Serves `.mjs` files correctly (works fine)
- Self-Hosted: Default nginx doesn't know about `.mjs` files
- Browser: Rejects `.mjs` files without proper MIME type

## More Info
See `FIX_PDF_UPLOAD_ERROR.md` for detailed explanation.
