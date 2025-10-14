/*
  # Enforce Business Suspension

  1. Overview
    This migration adds RLS policies to enforce business suspension across all related tables.
    When a business is suspended, all members (except system admins) are blocked from accessing
    any data related to that business.

  2. Changes
    - Add helper functions to check if business is suspended
    - Add RESTRICTIVE policies to block suspended business access
    - System admins bypass suspension checks

  3. Tables Affected
    - businesses: Block regular users from seeing suspended businesses
    - business_members: Block access to suspended businesses
    - collections: Block access to suspended businesses
    - receipts: Block access to receipts in suspended businesses

  4. Security
    - Uses RESTRICTIVE policies (all must pass)
    - Only system admins can access suspended business data
    - All members (including owners) are blocked when business is suspended

  5. Notes
    - expense_categories is user-scoped, not business-scoped, so no suspension check needed
*/

-- Create helper function to check if business is suspended
CREATE OR REPLACE FUNCTION is_business_suspended(business_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(suspended, false)
  FROM businesses
  WHERE id = business_id_param;
$$;

-- Create helper function to check if business is soft deleted
CREATE OR REPLACE FUNCTION is_business_soft_deleted(business_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(soft_deleted, false)
  FROM businesses
  WHERE id = business_id_param;
$$;

-- Helper to get business_id from collection
CREATE OR REPLACE FUNCTION get_business_id_from_collection(collection_id_param uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT business_id
  FROM collections
  WHERE id = collection_id_param;
$$;

-- Add RESTRICTIVE policy to businesses table
-- This will be checked IN ADDITION to existing policies
DROP POLICY IF EXISTS "Block access to suspended businesses" ON businesses;
CREATE POLICY "Block access to suspended businesses"
  ON businesses
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    is_system_admin(auth.uid()) OR NOT COALESCE(suspended, false)
  );

-- Add RESTRICTIVE policy to business_members table
DROP POLICY IF EXISTS "Block access to suspended business members" ON business_members;
CREATE POLICY "Block access to suspended business members"
  ON business_members
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    is_system_admin(auth.uid()) OR NOT is_business_suspended(business_id)
  );

-- Add RESTRICTIVE policy to collections table
DROP POLICY IF EXISTS "Block access to suspended business collections" ON collections;
CREATE POLICY "Block access to suspended business collections"
  ON collections
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    is_system_admin(auth.uid()) OR NOT is_business_suspended(business_id)
  );

-- Add RESTRICTIVE policy to receipts table
DROP POLICY IF EXISTS "Block access to suspended business receipts" ON receipts;
CREATE POLICY "Block access to suspended business receipts"
  ON receipts
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    is_system_admin(auth.uid()) OR NOT is_business_suspended(get_business_id_from_collection(collection_id))
  );
