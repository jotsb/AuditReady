/*
  # Fix Storage Policies for Team Access

  1. Changes
    - Drop existing restrictive storage policies
    - Create new policies that allow team members to view receipts from their business
    - Users can only upload/update/delete their own receipts
    - Users can view ALL receipts in their business (uploaded by any team member)
  
  2. Security
    - Maintains data isolation between businesses
    - Allows team collaboration on receipts
    - Upload/modify restrictions still apply
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;

-- Create new team-aware policies

-- Policy: Users can view receipts from their business
CREATE POLICY "Team members can view business receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      -- User can view their own receipts
      (storage.foldername(name))[1] = auth.uid()::text
      OR
      -- User can view receipts from team members in the same business
      EXISTS (
        SELECT 1
        FROM business_members bm1
        INNER JOIN business_members bm2 ON bm1.business_id = bm2.business_id
        WHERE bm1.user_id = auth.uid()
          AND bm2.user_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- Policy: Users can upload their own receipts
CREATE POLICY "Users can upload own receipts"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can update their own receipts
CREATE POLICY "Users can update own receipts"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can delete their own receipts
CREATE POLICY "Users can delete own receipts"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
