/*
  # Role-Based Access Control (RBAC) System - Phase 1

  ## Overview
  This migration implements a comprehensive multi-tenant RBAC system with:
  - System-level roles (Admin, Technical Support)
  - Business-level roles (Owner, Manager, Member)
  - User invitations with email workflow
  - Receipt approval workflow (optional per business)

  ## New Tables

  ### 1. `system_roles`
  Tracks system-wide administrative roles
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `role` (text: 'admin' or 'technical_support')
  - `granted_by` (uuid, references auth.users)
  - `granted_at` (timestamptz)

  ### 2. `business_members`
  Junction table linking users to businesses with roles
  - `id` (uuid, primary key)
  - `business_id` (uuid, references businesses)
  - `user_id` (uuid, references auth.users)
  - `role` (text: 'owner', 'manager', 'member')
  - `invited_by` (uuid, references auth.users)
  - `joined_at` (timestamptz)
  - Unique constraint on (business_id, user_id)

  ### 3. `invitations`
  Pending invitations for users to join businesses
  - `id` (uuid, primary key)
  - `business_id` (uuid, references businesses)
  - `email` (text)
  - `role` (text: 'owner', 'manager', 'member')
  - `invited_by` (uuid, references auth.users)
  - `token` (uuid, unique - for acceptance link)
  - `status` (text: 'pending', 'accepted', 'rejected', 'expired')
  - `expires_at` (timestamptz)
  - `created_at` (timestamptz)

  ### 4. `receipt_approvals`
  Tracks approval status for receipts when workflow is enabled
  - `id` (uuid, primary key)
  - `receipt_id` (uuid, references receipts)
  - `status` (text: 'pending', 'approved', 'rejected')
  - `submitted_by` (uuid, references auth.users)
  - `reviewed_by` (uuid, references auth.users, nullable)
  - `reviewed_at` (timestamptz, nullable)
  - `notes` (text, nullable)
  - `created_at` (timestamptz)

  ## Modified Tables

  ### `businesses`
  Added:
  - `require_approval_workflow` (boolean) - Toggle approval requirement
  - `created_by` (uuid) - Track who created the business

  ### `receipts`
  Added:
  - `uploaded_by` (uuid) - Track who uploaded/created the receipt
  - `requires_approval` (boolean) - Whether this receipt needs approval

  ## Security (RLS Policies)

  All tables have RLS enabled with policies based on:
  - System admins: Full access to everything
  - Business owners: Full access to their business data
  - Business managers: Read/write access, limited delete
  - Business members: Read own data, create own receipts
  - Invitation acceptance: Users can view invitations sent to their email

  ## Important Notes

  1. **Backwards Compatibility**: Existing businesses will have their creator set as owner
  2. **System Admin**: First system admin must be set manually (see TODO below)
  3. **Approval Workflow**: Disabled by default for all businesses
  4. **Invitations**: Expire after 7 days by default
*/

-- ============================================================================
-- 1. CREATE ENUM TYPES
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE system_role_type AS ENUM ('admin', 'technical_support');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE business_role_type AS ENUM ('owner', 'manager', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status_type AS ENUM ('pending', 'accepted', 'rejected', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE approval_status_type AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. CREATE NEW TABLES
-- ============================================================================

-- System Roles Table
CREATE TABLE IF NOT EXISTS system_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role system_role_type NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Business Members Table
CREATE TABLE IF NOT EXISTS business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role business_role_type NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(business_id, user_id)
);

-- Invitations Table
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role business_role_type NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  token uuid UNIQUE DEFAULT gen_random_uuid() NOT NULL,
  status invitation_status_type DEFAULT 'pending' NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '7 days') NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Receipt Approvals Table
