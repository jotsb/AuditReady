/*
  # Fix Storage Delete Function

  ## Overview
  Fixes the storage delete function to use the correct Supabase storage API.

  ## Changes
  - Removes the previous storage delete function implementation
  - Creates a simpler trigger that just handles the receipt deletion
  - Storage deletion will be handled by the application layer instead

  ## Notes
  The `storage.delete_object` function doesn't exist in the standard Supabase setup.
  Storage deletions should be handled in the application code before deleting the receipt record.
*/

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS trigger_delete_receipt_file ON receipts;
DROP FUNCTION IF EXISTS delete_receipt_file();

-- Create a simpler function that logs the deletion (optional)
-- Storage deletion should be handled in application code
CREATE OR REPLACE FUNCTION handle_receipt_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Just return OLD to allow the deletion to proceed
  -- Storage cleanup will be handled by the application
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for logging purposes
CREATE TRIGGER trigger_handle_receipt_deletion
  BEFORE DELETE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION handle_receipt_deletion();
