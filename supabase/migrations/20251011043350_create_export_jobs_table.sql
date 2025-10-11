/*
  # Create Export Jobs Table for Async Data Exports

  1. New Table
    - `export_jobs` - Tracks async export requests
      - `id` (uuid, primary key) - Unique job identifier
      - `business_id` (uuid, FK to businesses) - Business being exported
      - `requested_by` (uuid, FK to profiles) - User who requested the export
      - `status` (enum) - pending, processing, completed, failed
      - `export_type` (text) - Type of export (full_business, collection, etc.)
      - `file_path` (text) - Path to generated ZIP in storage
      - `file_size_bytes` (bigint) - Size of generated ZIP file
      - `progress_percent` (integer) - 0-100 completion percentage
      - `error_message` (text) - Error details if failed
      - `metadata` (jsonb) - Additional export details (receipts count, etc.)
      - `started_at` (timestamptz) - When processing began
      - `completed_at` (timestamptz) - When export finished
      - `expires_at` (timestamptz) - When export file will be deleted (7 days)
      - `created_at` (timestamptz) - When job was created
      
  2. Security
    - Enable RLS
    - Users can view their own export jobs
    - System admins can view all export jobs
    - Only owners and managers can create exports
    
  3. Indexes
    - Index on business_id for quick lookup
    - Index on requested_by for user's export history
    - Index on status for filtering active jobs
*/

-- Create enum for export job status
DO $$ BEGIN
  CREATE TYPE export_job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create export_jobs table
CREATE TABLE IF NOT EXISTS export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status export_job_status NOT NULL DEFAULT 'pending',
  export_type text NOT NULL DEFAULT 'full_business',
  file_path text,
  file_size_bytes bigint DEFAULT 0,
  progress_percent integer DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_export_jobs_business_id ON export_jobs(business_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_requested_by ON export_jobs(requested_by);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_expires_at ON export_jobs(expires_at);

-- Enable RLS
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view export jobs for their businesses
CREATE POLICY "Users can view export jobs for their businesses"
  ON export_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_members bm
      WHERE bm.business_id = export_jobs.business_id
        AND bm.user_id = auth.uid()
    )
  );

-- Policy: System admins can view all export jobs
CREATE POLICY "System admins can view all export jobs"
  ON export_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE system_roles.user_id = auth.uid()
        AND system_roles.role = 'admin'
    )
  );

-- Policy: Owners and managers can create export jobs
CREATE POLICY "Owners and managers can create export jobs"
  ON export_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = requested_by
    AND EXISTS (
      SELECT 1 FROM business_members bm
      WHERE bm.business_id = export_jobs.business_id
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'manager')
    )
  );

-- Policy: Service role can update export jobs (for Edge Function)
CREATE POLICY "Service role can update export jobs"
  ON export_jobs
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to cleanup expired exports
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_job RECORD;
  deleted_count integer := 0;
BEGIN
  -- Find and delete expired export files
  FOR expired_job IN
    SELECT id, file_path
    FROM export_jobs
    WHERE expires_at < now()
      AND status = 'completed'
      AND file_path IS NOT NULL
  LOOP
    -- Mark as cleaned (storage deletion happens elsewhere)
    UPDATE export_jobs
    SET 
      file_path = NULL,
      metadata = metadata || jsonb_build_object('cleaned_up_at', now())
    WHERE id = expired_job.id;
    
    deleted_count := deleted_count + 1;
  END LOOP;

  -- Log cleanup
  PERFORM log_system_event(
    'INFO',
    'MAINTENANCE',
    'Cleaned up expired export jobs',
    jsonb_build_object('deleted_count', deleted_count),
    null, null, null, null, null, null
  );
END;
$$;

COMMENT ON TABLE export_jobs IS 'Tracks async export jobs for business data exports with automatic cleanup after 7 days';
COMMENT ON FUNCTION cleanup_expired_exports IS 'Cleans up export files older than their expiration date';