CREATE TABLE IF NOT EXISTS receipt_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid REFERENCES receipts(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status approval_status_type DEFAULT 'pending' NOT NULL,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- 3. MODIFY EXISTING TABLES
-- ============================================================================

-- Add columns to businesses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'require_approval_workflow'
  ) THEN
    ALTER TABLE businesses ADD COLUMN require_approval_workflow boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE businesses ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add columns to receipts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receipts' AND column_name = 'uploaded_by'
  ) THEN
    ALTER TABLE receipts ADD COLUMN uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receipts' AND column_name = 'requires_approval'
  ) THEN
    ALTER TABLE receipts ADD COLUMN requires_approval boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_system_roles_user_id ON system_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_business_id ON business_members(business_id);
CREATE INDEX IF NOT EXISTS idx_business_members_user_id ON business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_receipt_approvals_receipt_id ON receipt_approvals(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_approvals_status ON receipt_approvals(status);
CREATE INDEX IF NOT EXISTS idx_receipts_uploaded_by ON receipts(uploaded_by);

-- ============================================================================
-- 5. MIGRATE EXISTING DATA
-- ============================================================================

-- Set created_by for existing businesses to their owner_id
UPDATE businesses
SET created_by = owner_id
WHERE created_by IS NULL;

-- Create business_member entries for existing business owners
INSERT INTO business_members (business_id, user_id, role, joined_at)
SELECT id, owner_id, 'owner'::business_role_type, created_at
FROM businesses
WHERE NOT EXISTS (
  SELECT 1 FROM business_members
  WHERE business_members.business_id = businesses.id
  AND business_members.user_id = businesses.owner_id
);

-- Set uploaded_by for existing receipts to the business owner (through collections)
UPDATE receipts r
SET uploaded_by = b.owner_id
FROM collections c
JOIN businesses b ON c.business_id = b.id
WHERE r.collection_id = c.id AND r.uploaded_by IS NULL;

-- ============================================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE system_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_approvals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Drop existing helper functions to avoid parameter name conflicts
DROP FUNCTION IF EXISTS is_system_admin(uuid);
DROP FUNCTION IF EXISTS is_technical_support(uuid);
DROP FUNCTION IF EXISTS get_business_role(uuid, uuid);
DROP FUNCTION IF EXISTS is_business_owner(uuid, uuid);
DROP FUNCTION IF EXISTS is_business_owner_or_manager(uuid, uuid);
DROP FUNCTION IF EXISTS is_business_member(uuid, uuid);

-- Check if user is a system admin
CREATE FUNCTION is_system_admin(user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM system_roles
    WHERE system_roles.user_id = $1
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is technical support
CREATE FUNCTION is_technical_support(user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM system_roles
    WHERE system_roles.user_id = $1
    AND role IN ('admin', 'technical_support')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get user's role in a business
CREATE FUNCTION get_business_role(user_id uuid, business_id uuid)
RETURNS business_role_type AS $$
  SELECT role FROM business_members
  WHERE business_members.user_id = $1
  AND business_members.business_id = $2
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is business owner
CREATE FUNCTION is_business_owner(user_id uuid, business_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_members
    WHERE business_members.user_id = $1
    AND business_members.business_id = $2
    AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is business owner or manager
CREATE FUNCTION is_business_owner_or_manager(user_id uuid, business_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_members
    WHERE business_members.user_id = $1
    AND business_members.business_id = $2
    AND role IN ('owner', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is a member of a business
CREATE FUNCTION is_business_member(user_id uuid, business_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_members
    WHERE business_members.user_id = $1
    AND business_members.business_id = $2
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- 8. RLS POLICIES - SYSTEM_ROLES
-- ============================================================================

DROP POLICY IF EXISTS "System admins can view all system roles" ON system_roles;
CREATE POLICY "System admins can view all system roles"
  ON system_roles FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "System admins can insert system roles" ON system_roles;
CREATE POLICY "System admins can insert system roles"
  ON system_roles FOR INSERT
  TO authenticated
  WITH CHECK (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "System admins can delete system roles" ON system_roles;
CREATE POLICY "System admins can delete system roles"
  ON system_roles FOR DELETE
  TO authenticated
  USING (is_system_admin(auth.uid()));

-- ============================================================================
-- 9. RLS POLICIES - BUSINESS_MEMBERS
-- ============================================================================

DROP POLICY IF EXISTS "System admins can view all business members" ON business_members;
CREATE POLICY "System admins can view all business members"
  ON business_members FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Business members can view their own memberships" ON business_members;
CREATE POLICY "Business members can view their own memberships"
  ON business_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_business_member(auth.uid(), business_id)
  );

DROP POLICY IF EXISTS "Business owners can insert members" ON business_members;
CREATE POLICY "Business owners can insert members"
  ON business_members FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), business_id)
  );

DROP POLICY IF EXISTS "Business owners can update member roles" ON business_members;
CREATE POLICY "Business owners can update member roles"
  ON business_members FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), business_id)
  );

DROP POLICY IF EXISTS "Business owners can remove members" ON business_members;
CREATE POLICY "Business owners can remove members"
  ON business_members FOR DELETE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), business_id)
  );

