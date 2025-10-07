/*
  # Add thumbnail support for receipts

  1. Changes
    - Add `thumbnail_path` column to `receipts` table to store WebP thumbnail paths
    - Thumbnail will be used for list views to improve performance
    - Main image will now be stored as WebP format
  
  2. Notes
    - Existing receipts will have NULL thumbnail_path (optional field)
    - New receipts will have thumbnails generated client-side
    - Thumbnails stored in separate folder: user_id/thumbnails/
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receipts' AND column_name = 'thumbnail_path'
  ) THEN
    ALTER TABLE receipts ADD COLUMN thumbnail_path text;
  END IF;
END $$;
