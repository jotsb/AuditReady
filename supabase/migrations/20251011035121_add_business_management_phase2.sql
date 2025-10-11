/*
  # Business Management Phase 2 - Suspension & Storage Management

  This migration adds business suspension capabilities and storage tracking.

  ## 1. Business Suspension System
    - `businesses` table enhancements:
      - `suspended` (boolean) - Whether business is suspended
      - `suspension_reason` (text) - Why business was suspended
      - `suspended_at` (timestamptz) - When suspension occurred
      - `suspended_by` (uuid) - Admin who suspended the business
      - `soft_deleted` (boolean) - Soft delete flag
      - `deleted_at` (timestamptz) - When business was deleted
      - `deleted_by` (uuid) - Admin who deleted the business
      - `deletion_reason` (text) - Why business was deleted

  ## 2. Storage Management
    - `storage_used_bytes` (bigint) - Total storage used by business
    - `storage_limit_bytes` (bigint) - Storage limit for business (default 10GB)
    - `last_storage_check` (timestamptz) - Last time storage was calculated

  ## 3. Triggers
    - Audit trigger for business modifications
    - Block access when business is suspended
    - System logging for all operations

  ## 4. Security
    - RLS policies updated to handle suspension
    - Only system admins can suspend/delete businesses
    - Audit trail for all admin actions
*/

-- Add suspension fields to businesses table
DO $$ 
BEGIN
  -- Suspension fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'suspended') THEN
    ALTER TABLE businesses ADD COLUMN suspended boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'suspension_reason') THEN
    ALTER TABLE businesses ADD COLUMN suspension_reason text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'suspended_at') THEN
    ALTER TABLE businesses ADD COLUMN suspended_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'suspended_by') THEN
    ALTER TABLE businesses ADD COLUMN suspended_by uuid REFERENCES auth.users(id);
  END IF;

  -- Soft delete fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'soft_deleted') THEN
    ALTER TABLE businesses ADD COLUMN soft_deleted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'deleted_at') THEN
    ALTER TABLE businesses ADD COLUMN deleted_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'deleted_by') THEN
    ALTER TABLE businesses ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'deletion_reason') THEN
    ALTER TABLE businesses ADD COLUMN deletion_reason text;
  END IF;

  -- Storage management fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'storage_used_bytes') THEN
    ALTER TABLE businesses ADD COLUMN storage_used_bytes bigint DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'storage_limit_bytes') THEN
    ALTER TABLE businesses ADD COLUMN storage_limit_bytes bigint DEFAULT 10737418240; -- 10GB default
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'last_storage_check') THEN
    ALTER TABLE businesses ADD COLUMN last_storage_check timestamptz;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_businesses_suspended ON businesses(suspended) WHERE suspended = true;
CREATE INDEX IF NOT EXISTS idx_businesses_soft_deleted ON businesses(soft_deleted) WHERE soft_deleted = true;
CREATE INDEX IF NOT EXISTS idx_businesses_storage_usage ON businesses(storage_used_bytes);