-- ============================================================================
-- 10. RLS POLICIES - INVITATIONS
-- ============================================================================

DROP POLICY IF EXISTS "System admins can view all invitations" ON invitations;
CREATE POLICY "System admins can view all invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Business owners can view their business invitations" ON invitations;
CREATE POLICY "Business owners can view their business invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (is_business_owner_or_manager(auth.uid(), business_id));

DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON invitations;
CREATE POLICY "Users can view invitations sent to their email"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Business owners can create invitations" ON invitations;
CREATE POLICY "Business owners can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), business_id)
  );

DROP POLICY IF EXISTS "Business owners can update invitations" ON invitations;
CREATE POLICY "Business owners can update invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), business_id)
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Business owners can delete invitations" ON invitations;
CREATE POLICY "Business owners can delete invitations"
  ON invitations FOR DELETE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), business_id)
  );

-- ============================================================================
-- 11. RLS POLICIES - RECEIPT_APPROVALS
-- ============================================================================

DROP POLICY IF EXISTS "System admins can view all receipt approvals" ON receipt_approvals;
CREATE POLICY "System admins can view all receipt approvals"
  ON receipt_approvals FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Business members can view approvals in their business" ON receipt_approvals;
CREATE POLICY "Business members can view approvals in their business"
  ON receipt_approvals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM receipts r
      JOIN collections c ON r.collection_id = c.id
      WHERE r.id = receipt_approvals.receipt_id
      AND is_business_member(auth.uid(), c.business_id)
    )
  );

DROP POLICY IF EXISTS "Members can create approval requests" ON receipt_approvals;
CREATE POLICY "Members can create approval requests"
  ON receipt_approvals FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system_admin(auth.uid())
    OR submitted_by = auth.uid()
  );

DROP POLICY IF EXISTS "Owners and managers can update approvals" ON receipt_approvals;
CREATE POLICY "Owners and managers can update approvals"
  ON receipt_approvals FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM receipts r
      JOIN collections c ON r.collection_id = c.id
      WHERE r.id = receipt_approvals.receipt_id
      AND is_business_owner_or_manager(auth.uid(), c.business_id)
    )
  );

-- ============================================================================
-- 12. UPDATE EXISTING RLS POLICIES FOR BUSINESSES
-- ============================================================================

-- Drop old business policies
DROP POLICY IF EXISTS "Users can view own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can create own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can update own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can delete own businesses" ON businesses;

-- New business policies considering business_members
DROP POLICY IF EXISTS "System admins can view all businesses" ON businesses;
CREATE POLICY "System admins can view all businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Business members can view their businesses" ON businesses;
CREATE POLICY "Business members can view their businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (is_business_member(auth.uid(), id));

DROP POLICY IF EXISTS "Users can create businesses" ON businesses;
CREATE POLICY "Users can create businesses"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Business owners can update their businesses" ON businesses;
CREATE POLICY "Business owners can update their businesses"
  ON businesses FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), id)
  );

DROP POLICY IF EXISTS "Business owners can delete their businesses" ON businesses;
CREATE POLICY "Business owners can delete their businesses"
  ON businesses FOR DELETE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), id)
  );

