/*
  # Add Storage Object Delete Function

  1. New Function
    - `delete_storage_object()` - Deletes a file from storage.objects table
    - Required because Storage API .remove() doesn't actually delete records
    - Used by data cleanup operations
    
  2. Security
    - SECURITY DEFINER to bypass RLS
    - Only callable by system admins (checked in application layer)
*/

CREATE OR REPLACE FUNCTION delete_storage_object(
  bucket_name text,
  object_path text
)
RETURNS void
SECURITY DEFINER
SET search_path = storage, public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete the storage object record
  DELETE FROM storage.objects
  WHERE bucket_id = bucket_name
  AND name = object_path;
END;
$$;

COMMENT ON FUNCTION delete_storage_object IS 'Deletes a storage object by bucket and path. Used by cleanup operations.';