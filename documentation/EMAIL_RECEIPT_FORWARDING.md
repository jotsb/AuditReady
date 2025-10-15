# Email Receipt Forwarding Setup Guide

## Overview

Audit Proof supports receiving receipts via email forwarding. Users can forward receipt emails to a special address, and the system will automatically extract attachments and create receipt records.

## How It Works

```
User forwards receipt email → receipts+business_id@yourdomain.com
                            ↓
                    Postmark Inbound Parse
                            ↓
                    Webhook to Edge Function
                    "receive-email-receipt"
                            ↓
            Extract attachments (PDF/images)
                            ↓
            Upload to Supabase Storage
                            ↓
            Create receipt with source='email'
                            ↓
            Trigger AI extraction (if enabled)
```

## Setup Instructions

### 1. Postmark Account Setup

1. **Create Postmark Account**
   - Go to https://postmarkapp.com
   - Sign up for an account
   - Verify your email address

2. **Create Server**
   - In Postmark dashboard, create a new Server
   - Name it "Audit Proof Receipts" or similar
   - Note down the Server API Token

3. **Configure Inbound Stream**
   - Navigate to your Server → Message Streams
   - Click on the "Inbound" stream
   - Note the inbound email address (format: `guid@inbound.postmarkapp.com`)

### 2. Domain Configuration

**Option A: Use Postmark's Inbound Domain (Easier)**
- Use the GUID email: `482d8814b3864b2c8ba7f7679fc116bf@inbound.postmarkapp.com`
- Users forward emails to this address
- No DNS configuration needed

**Option B: Custom Domain (Recommended for Production)**

1. **Add Your Domain**
   - In Postmark: Settings → Domains → Add Domain
   - Enter your domain (e.g., `receipts.auditproof.com`)

2. **Configure DNS Records**
   Add these records to your DNS:
   ```
   Type: MX
   Name: receipts (or your subdomain)
   Priority: 10
   Value: inbound.postmarkapp.com
   ```

3. **Verify Domain**
   - Wait for DNS propagation (up to 48 hours)
   - Postmark will verify MX records
   - Domain status should show "Verified"

### 3. Configure Webhook in Postmark

1. **Set Inbound Webhook URL**
   - Navigate to: Server → Message Streams → Inbound
   - Click "Add Webhook"
   - Enter URL: `https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/receive-email-receipt`
   - Method: POST
   - Content-Type: application/json

2. **Test Webhook**
   - Use Postmark's "Test Webhook" button
   - Should receive 200 OK response
   - Check Supabase logs for successful processing

### 4. Deploy Edge Function

```bash
# Navigate to your project directory
cd /path/to/audit-proof

# Deploy the edge function
supabase functions deploy receive-email-receipt --no-verify-jwt

# Set environment variables (if not already set)
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 5. Apply Database Migration

```bash
# Apply the email receipt support migration
supabase db push

# Or manually run:
psql -h db.your-project.supabase.co -U postgres -d postgres -f supabase/migrations/20251013050000_add_email_receipt_support.sql
```

### 6. Configure Business Email Addresses

Each business needs a unique email address to receive receipts.

**Format:** `receipts+BUSINESS_UUID@yourdomain.com`

**Example:** `receipts+482d8814-b386-4b2c-8ba7-f7679fc116bf@auditproof.com`

To find your business UUID:
```sql
SELECT id, name FROM businesses WHERE owner_id = 'your-user-id';
```

## User Instructions

### For Users Forwarding Receipts

1. **Find Your Receipt Email Address**
   - Log into Audit Proof
   - Go to Settings → Business Settings
   - Find "Email Receipts To:" address
   - Copy this address

2. **Forward Receipt Emails**
   - Open the receipt email from vendor
   - Click "Forward"
   - Paste your receipt email address
   - Send

3. **Verify Receipt Created**
   - Receipts appear in your dashboard within 1-2 minutes
   - Look for email icon indicator
   - Receipt will show "Source: Email"

### What Attachments Are Supported?

- ✅ PDF files (single or multi-page)
- ✅ Image files (JPEG, PNG, WebP)
- ❌ Office documents (Word, Excel)
- ❌ Text files
- ❌ ZIP archives

**Note:** Only the first valid attachment is processed. If an email has multiple attachments, only the first PDF or image will be imported.

## Troubleshooting

### Email Not Received

1. **Check DNS Records**
   ```bash
   dig MX receipts.auditproof.com
   ```
   Should return: `10 inbound.postmarkapp.com`

2. **Check Postmark Activity**
   - Postmark Dashboard → Activity
   - Look for recent inbound messages
   - Check if webhook was triggered

3. **Check Supabase Logs**
   - Supabase Dashboard → Edge Functions → receive-email-receipt
   - Look for recent invocations
   - Check for errors

### Receipt Not Created

1. **Check Email Inbox Table**
   ```sql
   SELECT * FROM email_receipts_inbox
   ORDER BY received_at DESC
   LIMIT 10;
   ```
   Look for `processing_status` and `error_message`

2. **Common Issues**
   - **Invalid business ID**: Check recipient email format
   - **No attachments**: Email must have PDF or image attached
   - **Duplicate**: Email already processed (check `message_id`)
   - **Storage error**: Check Supabase storage permissions

3. **Check System Logs**
   ```sql
   SELECT * FROM system_logs
   WHERE category = 'EMAIL'
   ORDER BY created_at DESC
   LIMIT 20;
   ```

### Webhook Not Triggered

1. **Verify Webhook URL**
   - Must be publicly accessible
   - Must use HTTPS
   - Must return 200 OK

2. **Test Webhook Manually**
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/receive-email-receipt \
     -H "Content-Type: application/json" \
     -d '{"MessageID": "test", "From": "test@example.com", ...}'
   ```