-- ============================================================================
-- 13. UPDATE EXISTING RLS POLICIES FOR RECEIPTS
-- ============================================================================

-- Drop old receipt policies
DROP POLICY IF EXISTS "Users can view own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can create own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can update own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can delete own receipts" ON receipts;

-- New receipt policies considering business_members and roles
DROP POLICY IF EXISTS "System admins can view all receipts" ON receipts;
CREATE POLICY "System admins can view all receipts"
  ON receipts FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Business members can view receipts in their business" ON receipts;
CREATE POLICY "Business members can view receipts in their business"
  ON receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = receipts.collection_id
      AND is_business_member(auth.uid(), c.business_id)
    )
  );

DROP POLICY IF EXISTS "Business members can create receipts" ON receipts;
CREATE POLICY "Business members can create receipts"
  ON receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = receipts.collection_id
      AND is_business_member(auth.uid(), c.business_id)
    )
  );

DROP POLICY IF EXISTS "Owners and managers can update any receipt" ON receipts;
CREATE POLICY "Owners and managers can update any receipt"
  ON receipts FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = receipts.collection_id
      AND is_business_owner_or_manager(auth.uid(), c.business_id)
    )
  );

DROP POLICY IF EXISTS "Only owners can delete receipts" ON receipts;
CREATE POLICY "Only owners can delete receipts"
  ON receipts FOR DELETE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = receipts.collection_id
      AND is_business_owner(auth.uid(), c.business_id)
    )
  );

-- ============================================================================
-- 14. UPDATE EXISTING RLS POLICIES FOR OTHER TABLES
-- ============================================================================

-- Collections policies
DROP POLICY IF EXISTS "Users can view own collections" ON collections;
DROP POLICY IF EXISTS "System admins can view all collections" ON collections;
CREATE POLICY "System admins can view all collections"
  ON collections FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Business members can view collections in their business" ON collections;
CREATE POLICY "Business members can view collections in their business"
  ON collections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = collections.business_id
      AND is_business_member(auth.uid(), b.id)
    )
  );

DROP POLICY IF EXISTS "Users can create own collections" ON collections;
DROP POLICY IF EXISTS "Business members can create collections" ON collections;
CREATE POLICY "Business members can create collections"
  ON collections FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = collections.business_id
      AND is_business_member(auth.uid(), b.id)
    )
  );

DROP POLICY IF EXISTS "Users can update own collections" ON collections;
DROP POLICY IF EXISTS "Owners and managers can update collections" ON collections;
CREATE POLICY "Owners and managers can update collections"
  ON collections FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = collections.business_id
      AND is_business_owner_or_manager(auth.uid(), b.id)
    )
  );

DROP POLICY IF EXISTS "Users can delete own collections" ON collections;
DROP POLICY IF EXISTS "Only owners can delete collections" ON collections;
CREATE POLICY "Only owners can delete collections"
  ON collections FOR DELETE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = collections.business_id
      AND is_business_owner(auth.uid(), b.id)
    )
  );
-- ============================================================================
-- 15. CREATE TRIGGERS FOR AUTOMATIC BUSINESS MEMBERSHIP
-- ============================================================================

-- Automatically create business_member entry when a business is created
CREATE OR REPLACE FUNCTION create_business_owner_membership()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO business_members (business_id, user_id, role, joined_at)
  VALUES (NEW.id, NEW.owner_id, 'owner'::business_role_type, NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_business_created ON businesses;
CREATE TRIGGER on_business_created
  AFTER INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION create_business_owner_membership();

-- ============================================================================
-- 16. TODO: SET FIRST SYSTEM ADMIN
-- ============================================================================

-- Set brarjot@hotmail.ca as the first system admin
INSERT INTO system_roles (user_id, role, granted_by)
SELECT id, 'admin'::system_role_type, id
FROM auth.users
WHERE email = 'brarjot@hotmail.ca'
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
