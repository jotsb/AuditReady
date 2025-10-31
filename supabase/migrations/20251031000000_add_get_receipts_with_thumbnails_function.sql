/*
  # Add get_receipts_with_thumbnails Function

  This migration adds the missing `get_receipts_with_thumbnails` function that was
  identified in the comprehensive database gap analysis.

  ## Purpose
  Provides an optimized query to fetch receipts with thumbnail support for multi-page receipts.
  For multi-page receipts, automatically uses the first page's thumbnail.

  ## Function Details
  - **Name:** get_receipts_with_thumbnails
  - **Parameters:**
    - p_collection_id: UUID of the collection to query
    - p_offset: Pagination offset (default: 0)
    - p_limit: Maximum results (default: 20)
  - **Returns:** TABLE with all receipt fields including computed thumbnail paths
  - **Security:** SECURITY DEFINER with search_path protection

  ## Implementation
  Uses CTEs to efficiently:
  1. Get base receipts (completed, not deleted, parent or standalone)
  2. Identify multi-page parents without thumbnails
  3. Fetch first page thumbnails for those parents
  4. Return unified result set with appropriate thumbnails

  ## Notes
  - This function currently exists in production database
  - Not actively used by application code yet
  - Added for migration completeness and future use
*/

-- Create the function
CREATE OR REPLACE FUNCTION public.get_receipts_with_thumbnails(
  p_collection_id uuid,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  collection_id uuid,
  uploaded_by uuid,
  vendor_name text,
  vendor_address text,
  transaction_date timestamptz,
  subtotal numeric,
  gst_amount numeric,
  pst_amount numeric,
  total_amount numeric,
  payment_method text,
  category text,
  notes text,
  file_path text,
  file_type text,
  thumbnail_path text,
  source text,
  extraction_status text,
  extraction_data jsonb,
  is_edited boolean,
  parent_receipt_id uuid,
  page_number integer,
  is_parent boolean,
  total_pages integer,
  email_message_id text,
  email_metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  requires_approval boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  -- Step 1: Get base receipts for the collection
  WITH base_receipts AS (
    SELECT r.*
    FROM receipts r
    WHERE r.collection_id = p_collection_id
      AND r.extraction_status = 'completed'
      AND r.deleted_at IS NULL
      AND (r.is_parent = TRUE OR r.parent_receipt_id IS NULL)
    ORDER BY r.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ),
  -- Step 2: Identify multi-page parents that need thumbnails from first page
  parent_ids AS (
    SELECT br.id
    FROM base_receipts br
    WHERE br.is_parent = TRUE
      AND br.total_pages > 1
      AND br.thumbnail_path IS NULL
  ),
  -- Step 3: Get first page thumbnails for those parents
  first_pages AS (
    SELECT DISTINCT ON (child.parent_receipt_id)
      child.parent_receipt_id,
      child.thumbnail_path,
      child.file_path
    FROM receipts child
    INNER JOIN parent_ids ON child.parent_receipt_id = parent_ids.id
    WHERE child.page_number = 1
      AND child.deleted_at IS NULL
  )
  -- Step 4: Return unified result with appropriate thumbnails
  SELECT
    br.id,
    br.collection_id,
    br.uploaded_by,
    br.vendor_name,
    br.vendor_address,
    br.transaction_date,
    br.subtotal,
    br.gst_amount,
    br.pst_amount,
    br.total_amount,
    br.payment_method,
    br.category,
    br.notes,
    COALESCE(fp.file_path, br.file_path) as file_path,
    br.file_type,
    COALESCE(fp.thumbnail_path, br.thumbnail_path) as thumbnail_path,
    br.source::TEXT,
    br.extraction_status,
    br.extraction_data,
    br.is_edited,
    br.parent_receipt_id,
    br.page_number,
    br.is_parent,
    br.total_pages,
    br.email_message_id,
    br.email_metadata,
    br.created_at,
    br.updated_at,
    br.deleted_at,
    br.deleted_by,
    br.requires_approval
  FROM base_receipts br
  LEFT JOIN first_pages fp ON br.id = fp.parent_receipt_id;
$$;

-- Add comment describing the function
COMMENT ON FUNCTION public.get_receipts_with_thumbnails IS
  'Optimized query to fetch paginated receipts with automatic thumbnail resolution for multi-page receipts. For parent receipts without thumbnails, uses first page thumbnail.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_receipts_with_thumbnails(uuid, integer, integer) TO authenticated;
