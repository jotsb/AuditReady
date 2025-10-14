/*
  # Fix Data Cleanup Scan Functions

  1. Updates
    - Fix scan_failed_extractions() to get business_id via collections table
    - Fix scan_soft_deleted_receipts() to get business_id via collections table
    - Receipts table has collection_id, not business_id directly
*/

-- Fix scan for failed extractions
CREATE OR REPLACE FUNCTION scan_failed_extractions()
RETURNS TABLE (
  receipt_id uuid,
  file_path text,
  file_size bigint,
  extraction_status text,
  created_at timestamptz,
  business_id uuid
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Find receipts that have permanently failed extraction
  -- (status = 'failed' and older than 7 days)
  RETURN QUERY
  SELECT 
    r.id as receipt_id,
    r.file_path,
    COALESCE((
      SELECT (metadata->>'size')::bigint 
      FROM storage.objects 
      WHERE name = r.file_path 
      AND bucket_id = 'receipts'
      LIMIT 1
    ), 0) as file_size,
    r.extraction_status,
    r.created_at,
    c.business_id
  FROM receipts r
  LEFT JOIN collections c ON c.id = r.collection_id
  WHERE r.extraction_status = 'failed'
  AND r.created_at < (now() - interval '7 days')
  AND r.deleted_at IS NULL
  ORDER BY r.created_at ASC;
END;
$$;

-- Fix scan for soft-deleted receipts
CREATE OR REPLACE FUNCTION scan_soft_deleted_receipts()
RETURNS TABLE (
  receipt_id uuid,
  file_path text,
  file_size bigint,
  deleted_at timestamptz,
  business_id uuid,
  page_count integer
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Find soft-deleted receipts older than 30 days
  RETURN QUERY
  SELECT 
    r.id as receipt_id,
    r.file_path,
    COALESCE((
      SELECT (metadata->>'size')::bigint 
      FROM storage.objects 
      WHERE name = r.file_path 
      AND bucket_id = 'receipts'
      LIMIT 1
    ), 0) as file_size,
    r.deleted_at,
    c.business_id,
    (SELECT COUNT(*)::integer FROM receipt_pages WHERE receipt_id = r.id) as page_count
  FROM receipts r
  LEFT JOIN collections c ON c.id = r.collection_id
  WHERE r.deleted_at IS NOT NULL
  AND r.deleted_at < (now() - interval '30 days')
  ORDER BY r.deleted_at ASC;
END;
$$;