/*
  # Add Email Receipt Support

  1. Schema Changes
    - Add `source` enum to track receipt origin (upload, email, camera, api)
    - Add `email_metadata` JSONB column for email details (sender, subject, received_at)
    - Add `email_message_id` for deduplication of forwarded emails
    - Create `email_receipts_inbox` table to track all received emails

  2. New Tables
    - `email_receipts_inbox`
      - Tracks all incoming emails
      - Stores raw email data
      - Processing status tracking
      - Error logging

  3. Security
    - RLS policies for email inbox (admins and business owners only)
    - Audit logging for email receipt processing
*/

-- Create source enum type
DO $$ BEGIN
  CREATE TYPE receipt_source AS ENUM ('upload', 'email', 'camera', 'api');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add source column to receipts table
ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS source receipt_source DEFAULT 'upload' NOT NULL;

-- Add email metadata columns to receipts table
ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS email_metadata JSONB,
ADD COLUMN IF NOT EXISTS email_message_id TEXT;

-- Create index on email_message_id for deduplication
CREATE INDEX IF NOT EXISTS idx_receipts_email_message_id ON receipts(email_message_id) WHERE email_message_id IS NOT NULL;

-- Create index on source for filtering
CREATE INDEX IF NOT EXISTS idx_receipts_source ON receipts(source);

-- Add comments for documentation
COMMENT ON COLUMN receipts.source IS 'Origin of the receipt: upload (manual), email (forwarded), camera (mobile), api (external)';
COMMENT ON COLUMN receipts.email_metadata IS 'Email details when source=email: {sender, subject, received_at, to, cc}';
COMMENT ON COLUMN receipts.email_message_id IS 'Unique email message ID for deduplication';

-- Create email_receipts_inbox table
CREATE TABLE IF NOT EXISTS email_receipts_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_email_data JSONB NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
  attachments_count INTEGER DEFAULT 0,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for email inbox
CREATE INDEX IF NOT EXISTS idx_email_inbox_business_id ON email_receipts_inbox(business_id);
CREATE INDEX IF NOT EXISTS idx_email_inbox_message_id ON email_receipts_inbox(message_id);
CREATE INDEX IF NOT EXISTS idx_email_inbox_status ON email_receipts_inbox(processing_status);
CREATE INDEX IF NOT EXISTS idx_email_inbox_received_at ON email_receipts_inbox(received_at DESC);

-- Add unique constraint on message_id for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_inbox_unique_message_id ON email_receipts_inbox(message_id);

-- Add comments
COMMENT ON TABLE email_receipts_inbox IS 'Tracks all incoming emails forwarded to the system for receipt processing';
COMMENT ON COLUMN email_receipts_inbox.raw_email_data IS 'Complete email payload from webhook (Postmark/SendGrid format)';
COMMENT ON COLUMN email_receipts_inbox.processing_status IS 'Processing state: pending, processing, completed, failed';

-- Enable RLS
ALTER TABLE email_receipts_inbox ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_receipts_inbox

-- System admins can see all email inbox entries
CREATE POLICY "System admins can view all email inbox entries"
  ON email_receipts_inbox
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_system_admin = true
    )
  );

-- Business owners and managers can see their business's email inbox
CREATE POLICY "Business members can view their business email inbox"
  ON email_receipts_inbox
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM business_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- Service role can insert email inbox entries (from Edge Function)
CREATE POLICY "Service role can insert email inbox entries"
  ON email_receipts_inbox
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can update email inbox entries (processing status)
CREATE POLICY "Service role can update email inbox entries"
  ON email_receipts_inbox
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_inbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_email_inbox_updated_at_trigger ON email_receipts_inbox;
CREATE TRIGGER update_email_inbox_updated_at_trigger
  BEFORE UPDATE ON email_receipts_inbox
  FOR EACH ROW
  EXECUTE FUNCTION update_email_inbox_updated_at();

-- Create audit trigger for email receipts
CREATE OR REPLACE FUNCTION audit_email_receipt_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.source = 'email' THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      business_id,
      changes
    ) VALUES (
      COALESCE(NEW.uploaded_by, NEW.created_by),
      'create',
      'receipt',
      NEW.id,
      NEW.business_id,
      jsonb_build_object(
        'source', 'email',
        'email_from', NEW.email_metadata->>'sender',
        'email_subject', NEW.email_metadata->>'subject',
        'email_message_id', NEW.email_message_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for email receipt audit logging
DROP TRIGGER IF EXISTS audit_email_receipt_trigger ON receipts;
CREATE TRIGGER audit_email_receipt_trigger
  AFTER INSERT ON receipts
  FOR EACH ROW
  WHEN (NEW.source = 'email')
  EXECUTE FUNCTION audit_email_receipt_changes();

-- Update existing receipts to have source='upload' if null
UPDATE receipts SET source = 'upload' WHERE source IS NULL;
