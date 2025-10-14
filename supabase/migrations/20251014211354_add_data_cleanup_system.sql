/*
  # Data Cleanup System

  1. New Tables
    - `cleanup_jobs`
      - `id` (uuid, primary key)
      - `job_type` (text) - Type of cleanup: 'orphaned_files', 'failed_extractions', 'soft_deleted_receipts'
      - `status` (text) - Status: 'pending', 'scanning', 'ready', 'running', 'completed', 'failed', 'cancelled'
      - `items_found` (integer) - Number of items found to clean
      - `items_processed` (integer) - Number of items processed
      - `items_deleted` (integer) - Number of items successfully deleted
      - `total_size_bytes` (bigint) - Total size of items to delete
      - `deleted_size_bytes` (bigint) - Total size deleted
      - `scan_results` (jsonb) - Detailed scan results
      - `error_message` (text) - Error details if failed
      - `started_by` (uuid) - User who started the job
      - `started_at` (timestamptz) - When job started
      - `completed_at` (timestamptz) - When job completed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `cleanup_jobs` table
    - Only system admins can view and create cleanup jobs
    - All operations logged via application layer

  3. Functions
    - `scan_orphaned_files()` - Finds files in storage not in receipts table
    - `scan_failed_extractions()` - Finds receipts with permanent extraction failures
    - `scan_soft_deleted_receipts()` - Finds old soft-deleted receipts ready for permanent deletion
*/

-- Create cleanup_jobs table
CREATE TABLE IF NOT EXISTS cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (job_type IN ('orphaned_files', 'failed_extractions', 'soft_deleted_receipts', 'old_audit_logs')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scanning', 'ready', 'running', 'completed', 'failed', 'cancelled')),
  items_found integer DEFAULT 0,
  items_processed integer DEFAULT 0,
  items_deleted integer DEFAULT 0,
  total_size_bytes bigint DEFAULT 0,
  deleted_size_bytes bigint DEFAULT 0,
  scan_results jsonb DEFAULT '[]'::jsonb,
  error_message text,
  started_by uuid REFERENCES auth.users(id) NOT NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE cleanup_jobs ENABLE ROW LEVEL SECURITY;

-- System admins can view all cleanup jobs
CREATE POLICY "System admins can view cleanup jobs"
  ON cleanup_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE system_roles.user_id = auth.uid()
      AND system_roles.role = 'admin'
    )
  );

-- System admins can create cleanup jobs
CREATE POLICY "System admins can create cleanup jobs"
  ON cleanup_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE system_roles.user_id = auth.uid()
      AND system_roles.role = 'admin'
    )
    AND started_by = auth.uid()
  );

-- System admins can update cleanup jobs
CREATE POLICY "System admins can update cleanup jobs"
  ON cleanup_jobs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE system_roles.user_id = auth.uid()
      AND system_roles.role = 'admin'
    )
  );

-- Function to scan for orphaned files
CREATE OR REPLACE FUNCTION scan_orphaned_files()
RETURNS TABLE (
  storage_path text,
  file_size bigint,
  created_at timestamptz
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Find files in storage.objects that don't have a corresponding receipt
  RETURN QUERY
  SELECT 
    so.name::text as storage_path,
    COALESCE((so.metadata->>'size')::bigint, 0) as file_size,
    so.created_at
  FROM storage.objects so
  WHERE so.bucket_id = 'receipts'
  AND NOT EXISTS (
    SELECT 1 FROM receipts r
    WHERE r.file_path = so.name
    OR r.thumbnail_path = so.name
  )
  AND NOT EXISTS (
    SELECT 1 FROM receipt_pages rp
    WHERE rp.file_path = so.name
    OR rp.thumbnail_path = so.name
  )
  ORDER BY COALESCE((so.metadata->>'size')::bigint, 0) DESC;
END;
$$;

-- Function to scan for failed extractions
CREATE OR REPLACE FUNCTION scan_failed_extractions()
RETURNS TABLE (
  receipt_id uuid,
  file_path text,
  file_size bigint,
  extraction_status text,
  created_at timestamptz,
  business_id uuid
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Find receipts that have permanently failed extraction
  -- (status = 'failed' and older than 7 days)
  RETURN QUERY
  SELECT 
    r.id as receipt_id,
    r.file_path,
    COALESCE((
      SELECT (metadata->>'size')::bigint 
      FROM storage.objects 
      WHERE name = r.file_path 
      AND bucket_id = 'receipts'
      LIMIT 1
    ), 0) as file_size,
    r.extraction_status,
    r.created_at,
    r.business_id
  FROM receipts r
  WHERE r.extraction_status = 'failed'
  AND r.created_at < (now() - interval '7 days')
  AND r.deleted_at IS NULL
  ORDER BY r.created_at ASC;
END;
$$;

-- Function to scan for soft-deleted receipts ready for permanent deletion
CREATE OR REPLACE FUNCTION scan_soft_deleted_receipts()
RETURNS TABLE (
  receipt_id uuid,
  file_path text,
  file_size bigint,
  deleted_at timestamptz,
  business_id uuid,
  page_count integer
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Find soft-deleted receipts older than 30 days
  RETURN QUERY
  SELECT 
    r.id as receipt_id,
    r.file_path,
    COALESCE((
      SELECT (metadata->>'size')::bigint 
      FROM storage.objects 
      WHERE name = r.file_path 
      AND bucket_id = 'receipts'
      LIMIT 1
    ), 0) as file_size,
    r.deleted_at,
    r.business_id,
    (SELECT COUNT(*)::integer FROM receipt_pages WHERE receipt_id = r.id) as page_count
  FROM receipts r
  WHERE r.deleted_at IS NOT NULL
  AND r.deleted_at < (now() - interval '30 days')
  ORDER BY r.deleted_at ASC;
END;
$$;

-- Grant execute permissions to authenticated users (will be protected by RLS in app)
GRANT EXECUTE ON FUNCTION scan_orphaned_files() TO authenticated;
GRANT EXECUTE ON FUNCTION scan_failed_extractions() TO authenticated;
GRANT EXECUTE ON FUNCTION scan_soft_deleted_receipts() TO authenticated;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_receipts_extraction_status ON receipts(extraction_status) WHERE extraction_status = 'failed';
CREATE INDEX IF NOT EXISTS idx_receipts_deleted_at ON receipts(deleted_at) WHERE deleted_at IS NOT NULL;