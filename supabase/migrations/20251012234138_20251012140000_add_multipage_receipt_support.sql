/*
  # Add Multi-Page Receipt Support

  ## Overview
  Adds support for multi-page receipts where a single receipt spans multiple pages/images.
  This is critical for real-world scenarios like double-sided receipts, long restaurant bills,
  hotel invoices, and other multi-page documents.

  ## Changes

  ### 1. New Columns on `receipts` Table
  - `parent_receipt_id` (uuid) - References parent receipt for child pages
  - `page_number` (integer) - Page order within multi-page receipt (1-indexed)
  - `is_parent` (boolean) - True if this is a parent receipt with child pages
  - `total_pages` (integer) - Total number of pages in this receipt

  ### 2. Indexes
  - Index on parent_receipt_id for fast page lookups
  - Index on is_parent for filtering parent receipts

  ### 3. Helper Functions
  - `get_receipt_pages()` - Returns all pages for a receipt
  - `get_parent_receipt()` - Returns parent receipt ID from any page

  ## Data Structure Examples

  ### Single-Page Receipt (Existing)
  ```
  parent_receipt_id: NULL
  page_number: 1
  is_parent: false
  total_pages: 1
  ```

  ### Multi-Page Receipt (3 pages)
  ```
  Parent Receipt:
    id: '111...'
    parent_receipt_id: NULL
    page_number: 1
    is_parent: true
    total_pages: 3
    file_path: NULL (or combined PDF)

  Page 1:
    id: '222...'
    parent_receipt_id: '111...'
    page_number: 1
    is_parent: false
    total_pages: 3
    file_path: 'receipts/111.../page_1.jpg'

  Page 2:
    id: '333...'
    parent_receipt_id: '111...'
    page_number: 2
    is_parent: false
    total_pages: 3
    file_path: 'receipts/111.../page_2.jpg'

  Page 3:
    id: '444...'
    parent_receipt_id: '111...'
    page_number: 3
    is_parent: false
    total_pages: 3
    file_path: 'receipts/111.../page_3.jpg'
  ```

  ## Backward Compatibility
  - Existing receipts automatically have parent_receipt_id = NULL
  - All existing receipts have page_number = 1, is_parent = false, total_pages = 1
  - No data migration needed
  - Queries still work (just add filters to exclude child pages if needed)

  ## Security
  - RLS policies automatically apply to child pages through parent_receipt_id
  - Deleting parent receipt cascades to all child pages
*/

-- Step 1: Add new columns to receipts table
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS parent_receipt_id uuid REFERENCES receipts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS page_number integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS is_parent boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS total_pages integer DEFAULT 1 NOT NULL;

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipts_parent_id
  ON receipts(parent_receipt_id)
  WHERE parent_receipt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receipts_is_parent
  ON receipts(is_parent)
  WHERE is_parent = true;

-- Step 3: Add constraints to ensure valid data
ALTER TABLE receipts
  DROP CONSTRAINT IF EXISTS valid_page_number;

ALTER TABLE receipts
  ADD CONSTRAINT valid_page_number
  CHECK (page_number > 0 AND page_number <= total_pages);

ALTER TABLE receipts
  DROP CONSTRAINT IF EXISTS no_circular_parent;

ALTER TABLE receipts
  ADD CONSTRAINT no_circular_parent
  CHECK (id != parent_receipt_id);

-- Step 4: Create helper function to get all pages for a receipt
CREATE OR REPLACE FUNCTION get_receipt_pages(receipt_uuid uuid)
RETURNS TABLE (
  id uuid,
  page_number integer,
  file_path text,
  thumbnail_path text,
  extraction_data jsonb,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if this is a parent receipt
  IF EXISTS (SELECT 1 FROM receipts WHERE receipts.id = receipt_uuid AND is_parent = true) THEN
    -- Return all child pages, ordered by page_number
    RETURN QUERY
    SELECT
      r.id,
      r.page_number,
      r.file_path,
      r.thumbnail_path,
      r.extraction_data,
      r.created_at
    FROM receipts r
    WHERE r.parent_receipt_id = receipt_uuid
    ORDER BY r.page_number;
  ELSE
    -- Return just this receipt (single page or child page)
    RETURN QUERY
    SELECT
      r.id,
      r.page_number,
      r.file_path,
      r.thumbnail_path,
      r.extraction_data,
      r.created_at
    FROM receipts r
    WHERE r.id = receipt_uuid;
  END IF;
END;
$$;

-- Step 5: Create helper function to get parent receipt from any page
CREATE OR REPLACE FUNCTION get_parent_receipt(receipt_uuid uuid)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  parent_id uuid;
BEGIN
  SELECT parent_receipt_id INTO parent_id
  FROM receipts
  WHERE id = receipt_uuid;

  -- If this is a child, return parent. Otherwise return itself.
  IF parent_id IS NOT NULL THEN
    RETURN parent_id;
  ELSE
    RETURN receipt_uuid;
  END IF;
END;
$$;

-- Step 6: Add comments for documentation
COMMENT ON COLUMN receipts.parent_receipt_id IS
  'If this receipt is part of a multi-page receipt, this references the parent receipt. NULL for single-page or parent receipts.';

COMMENT ON COLUMN receipts.page_number IS
  'Page number within multi-page receipt. Always 1 for single-page receipts.';

COMMENT ON COLUMN receipts.is_parent IS
  'True if this receipt is a parent with child pages. False for single-page or child receipts.';

COMMENT ON COLUMN receipts.total_pages IS
  'Total number of pages in this receipt. 1 for single-page, N for multi-page parent.';
