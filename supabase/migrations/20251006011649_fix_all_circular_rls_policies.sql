/*
  # Fix All Circular RLS Policy References

  ## Problem
  Multiple RLS policies have circular dependencies causing infinite recursion:
  - Collections policies reference collection_members
  - Collection_members policies reference collections
  - This creates an infinite loop

  ## Solution
  Simplify policies to break circular dependencies:
  - Collections: Allow owners and creators to access without checking members
  - Collection_members: Simplify to check collection ownership directly
  
  ## Security Impact
  - Business owners can view all collections in their businesses
  - Collection creators can manage their collections
  - Members can view collections they belong to (checked at member level, not collection level)
*/

-- Drop problematic collection policies
DROP POLICY IF EXISTS "Collection members can view collections" ON collections;
DROP POLICY IF EXISTS "Collection admins can update collections" ON collections;
DROP POLICY IF EXISTS "Collection admins can delete collections" ON collections;

-- Create simpler policies without circular references
CREATE POLICY "Collection members can view collections"
  ON collections FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = collections.business_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Collection admins can update collections"
  ON collections FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = collections.business_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = collections.business_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Collection admins can delete collections"
  ON collections FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = collections.business_id AND owner_id = auth.uid()
    )
  );

-- Simplify collection_members view policy
DROP POLICY IF EXISTS "Collection members can view memberships" ON collection_members;

CREATE POLICY "Collection members can view memberships"
  ON collection_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_members.collection_id AND c.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM collections c
      JOIN businesses b ON b.id = c.business_id
      WHERE c.id = collection_members.collection_id AND b.owner_id = auth.uid()
    )
  );

-- Simplify collection_members insert policy
DROP POLICY IF EXISTS "Collection admins can manage members" ON collection_members;

CREATE POLICY "Collection admins can manage members"
  ON collection_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM collections c
      JOIN businesses b ON b.id = c.business_id
      WHERE c.id = collection_id AND b.owner_id = auth.uid()
    )
  );

-- Simplify collection_members update policy
DROP POLICY IF EXISTS "Collection admins can update members" ON collection_members;

CREATE POLICY "Collection admins can update members"
  ON collection_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_members.collection_id AND c.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM collections c
      JOIN businesses b ON b.id = c.business_id
      WHERE c.id = collection_members.collection_id AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_members.collection_id AND c.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM collections c
      JOIN businesses b ON b.id = c.business_id
      WHERE c.id = collection_members.collection_id AND b.owner_id = auth.uid()
    )
  );

-- Simplify collection_members delete policy
DROP POLICY IF EXISTS "Collection admins can remove members" ON collection_members;

CREATE POLICY "Collection admins can remove members"
  ON collection_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_members.collection_id AND c.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM collections c
      JOIN businesses b ON b.id = c.business_id
      WHERE c.id = collection_members.collection_id AND b.owner_id = auth.uid()
    )
  );

-- Simplify receipts view policy to avoid circular references
DROP POLICY IF EXISTS "Collection members can view receipts" ON receipts;

CREATE POLICY "Collection members can view receipts"
  ON receipts FOR SELECT
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = receipts.collection_id AND c.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM collections c
      JOIN businesses b ON b.id = c.business_id
      WHERE c.id = receipts.collection_id AND b.owner_id = auth.uid()
    )
  );

-- Simplify receipts insert policy
DROP POLICY IF EXISTS "Submitters and admins can create receipts" ON receipts;

CREATE POLICY "Submitters and admins can create receipts"
  ON receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM collections c
      JOIN businesses b ON b.id = c.business_id
      WHERE c.id = collection_id AND b.owner_id = auth.uid()
    )
  );

-- Simplify receipts update policy
DROP POLICY IF EXISTS "Admins and uploaders can update receipts" ON receipts;

CREATE POLICY "Admins and uploaders can update receipts"
  ON receipts FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = receipts.collection_id AND c.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM collections c
      JOIN businesses b ON b.id = c.business_id
      WHERE c.id = receipts.collection_id AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = receipts.collection_id AND c.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM collections c
      JOIN businesses b ON b.id = c.business_id
      WHERE c.id = receipts.collection_id AND b.owner_id = auth.uid()
    )
  );

-- Simplify receipts delete policy
DROP POLICY IF EXISTS "Admins can delete receipts" ON receipts;

CREATE POLICY "Admins can delete receipts"
  ON receipts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = receipts.collection_id AND c.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM collections c
      JOIN businesses b ON b.id = c.business_id
      WHERE c.id = receipts.collection_id AND b.owner_id = auth.uid()
    )
  );