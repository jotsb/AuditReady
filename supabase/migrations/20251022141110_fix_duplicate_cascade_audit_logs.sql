/*
  # Fix Duplicate Audit Logs on Cascade Delete

  ## Problem
  When a parent receipt is deleted, CASCADE DELETE automatically deletes all child receipts (pages).
  Each deletion triggers the audit_receipt_delete trigger, creating duplicate audit log entries.

  ## Solution
  Modify the log_receipt_delete_enhanced function to:
  - Only log parent receipt deletions (or standalone receipts)
  - Skip logging child receipt deletions (they're implied by parent deletion)
  - Add metadata indicating if child receipts were also deleted

  ## Changes
  - Update log_receipt_delete_enhanced() to check if receipt is a child (has parent_receipt_id)
  - If it's a child receipt, skip audit logging (parent will log the full deletion)
  - If it's a parent/standalone receipt, log the deletion with child count
*/

CREATE OR REPLACE FUNCTION log_receipt_delete_enhanced()
RETURNS TRIGGER AS $$
DECLARE
  v_child_count INTEGER;
BEGIN
  -- Skip audit logging for child receipts (pages)
  -- The parent receipt deletion will capture the complete action
  IF OLD.parent_receipt_id IS NOT NULL THEN
    RETURN OLD;
  END IF;

  -- Count how many child receipts (pages) will be cascade deleted
  SELECT COUNT(*)
  INTO v_child_count
  FROM receipts
  WHERE parent_receipt_id = OLD.id;

  -- Log the deletion with child count information
  PERFORM log_audit_event(
    'delete_receipt',
    'receipt',
    OLD.id,
    jsonb_build_object(
      'vendor_name', OLD.vendor_name,
      'total_amount', OLD.total_amount,
      'collection_id', OLD.collection_id,
      'is_multi_page', CASE WHEN v_child_count > 0 THEN true ELSE false END,
      'page_count', CASE WHEN v_child_count > 0 THEN v_child_count + 1 ELSE 1 END
    ),
    to_jsonb(OLD),
    NULL,
    'success',
    NULL
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
