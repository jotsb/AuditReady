/*
  # Add get_user_context RPC function

  1. New Function
    - `get_user_context(p_user_id uuid)` returns JSON with:
      - `is_admin` (boolean) - whether user has system admin role
      - `businesses` (array) - all businesses user owns or is member of
      - `roles` (object) - mapping of business_id to user's role in that business

  2. Performance Impact
    - Replaces 4+ sequential queries in AuthContext with a single RPC call
    - Reduces initial app load from 4+ round trips to 1 round trip

  3. Security
    - Function checks that caller can only request their own context via auth.uid()
*/

CREATE OR REPLACE FUNCTION get_user_context(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_is_admin boolean;
  v_businesses jsonb;
  v_roles jsonb;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: can only request own context';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM system_roles
    WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;

  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'owner_id', b.owner_id,
    'tax_id', b.tax_id,
    'currency', b.currency,
    'created_at', b.created_at,
    'suspended', b.suspended,
    'suspension_reason', b.suspension_reason,
    'soft_deleted', b.soft_deleted,
    'deletion_reason', b.deletion_reason
  )), '[]'::jsonb)
  INTO v_businesses
  FROM businesses b
  WHERE b.owner_id = p_user_id
    OR EXISTS (
      SELECT 1 FROM business_members bm
      WHERE bm.business_id = b.id AND bm.user_id = p_user_id
    );

  SELECT COALESCE(jsonb_object_agg(business_id, role), '{}'::jsonb)
  INTO v_roles
  FROM (
    SELECT b.id as business_id, 'owner'::text as role
    FROM businesses b WHERE b.owner_id = p_user_id
    UNION ALL
    SELECT bm.business_id, bm.role::text
    FROM business_members bm WHERE bm.user_id = p_user_id
  ) sub;

  result := jsonb_build_object(
    'is_admin', v_is_admin,
    'businesses', v_businesses,
    'roles', v_roles
  );

  RETURN result;
END;
$$;
