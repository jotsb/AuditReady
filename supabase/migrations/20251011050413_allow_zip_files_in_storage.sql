-- Allow ZIP Files in Storage Bucket
-- Update receipts bucket to allow application/zip mime type for exports

-- Update the receipts bucket to allow ZIP files
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed'
]
WHERE id = 'receipts';

-- Ensure the bucket exists and has proper settings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) 
DO UPDATE SET
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif', 
    'image/webp',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed'
  ],
  file_size_limit = 52428800;

-- Add storage policy for exports folder
DO $$
BEGIN
  -- Allow authenticated users to read their business exports
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can download their business exports'
  ) THEN
    CREATE POLICY "Users can download their business exports"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'receipts' 
      AND (storage.foldername(name))[1] = 'exports'
      AND EXISTS (
        SELECT 1 FROM export_jobs ej
        INNER JOIN businesses b ON ej.business_id = b.id
        INNER JOIN business_members bm ON b.id = bm.business_id
        WHERE bm.user_id = auth.uid()
        AND ej.file_path = objects.name
      )
    );
  END IF;

  -- Allow service role to upload exports
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Service role can upload exports'
  ) THEN
    CREATE POLICY "Service role can upload exports"
    ON storage.objects
    FOR INSERT
    TO service_role
    WITH CHECK (
      bucket_id = 'receipts'
      AND (storage.foldername(name))[1] = 'exports'
    );
  END IF;
END $$;
