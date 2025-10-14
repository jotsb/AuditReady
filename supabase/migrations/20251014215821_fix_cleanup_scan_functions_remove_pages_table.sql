/*
  # Fix Data Cleanup Scan Functions - Remove receipt_pages reference

  1. Updates
    - Fix scan_orphaned_files() to remove receipt_pages table reference
    - Multipage receipts are stored in receipts table with parent_receipt_id
    - Fix scan_soft_deleted_receipts() to count pages correctly from receipts table
*/

-- Fix scan for orphaned files - remove receipt_pages reference
CREATE OR REPLACE FUNCTION scan_orphaned_files()
RETURNS TABLE (
  storage_path text,
  file_size bigint,
  created_at timestamptz
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Find files in storage.objects that don't have a corresponding receipt
  -- Check both main receipts and child pages (parent_receipt_id IS NOT NULL)
  RETURN QUERY
  SELECT 
    so.name::text as storage_path,
    COALESCE((so.metadata->>'size')::bigint, 0) as file_size,
    so.created_at
  FROM storage.objects so
  WHERE so.bucket_id = 'receipts'
  AND NOT EXISTS (
    SELECT 1 FROM receipts r
    WHERE r.file_path = so.name
    OR r.thumbnail_path = so.name
  )
  ORDER BY COALESCE((so.metadata->>'size')::bigint, 0) DESC;
END;
$$;

-- Fix scan for soft-deleted receipts - count pages from receipts table
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
  -- Count child pages where parent_receipt_id = receipt id
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
    COALESCE((SELECT COUNT(*)::integer FROM receipts WHERE parent_receipt_id = r.id), 0) as page_count
  FROM receipts r
  LEFT JOIN collections c ON c.id = r.collection_id
  WHERE r.deleted_at IS NOT NULL
  AND r.deleted_at < (now() - interval '30 days')
  ORDER BY r.deleted_at ASC;
END;
$$;