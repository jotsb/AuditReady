/*
  # Add Soft Delete Support to Receipts Table

  1. Changes
    - Add `deleted_at` (timestamptz) column to track when receipt was soft deleted
    - Add `deleted_by` (uuid) column to track who deleted the receipt
    - Add index on `deleted_at` for efficient filtering
    - Update RLS policies to exclude soft-deleted receipts from normal queries
    - Add audit trigger to log soft delete and restore operations
    - Add policy for admins to view and restore soft-deleted receipts

  2. Security
    - Normal users cannot see soft-deleted receipts in their queries
    - System admins can view and restore soft-deleted receipts
    - Audit logs capture all soft delete and restore operations

  3. Behavior
    - NULL `deleted_at` = Active receipt
    - Non-NULL `deleted_at` = Soft-deleted receipt
    - Soft-deleted receipts remain in database indefinitely
*/

-- Add soft delete columns to receipts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receipts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE receipts ADD COLUMN deleted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receipts' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE receipts ADD COLUMN deleted_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Add index for efficient filtering of soft-deleted receipts
CREATE INDEX IF NOT EXISTS idx_receipts_deleted_at ON receipts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_active ON receipts(collection_id, deleted_at) WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN receipts.deleted_at IS 'When the receipt was soft deleted (NULL = active, non-NULL = deleted)';
COMMENT ON COLUMN receipts.deleted_by IS 'User who soft deleted this receipt';

-- Update existing RLS policies to exclude soft-deleted receipts
-- Drop and recreate the view policy to include deleted_at filter
DROP POLICY IF EXISTS "Collection members can view receipts" ON receipts;
CREATE POLICY "Collection members can view receipts"
  ON receipts FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = receipts.collection_id
      AND cm.user_id = auth.uid()
    )
  );

-- Update insert policy (should only allow inserting active receipts)
DROP POLICY IF EXISTS "Collection members can create receipts" ON receipts;
CREATE POLICY "Collection members can create receipts"
  ON receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = receipts.collection_id
      AND cm.user_id = auth.uid()
    )
  );

-- Update update policy (can only update active receipts, or soft delete/restore)
DROP POLICY IF EXISTS "Collection members can update receipts" ON receipts;
CREATE POLICY "Collection members can update receipts"
  ON receipts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = receipts.collection_id
      AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = receipts.collection_id
      AND cm.user_id = auth.uid()
    )
  );

-- Update delete policy (hard deletes should only be allowed by system admins)
DROP POLICY IF EXISTS "Collection members can delete receipts" ON receipts;
CREATE POLICY "Collection members can delete receipts"
  ON receipts FOR DELETE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
  );

-- Add policy for system admins to view all receipts including soft-deleted ones
DROP POLICY IF EXISTS "System admins can view all receipts" ON receipts;
CREATE POLICY "System admins can view all receipts"
  ON receipts FOR SELECT
  TO authenticated
  USING (
    is_system_admin(auth.uid())
  );

-- Create audit trigger function for soft delete operations
CREATE OR REPLACE FUNCTION audit_receipt_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is a soft delete operation
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      changes,
      description,
      metadata
    ) VALUES (
      auth.uid(),
      'soft_delete',
      'receipts',
      NEW.id,
      jsonb_build_object(
        'deleted_at', NEW.deleted_at,
        'deleted_by', NEW.deleted_by,
        'vendor_name', NEW.vendor_name,
        'total_amount', NEW.total_amount,
        'transaction_date', NEW.transaction_date
      ),
      'Receipt soft deleted',
      jsonb_build_object(
        'collection_id', NEW.collection_id,
        'vendor_name', NEW.vendor_name,
        'total_amount', NEW.total_amount
      )
    );
  END IF;

  -- Check if this is a restore operation
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      changes,
      description,
      metadata
    ) VALUES (
      auth.uid(),
      'restore',
      'receipts',
      NEW.id,
      jsonb_build_object(
        'deleted_at', NEW.deleted_at,
        'vendor_name', NEW.vendor_name,
        'total_amount', NEW.total_amount,
        'transaction_date', NEW.transaction_date
      ),
      'Receipt restored from soft delete',
      jsonb_build_object(
        'collection_id', NEW.collection_id,
        'vendor_name', NEW.vendor_name,
        'total_amount', NEW.total_amount
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for soft delete auditing
DROP TRIGGER IF EXISTS audit_receipt_soft_delete_trigger ON receipts;
CREATE TRIGGER audit_receipt_soft_delete_trigger
  AFTER UPDATE ON receipts
  FOR EACH ROW
  WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
  EXECUTE FUNCTION audit_receipt_soft_delete();

-- Add system log entry
INSERT INTO system_logs (level, category, message, metadata)
VALUES (
  'INFO',
  'DATABASE',
  'Added soft delete support to receipts table',
  jsonb_build_object(
    'migration', 'add_soft_delete_to_receipts',
    'changes', jsonb_build_array(
      'Added deleted_at column',
      'Added deleted_by column',
      'Updated RLS policies to exclude soft-deleted receipts',
      'Added audit triggers for soft delete operations'
    )
  )
);