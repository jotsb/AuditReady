/*
  # Complete Rollback of Phase A Security

  1. Summary
    Completely removes all Phase A security features:
    - Storage RLS policies (strict ones)
    - File validation functions and columns
    - PII masking functions and views
    - Security events table
    - Admin audit triggers

  2. Changes
    - Drop Phase A storage policies
    - Restore original simple storage policies
    - Drop file validation functions
    - Drop PII masking functions
    - Drop masked views
    - Remove file tracking columns from receipts
    - Drop security events table
*/

-- ============================================================================
-- DROP MASKED VIEWS
-- ============================================================================
DROP VIEW IF EXISTS system_logs_masked CASCADE;
DROP VIEW IF EXISTS audit_logs_masked CASCADE;

-- ============================================================================
-- DROP PII MASKING FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS mask_email(text) CASCADE;
DROP FUNCTION IF EXISTS mask_phone(text) CASCADE;
DROP FUNCTION IF EXISTS mask_ip_address(text) CASCADE;
DROP FUNCTION IF EXISTS mask_ip_address(inet) CASCADE;
DROP FUNCTION IF EXISTS mask_sensitive_jsonb(jsonb) CASCADE;
DROP FUNCTION IF EXISTS sanitize_log_data(jsonb) CASCADE;

-- ============================================================================
-- DROP FILE VALIDATION FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS validate_file_upload(text, bigint, text) CASCADE;
DROP FUNCTION IF EXISTS check_file_magic_bytes(bytea, text) CASCADE;
DROP FUNCTION IF EXISTS scan_file_for_threats(bytea) CASCADE;

-- ============================================================================
-- DROP SECURITY LOGGING FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS log_security_event(text, text, jsonb, text) CASCADE;

-- ============================================================================
-- DROP SECURITY EVENTS TABLE
-- ============================================================================
DROP TABLE IF EXISTS security_events CASCADE;

-- ============================================================================
-- DROP PHASE A STORAGE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can upload receipts to their collections" ON storage.objects;
DROP POLICY IF EXISTS "Users can read receipts from their collections" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete receipts from their collections" ON storage.objects;
DROP POLICY IF EXISTS "Users can update receipts from their collections" ON storage.objects;
DROP POLICY IF EXISTS "System admins have full storage access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their receipts" ON storage.objects;

-- ============================================================================
-- RESTORE ORIGINAL SIMPLE STORAGE POLICIES
-- ============================================================================

-- Allow authenticated users to upload receipts
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Allow authenticated users to read receipts
CREATE POLICY "Allow authenticated reads"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

-- Allow authenticated users to delete their receipts
CREATE POLICY "Allow authenticated deletes"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');

-- Allow authenticated users to update receipts
CREATE POLICY "Allow authenticated updates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- ============================================================================
-- REMOVE FILE TRACKING COLUMNS FROM RECEIPTS
-- ============================================================================
DO $$
BEGIN
  -- Drop file tracking columns if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receipts' AND column_name = 'file_size_bytes'
  ) THEN
    ALTER TABLE receipts DROP COLUMN file_size_bytes;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receipts' AND column_name = 'file_mime_type'
  ) THEN
    ALTER TABLE receipts DROP COLUMN file_mime_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receipts' AND column_name = 'file_validated_at'
  ) THEN
    ALTER TABLE receipts DROP COLUMN file_validated_at;
  END IF;
END $$;

-- ============================================================================
-- DROP PERFORMANCE INDEXES CREATED IN PHASE A
-- ============================================================================
DROP INDEX IF EXISTS idx_receipts_file_validated;
DROP INDEX IF EXISTS idx_receipts_file_size;
DROP INDEX IF EXISTS idx_receipts_mime_type;
DROP INDEX IF EXISTS idx_security_events_severity;
DROP INDEX IF EXISTS idx_security_events_type;
DROP INDEX IF EXISTS idx_security_events_user;
