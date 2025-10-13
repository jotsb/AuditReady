/*
  # Fix Soft Delete Audit Trigger

  1. Changes
    - Fix audit_receipt_soft_delete() function to use correct audit_logs columns
    - Use resource_type instead of table_name
    - Use resource_id instead of record_id
    - Use details instead of changes and metadata

  2. Notes
    - This fixes the error when soft deleting receipts
*/

-- Fix audit trigger function for soft delete operations
CREATE OR REPLACE FUNCTION audit_receipt_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is a soft delete operation
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details
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
        'transaction_date', NEW.transaction_date,
        'collection_id', NEW.collection_id
      )
    );
  END IF;

  -- Check if this is a restore operation
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      auth.uid(),
      'restore',
      'receipts',
      NEW.id,
      jsonb_build_object(
        'vendor_name', NEW.vendor_name,
        'total_amount', NEW.total_amount,
        'transaction_date', NEW.transaction_date,
        'collection_id', NEW.collection_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;