/*
  # Initial Setup Prerequisites for Self-Hosted Supabase

  This migration MUST run FIRST on a fresh Supabase installation.
  It creates all the prerequisites that the other migrations assume exist.

  ## What This Creates

  1. Required PostgreSQL Extensions
     - uuid-ossp (UUID generation)
     - pg_net (HTTP requests for webhooks)
     - pg_trgm (Text search for fuzzy matching)

  2. Storage Buckets
     - receipts bucket with proper MIME types and size limits
     - RLS policies for secure file access

  3. Helper Functions
     - Functions that other migrations depend on

  ## Usage

  On Bolt Cloud: This migration is automatically included
  On Self-Hosted: Run this FIRST before any other migrations

  ## Security

  - All storage buckets are private by default
  - RLS policies enforce user-level access control
  - Extensions are created in proper schemas
*/

-- =====================================================
-- SECTION 1: POSTGRESQL EXTENSIONS
-- =====================================================

-- UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

-- pg_net for HTTP requests (webhooks, external API calls)
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- pg_trgm for fuzzy text search and duplicate detection
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- =====================================================
-- SECTION 2: STORAGE BUCKET SETUP
-- =====================================================

-- Create receipts storage bucket
-- This is where all receipt images/PDFs are stored
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,  -- Private bucket, requires authentication
  52428800,  -- 50 MB max file size
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit = EXCLUDED.file_size_limit;

-- =====================================================
-- SECTION 3: STORAGE RLS POLICIES (BASIC)
-- =====================================================

-- Drop any existing policies to ensure clean state
DROP POLICY IF EXISTS "Users can view own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;

-- Basic policy: Users can upload their own receipts
-- This will be enhanced by later migrations for team access
CREATE POLICY "Users can upload own receipts"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Basic policy: Users can view their own receipts
CREATE POLICY "Users can view own receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Basic policy: Users can update their own receipts
CREATE POLICY "Users can update own receipts"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Basic policy: Users can delete their own receipts
CREATE POLICY "Users can delete own receipts"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- SECTION 4: HELPER FUNCTIONS
-- =====================================================

-- Function to safely get current user's role
-- Used by many RLS policies throughout the system
CREATE OR REPLACE FUNCTION get_user_role(user_id_param uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- Check if user exists in profiles
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = user_id_param
        AND p.email LIKE '%@auditproof.com'  -- System admin check
      ) THEN 'system_admin'
      ELSE 'user'
    END
  INTO user_role;

  RETURN COALESCE(user_role, 'user');
END;
$$;

-- Function to check if user is a system admin
-- Used by admin-only features
CREATE OR REPLACE FUNCTION is_system_admin(user_id_param uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_id_param
    AND p.email LIKE '%@auditproof.com'
  );
END;
$$;

-- =====================================================
-- SECTION 5: TRIGGER FUNCTION STUBS
-- =====================================================

-- Create stub logging functions that later migrations will replace
-- This prevents errors when migrations reference these functions

-- Stub for system event logging
CREATE OR REPLACE FUNCTION log_system_event(
  level_param text,
  category_param text,
  message_param text,
  details_param jsonb DEFAULT NULL,
  user_id_param uuid DEFAULT NULL,
  ip_address_param inet DEFAULT NULL,
  user_agent_param text DEFAULT NULL,
  request_path_param text DEFAULT NULL,
  request_method_param text DEFAULT NULL,
  error_code_param text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id uuid;
BEGIN
  -- Stub function - will be replaced by comprehensive logging migration
  -- For now, just return a dummy UUID to prevent errors
  RETURN uuid_generate_v4();
END;
$$;

-- Stub for audit logging
CREATE OR REPLACE FUNCTION log_audit_event(
  action_param text,
  resource_type_param text,
  resource_id_param uuid DEFAULT NULL,
  user_id_param uuid DEFAULT NULL,
  details_param jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id uuid;
BEGIN
  -- Stub function - will be replaced by audit logging migration
  RETURN uuid_generate_v4();
END;
$$;

-- =====================================================
-- SECTION 6: PROFILE CREATION TRIGGER
-- =====================================================

-- This trigger automatically creates a profile when a new user signs up
-- CRITICAL: This must exist before users can sign up or login
CREATE OR REPLACE FUNCTION public.sync_user_email_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Insert new profile with email and full_name from auth.users
  -- full_name is extracted from raw_user_meta_data if available
  INSERT INTO public.profiles (id, email, full_name, mfa_enabled)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    false
  )
  ON CONFLICT (id)
  DO UPDATE SET
    email = NEW.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to auto-create profiles
-- NOTE: This will be created AFTER profiles table exists (in next migration)
-- For now, we just create the function

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify extensions are installed
DO $$
DECLARE
  ext_count int;
BEGIN
  SELECT COUNT(*) INTO ext_count
  FROM pg_extension
  WHERE extname IN ('uuid-ossp', 'pg_net', 'pg_trgm');

  IF ext_count < 3 THEN
    RAISE WARNING 'Not all required extensions were installed. Expected 3, got %', ext_count;
  ELSE
    RAISE NOTICE 'All required extensions installed successfully';
  END IF;
END $$;

-- Verify storage bucket exists
DO $$
DECLARE
  bucket_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'receipts'
  ) INTO bucket_exists;

  IF NOT bucket_exists THEN
    RAISE EXCEPTION 'Receipts storage bucket was not created';
  ELSE
    RAISE NOTICE 'Receipts storage bucket created successfully';
  END IF;
END $$;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔═══════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  INITIAL SETUP COMPLETE                               ║';
  RAISE NOTICE '╚═══════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'Prerequisites installed:';
  RAISE NOTICE '  ✓ PostgreSQL extensions (uuid-ossp, pg_net, pg_trgm)';
  RAISE NOTICE '  ✓ Storage buckets (receipts)';
  RAISE NOTICE '  ✓ Basic storage RLS policies';
  RAISE NOTICE '  ✓ Helper functions';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now run the remaining migrations in order.';
  RAISE NOTICE '';
END $$;
