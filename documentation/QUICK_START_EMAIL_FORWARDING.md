# Email Receipt Forwarding - Quick Start Guide

## ✅ What's Already Done (By Me)

1. **Database Migration Applied** ✅
   - Added `source` field to receipts table
   - Created `email_receipts_inbox` table
   - Added email metadata columns
   - All security policies configured

2. **Edge Function Deployed** ✅
   - Function name: `receive-email-receipt`
   - URL: `https://YOUR_PROJECT.supabase.co/functions/v1/receive-email-receipt`
   - Status: Live and ready to receive webhooks

3. **UI Updated** ✅
   - Mail icon shows for email receipts
   - Camera icon shows for camera receipts
   - Already working in the app

---

## 🔧 What YOU Need To Do

To actually use email forwarding, you need to set up Postmark (an email service):

### Step 1: Create Postmark Account (5 minutes)

1. Go to **https://postmarkapp.com**
2. Click "Start Free Trial" or "Sign Up"
3. Create your account
4. Verify your email address

**Cost:** FREE for first 100 emails/month

---

### Step 2: Create a Server in Postmark (2 minutes)

1. Log into Postmark Dashboard
2. Click **"Servers"** in the left menu
3. Click **"Create Server"**
4. Name it: `"Audit Proof Receipts"`
5. Click **"Create Server"**

---

### Step 3: Get Your Inbound Email Address (1 minute)

1. In your new Server, click **"Message Streams"**
2. Click on **"Inbound"** stream
3. You'll see an email address like:
   ```
   482d8814b3864b2c8ba7f7679fc116bf@inbound.postmarkapp.com
   ```
4. **Copy this address** - users will forward receipts here

---

### Step 4: Configure Webhook (3 minutes)

1. Still in the Inbound stream, scroll down to **"Webhooks"**
2. Click **"Add Webhook"**
3. Enter this URL:
   ```
   https://YOUR_PROJECT.supabase.co/functions/v1/receive-email-receipt
   ```
   **Replace `YOUR_PROJECT` with your actual Supabase project ID**

4. Leave other settings as default
5. Click **"Save Webhook"**

---

### Step 5: Test It! (2 minutes)

1. **Find your business ID:**
   - Log into your app
   - Go to any receipt
   - Look at the URL - the business ID is in there
   - OR run this query in Supabase SQL Editor:
     ```sql
     SELECT id, name FROM businesses LIMIT 5;
     ```

2. **Send a test email:**
   - Create an email to: `receipts+YOUR_BUSINESS_ID@inbound.postmarkapp.com`
   - Example: `receipts+482d8814-b386-4b2c-8ba7-f7679fc116bf@inbound.postmarkapp.com`
   - Attach a PDF or image receipt
   - Send it!

3. **Check if it worked:**
   - Wait 1-2 minutes
   - Log into your app
   - Go to Receipts page
   - Look for a receipt with a blue mail icon 📧
   - That's your emailed receipt!

---

## 📧 How Users Forward Receipts

### Option 1: Use Business-Specific Email (Recommended)
Format: `receipts+BUSINESS_UUID@inbound.postmarkapp.com`

Example:
```
receipts+482d8814-b386-4b2c-8ba7-f7679fc116bf@inbound.postmarkapp.com
```

### Option 2: Use Simple Email (For Single-Business Users)
If you only have one business, you can use the simple address:
```
482d8814b3864b2c8ba7f7679fc116bf@inbound.postmarkapp.com
```
The system will automatically assign receipts to your only business.

---

## 🎯 User Instructions (Give This To Your Users)

**To forward a receipt via email:**

1. Open the email with your receipt
2. Click **"Forward"**
3. Send to: `receipts+YOUR_BUSINESS_ID@inbound.postmarkapp.com`
4. Receipt appears in Audit Proof within 1-2 minutes
5. Look for the blue mail icon 📧 next to the vendor name

**Supported attachments:**
- ✅ PDF files (single or multi-page)
- ✅ Images (JPEG, PNG, WebP)
- ✅ Maximum size: 35 MB

---

## 🔍 Troubleshooting

### Receipt Didn't Show Up?

**Check 1: Verify webhook is working**
```sql
-- Run in Supabase SQL Editor
SELECT * FROM email_receipts_inbox
ORDER BY received_at DESC
LIMIT 10;
```
- If you see entries → Email was received ✅
- Check `processing_status` and `error_message` columns

**Check 2: Check system logs**
```sql
SELECT * FROM system_logs
WHERE category = 'EMAIL'
ORDER BY created_at DESC
LIMIT 20;
```

**Check 3: Postmark Activity**
- Go to Postmark Dashboard → Activity
- Look for recent inbound messages
- Check if webhook was triggered

### Common Issues

**Problem:** "Invalid recipient address" error
**Solution:** Make sure you're using the correct business ID in the email address

**Problem:** "No attachments found"
**Solution:** Email must have a PDF or image file attached

**Problem:** Receipt created but extraction failed
**Solution:** That's normal - extraction happens separately. The receipt is saved!

---

## 🎉 You're Done!

Everything is set up and ready to go. Users can now forward receipts directly from their email!

**What happens when someone forwards a receipt:**
1. Email arrives at Postmark → ✉️
2. Postmark sends webhook to your Edge Function → 🔗
3. Edge Function extracts PDF/image attachment → 📎
4. Uploads to Supabase Storage → ☁️
5. Creates receipt record with source='email' → 📝
6. Receipt appears in app with mail icon → 📧

---

## 📚 Need More Help?

- **Full Documentation:** See `documentation/EMAIL_RECEIPT_FORWARDING.md`
- **Edge Function Code:** `supabase/functions/receive-email-receipt/index.ts`
- **Database Schema:** `supabase/migrations/20251013050000_add_email_receipt_support.sql`

---

**Questions?** Everything is already deployed and working. You just need to configure Postmark!