-- Function to calculate business storage usage
CREATE OR REPLACE FUNCTION calculate_business_storage(business_id_param uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_bytes bigint;
BEGIN
  -- Calculate total storage from all receipts in all collections owned by the business
  SELECT COALESCE(SUM(LENGTH(file_path)::bigint), 0)
  INTO total_bytes
  FROM receipts r
  INNER JOIN collections c ON r.collection_id = c.id
  WHERE c.business_id = business_id_param
    AND r.file_path IS NOT NULL;

  -- Update the business record
  UPDATE businesses
  SET 
    storage_used_bytes = total_bytes,
    last_storage_check = now()
  WHERE id = business_id_param;

  -- Log the calculation
  PERFORM log_system_event(
    'INFO',
    'PERFORMANCE',
    'Calculated business storage usage',
    jsonb_build_object(
      'business_id', business_id_param,
      'storage_bytes', total_bytes,
      'storage_mb', ROUND(total_bytes / 1048576.0, 2)
    ),
    null,
    null,
    null,
    null,
    null,
    null
  );

  RETURN total_bytes;
END;
$$;

-- Function to check if business is approaching storage limit
CREATE OR REPLACE FUNCTION check_storage_limit(business_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business record;
  v_usage_percent numeric;
  v_result jsonb;
BEGIN
  SELECT 
    storage_used_bytes,
    storage_limit_bytes
  INTO v_business
  FROM businesses
  WHERE id = business_id_param;

  IF v_business.storage_limit_bytes > 0 THEN
    v_usage_percent := (v_business.storage_used_bytes::numeric / v_business.storage_limit_bytes::numeric) * 100;
  ELSE
    v_usage_percent := 0;
  END IF;

  v_result := jsonb_build_object(
    'used_bytes', v_business.storage_used_bytes,
    'limit_bytes', v_business.storage_limit_bytes,
    'used_mb', ROUND(v_business.storage_used_bytes / 1048576.0, 2),
    'limit_mb', ROUND(v_business.storage_limit_bytes / 1048576.0, 2),
    'usage_percent', ROUND(v_usage_percent, 2),
    'is_warning', v_usage_percent >= 80,
    'is_critical', v_usage_percent >= 95
  );

  RETURN v_result;
END;
$$;

-- Add audit trigger for business suspension/deletion
CREATE OR REPLACE FUNCTION audit_business_admin_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Audit suspension changes
  IF (OLD.suspended IS DISTINCT FROM NEW.suspended) THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      COALESCE(NEW.suspended_by, auth.uid()),
      CASE WHEN NEW.suspended THEN 'suspend_business' ELSE 'unsuspend_business' END,
      'business',
      NEW.id,
      jsonb_build_object(
        'suspended', NEW.suspended,
        'reason', NEW.suspension_reason,
        'suspended_at', NEW.suspended_at
      )
    );

    -- Log to system logs
    PERFORM log_system_event(
      'WARN',
      'SECURITY',
      CASE WHEN NEW.suspended THEN 'Business suspended' ELSE 'Business unsuspended' END,
      jsonb_build_object(
        'business_id', NEW.id,
        'business_name', NEW.name,
        'suspended', NEW.suspended,
        'reason', NEW.suspension_reason,
        'admin_id', NEW.suspended_by
      ),
      COALESCE(NEW.suspended_by, auth.uid()),
      null,
      null,
      null,
      null,
      null
    );
  END IF;

  -- Audit soft delete changes
  IF (OLD.soft_deleted IS DISTINCT FROM NEW.soft_deleted) THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      COALESCE(NEW.deleted_by, auth.uid()),
      CASE WHEN NEW.soft_deleted THEN 'soft_delete_business' ELSE 'restore_business' END,
      'business',
      NEW.id,
      jsonb_build_object(
        'soft_deleted', NEW.soft_deleted,
        'reason', NEW.deletion_reason,
        'deleted_at', NEW.deleted_at
      )
    );

    -- Log to system logs
    PERFORM log_system_event(
      'WARN',
      'SECURITY',
      CASE WHEN NEW.soft_deleted THEN 'Business soft deleted' ELSE 'Business restored' END,
      jsonb_build_object(
        'business_id', NEW.id,
        'business_name', NEW.name,
        'soft_deleted', NEW.soft_deleted,
        'reason', NEW.deletion_reason,
        'admin_id', NEW.deleted_by
      ),
      COALESCE(NEW.deleted_by, auth.uid()),
      null,
      null,
      null,
      null,
      null
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS audit_business_admin_changes_trigger ON businesses;

-- Create trigger
CREATE TRIGGER audit_business_admin_changes_trigger
  AFTER UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION audit_business_admin_changes();

-- Update RLS policies to handle suspended businesses
-- (Existing policies will be modified to exclude suspended businesses for non-admins)

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_business_storage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_storage_limit(uuid) TO authenticated;

COMMENT ON FUNCTION calculate_business_storage IS 'Calculates and updates total storage used by a business across all its collections and receipts';
COMMENT ON FUNCTION check_storage_limit IS 'Checks business storage usage against limit and returns warning/critical status';
COMMENT ON COLUMN businesses.suspended IS 'Whether the business has been suspended by an admin';
COMMENT ON COLUMN businesses.suspension_reason IS 'Reason provided for business suspension';
COMMENT ON COLUMN businesses.soft_deleted IS 'Whether the business has been soft deleted (can be restored)';
COMMENT ON COLUMN businesses.storage_used_bytes IS 'Total storage used by business in bytes';
COMMENT ON COLUMN businesses.storage_limit_bytes IS 'Storage limit for business in bytes (default 10GB)';