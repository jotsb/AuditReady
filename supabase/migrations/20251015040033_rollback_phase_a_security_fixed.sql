/*
  # Rollback Phase A Security Changes (Fixed)

  1. Summary
    Removes Phase A security hardening that is causing issues:
    - Restores simpler storage policies
    - Removes strict file validation
    - Removes PII masking functions

  2. Changes
    - Drop Phase A storage policies
    - Restore basic storage policies
    - Drop validation functions if they exist
*/

-- ============================================================================
-- DROP PHASE A STORAGE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can upload receipts to their collections" ON storage.objects;
DROP POLICY IF EXISTS "Users can read receipts from their collections" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete receipts from their collections" ON storage.objects;
DROP POLICY IF EXISTS "System admins have full storage access" ON storage.objects;

-- ============================================================================
-- RESTORE BASIC STORAGE POLICIES (Original ones)
-- ============================================================================

-- Allow authenticated users to upload receipts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload receipts'
  ) THEN
    CREATE POLICY "Authenticated users can upload receipts"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'receipts' AND
      auth.role() = 'authenticated'
    );
  END IF;
END $$;

-- Allow users to read receipts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can read their receipts'
  ) THEN
    CREATE POLICY "Users can read their receipts"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'receipts' AND
      auth.role() = 'authenticated'
    );
  END IF;
END $$;

-- Allow users to delete their receipts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete their receipts'
  ) THEN
    CREATE POLICY "Users can delete their receipts"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'receipts' AND
      auth.role() = 'authenticated'
    );
  END IF;
END $$;

-- ============================================================================
-- DROP FILE VALIDATION FUNCTIONS (if they exist)
-- ============================================================================

DROP FUNCTION IF EXISTS validate_file_upload(TEXT, BIGINT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS check_file_magic_bytes(BYTEA, TEXT) CASCADE;
DROP FUNCTION IF EXISTS scan_file_for_threats(BYTEA) CASCADE;

-- ============================================================================
-- DROP PII MASKING FUNCTIONS (if they exist)
-- ============================================================================

DROP FUNCTION IF EXISTS mask_email(TEXT) CASCADE;
DROP FUNCTION IF EXISTS mask_phone(TEXT) CASCADE;
DROP FUNCTION IF EXISTS mask_ip_address(TEXT) CASCADE;
DROP FUNCTION IF EXISTS sanitize_log_data(JSONB) CASCADE;