3. **Check Postmark Webhook Logs**
   - Postmark Dashboard → Message Streams → Inbound → Webhook
   - View recent webhook attempts
   - Check response codes

## Advanced Configuration

### Email Aliases (Future Enhancement)

Create an `email_aliases` table to map custom email addresses to businesses:

```sql
CREATE TABLE email_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  email_address TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

This allows users to set up memorable addresses like:
- `acme-corp@receipts.auditproof.com`
- `john-personal@receipts.auditproof.com`

### Multiple Attachments Support

Modify the Edge Function to process all valid attachments:

```typescript
// Process ALL valid attachments instead of just first one
for (const attachment of validAttachments) {
  // Create separate receipt for each attachment
  // Or create parent receipt with child pages
}
```

### Auto-Categorization

Use email subject or sender to auto-categorize receipts:

```typescript
// Extract vendor from email subject
const subject = email.Subject.toLowerCase();
if (subject.includes('amazon')) {
  category = 'Office Supplies';
} else if (subject.includes('gas')) {
  category = 'Fuel';
}
```

## Security Considerations

1. **Webhook Authentication**
   - Postmark sends webhook signature in header
   - Verify signature to prevent spoofing
   - Implementation: https://postmarkapp.com/developer/webhooks/webhooks-overview#webhook-signature

2. **Rate Limiting**
   - Implement rate limiting per sender
   - Prevent abuse from spam/attacks
   - Use Supabase Edge Function rate limiting

3. **Business ID Validation**
   - Always verify business exists
   - Check user has permission to add receipts
   - Validate business is not suspended

4. **Attachment Validation**
   - Verify file types
   - Check file sizes (max 35 MB from Postmark)
   - Scan for malware (future enhancement)

## Monitoring

### Key Metrics to Track

1. **Email Volume**
   ```sql
   SELECT DATE(received_at) as date, COUNT(*) as emails
   FROM email_receipts_inbox
   GROUP BY DATE(received_at)
   ORDER BY date DESC;
   ```

2. **Processing Success Rate**
   ```sql
   SELECT processing_status, COUNT(*) as count
   FROM email_receipts_inbox
   GROUP BY processing_status;
   ```

3. **Common Errors**
   ```sql
   SELECT error_message, COUNT(*) as count
   FROM email_receipts_inbox
   WHERE processing_status = 'failed'
   GROUP BY error_message
   ORDER BY count DESC;
   ```

## Cost Considerations

### Postmark Pricing (as of 2025)

- **Free Tier**: 100 emails/month
- **Starter**: $15/month - 10,000 emails
- **Growth**: $60/month - 50,000 emails
- **Enterprise**: Custom pricing

**Recommendation**: Start with free tier for testing, upgrade as needed.

### Supabase Storage Costs

- Email attachments stored in Supabase Storage
- Costs based on storage size and bandwidth
- Monitor storage usage in Supabase dashboard

## Support

For issues or questions:
- Check documentation: `/documentation/`
- Review logs: Supabase Dashboard → Logs
- Contact support: support@auditproof.com
