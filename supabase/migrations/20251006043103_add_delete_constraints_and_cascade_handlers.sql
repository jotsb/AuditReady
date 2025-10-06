/*
  # Add Delete Constraints and Cascade Handlers

  ## Overview
  Implements proper delete behavior for businesses and collections.

  ## Changes

  ### 1. Business Delete Protection
  - Changes the foreign key constraint from `ON DELETE CASCADE` to `ON DELETE RESTRICT`
  - Prevents deletion of businesses that have associated collections
  - Users must delete collections first before deleting the business

  ### 2. Storage File Cleanup Function
  - Creates a trigger function to automatically delete receipt files from storage
  - When a receipt is deleted, the associated file in Supabase Storage is removed
  - Prevents orphaned files in storage

  ### 3. Cascade Delete Trigger
  - Automatically triggers when collections are deleted
  - Cascades to receipts (already handled by FK constraint)
  - Cleanup function handles file deletion for each receipt

  ## Security
  - No changes to RLS policies
  - Delete operations still require proper permissions
*/

-- Drop existing constraint on collections
ALTER TABLE collections 
  DROP CONSTRAINT IF EXISTS collections_business_id_fkey;

-- Add new RESTRICT constraint to prevent business deletion if collections exist
ALTER TABLE collections
  ADD CONSTRAINT collections_business_id_fkey 
  FOREIGN KEY (business_id) 
  REFERENCES businesses(id) 
  ON DELETE RESTRICT;

-- Create function to delete receipt files from storage
CREATE OR REPLACE FUNCTION delete_receipt_file()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the file from storage if file_path exists
  IF OLD.file_path IS NOT NULL THEN
    -- Use Supabase storage API to delete the file
    -- The file path is stored in the format: user_id/filename
    PERFORM storage.delete_object('receipts', OLD.file_path);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically delete files when receipts are deleted
DROP TRIGGER IF EXISTS trigger_delete_receipt_file ON receipts;
CREATE TRIGGER trigger_delete_receipt_file
  BEFORE DELETE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION delete_receipt_file();
