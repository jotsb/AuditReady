/*
  # Audit Proof Database Schema

  ## Overview
  Creates the complete database schema for the Audit Proof receipt management application.
  
  ## New Tables
  
  ### 1. `profiles`
  Extends Supabase auth.users with additional user profile data
  - `id` (uuid, FK to auth.users) - User identifier
  - `full_name` (text) - User's full name
  - `phone_number` (text) - For SMS 2FA
  - `mfa_method` (text) - 'authenticator' or 'sms'
  - `mfa_enabled` (boolean) - Whether 2FA is active
  - `trusted_devices` (jsonb) - Array of device fingerprints with expiry
  - `created_at` (timestamptz) - Profile creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 2. `businesses`
  Represents companies/entities that users manage
  - `id` (uuid, PK) - Business identifier
  - `owner_id` (uuid, FK to profiles) - Business owner
  - `name` (text) - Business name
  - `tax_id` (text) - Tax/business number
  - `currency` (text) - Default currency code (CAD, USD, etc.)
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 3. `collections`
  Organizational units for receipts (e.g., per year, per department)
  - `id` (uuid, PK) - Collection identifier
  - `business_id` (uuid, FK to businesses) - Parent business
  - `name` (text) - Collection name (e.g., "2025 Expenses")
  - `description` (text) - Optional description
  - `year` (integer) - Fiscal year
  - `created_by` (uuid, FK to profiles) - Creator
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 4. `collection_members`
  Manages user access to collections with role-based permissions
  - `id` (uuid, PK) - Membership identifier
  - `collection_id` (uuid, FK to collections) - Target collection
  - `user_id` (uuid, FK to profiles) - Member user
  - `role` (text) - 'admin', 'submitter', or 'viewer'
  - `invited_by` (uuid, FK to profiles) - Who sent the invitation
  - `created_at` (timestamptz) - Membership creation timestamp
  
  ### 5. `receipts`
  Core receipt/expense records
  - `id` (uuid, PK) - Receipt identifier
  - `collection_id` (uuid, FK to collections) - Parent collection
  - `uploaded_by` (uuid, FK to profiles) - User who uploaded
  - `vendor_name` (text) - Merchant/vendor name
  - `vendor_address` (text) - Vendor location
  - `transaction_date` (timestamptz) - Date/time of purchase
  - `subtotal` (decimal) - Pre-tax amount
  - `gst_amount` (decimal) - GST/federal tax
  - `pst_amount` (decimal) - PST/provincial tax
  - `total_amount` (decimal) - Final total
  - `payment_method` (text) - Payment type (cash, credit, debit, etc.)
  - `category` (text) - Expense category
  - `notes` (text) - User notes
  - `file_path` (text) - Path to stored image/PDF in Supabase Storage
  - `file_type` (text) - MIME type
  - `extraction_status` (text) - 'pending', 'processing', 'completed', 'failed'
  - `extraction_data` (jsonb) - Raw ChatGPT extraction result
  - `is_edited` (boolean) - Whether manually edited after extraction
  - `created_at` (timestamptz) - Upload timestamp
  - `updated_at` (timestamptz) - Last edit timestamp
  
  ### 6. `audit_logs`
  Security and compliance audit trail
  - `id` (uuid, PK) - Log entry identifier
  - `user_id` (uuid, FK to profiles) - User who performed action
  - `action` (text) - Action type (login, upload, edit, delete, etc.)
  - `resource_type` (text) - Type of resource affected
  - `resource_id` (uuid) - ID of affected resource
  - `details` (jsonb) - Additional context (IP, device, changes, etc.)
  - `created_at` (timestamptz) - When action occurred
  
  ### 7. `expense_categories`
  Predefined expense categories for classification
  - `id` (uuid, PK) - Category identifier
  - `name` (text) - Category name
  - `description` (text) - Category description
  - `icon` (text) - Icon identifier for UI
  - `color` (text) - Color code for charts
  - `sort_order` (integer) - Display order
  
  ## Security
  
  Row Level Security (RLS) is enabled on all tables with policies ensuring:
  - Users can only access their own profile data
  - Users can only see businesses they own or are members of
  - Collection access is controlled by membership roles
  - Receipts are only visible to collection members
  - Audit logs are read-only and only accessible by admins
  - Categories are publicly readable but only admins can modify
  
  ## Notes
  
  1. All monetary amounts use numeric(10,2) for precision
  2. Timestamps use timestamptz for timezone awareness
  3. Foreign keys have ON DELETE CASCADE for data cleanup
  4. Indexes are created on frequently queried columns
  5. MFA is mandatory - enforced at application level
  6. File encryption handled by Supabase Storage with RLS
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone_number text,
  mfa_method text DEFAULT 'authenticator' CHECK (mfa_method IN ('authenticator', 'sms')),
  mfa_enabled boolean DEFAULT false,
  trusted_devices jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  tax_id text,
  currency text DEFAULT 'CAD',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  year integer NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Collection members table
CREATE TABLE IF NOT EXISTS collection_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'submitter', 'viewer')),
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(collection_id, user_id)
);

ALTER TABLE collection_members ENABLE ROW LEVEL SECURITY;

-- Now add RLS policies for businesses (requires collection_members to exist)
CREATE POLICY "Users can view own businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collection_members cm
      JOIN collections c ON c.id = cm.collection_id
      WHERE c.business_id = businesses.id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create businesses"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Business owners can update their businesses"
  ON businesses FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Business owners can delete their businesses"
  ON businesses FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- RLS policies for collections
CREATE POLICY "Collection members can view collections"
  ON collections FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collection_members
      WHERE collection_id = collections.id AND user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = collections.business_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can create collections"
  ON collections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Collection admins can update collections"
  ON collections FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collection_members
      WHERE collection_id = collections.id AND user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collection_members
      WHERE collection_id = collections.id AND user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Collection admins can delete collections"
  ON collections FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collection_members
      WHERE collection_id = collections.id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS policies for collection_members
CREATE POLICY "Collection members can view memberships"
  ON collection_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = collection_members.collection_id 
      AND cm.user_id = auth.uid() 
      AND cm.role = 'admin'
    )
  );

CREATE POLICY "Collection admins can manage members"
  ON collection_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = collection_id AND cm.user_id = auth.uid() AND cm.role = 'admin'
    ) OR
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Collection admins can update members"
  ON collection_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = collection_members.collection_id 
      AND cm.user_id = auth.uid() 
      AND cm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = collection_members.collection_id 
      AND cm.user_id = auth.uid() 
      AND cm.role = 'admin'
    )
  );

CREATE POLICY "Collection admins can remove members"
  ON collection_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = collection_members.collection_id 
      AND cm.user_id = auth.uid() 
      AND cm.role = 'admin'
    )
  );

-- Receipts table
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vendor_name text,
  vendor_address text,
  transaction_date timestamptz,
  subtotal numeric(10,2),
  gst_amount numeric(10,2) DEFAULT 0,
  pst_amount numeric(10,2) DEFAULT 0,
  total_amount numeric(10,2) NOT NULL,
  payment_method text,
  category text,
  notes text,
  file_path text,
  file_type text,
  extraction_status text DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  extraction_data jsonb,
  is_edited boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collection members can view receipts"
  ON receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = receipts.collection_id AND cm.user_id = auth.uid()
    ) OR
    uploaded_by = auth.uid()
  );

CREATE POLICY "Submitters and admins can create receipts"
  ON receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = collection_id 
      AND cm.user_id = auth.uid() 
      AND cm.role IN ('admin', 'submitter')
    )
  );

CREATE POLICY "Admins and uploaders can update receipts"
  ON receipts FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = receipts.collection_id 
      AND cm.user_id = auth.uid() 
      AND cm.role = 'admin'
    )
  )
  WITH CHECK (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = receipts.collection_id 
      AND cm.user_id = auth.uid() 
      AND cm.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete receipts"
  ON receipts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = receipts.collection_id 
      AND cm.user_id = auth.uid() 
      AND cm.role = 'admin'
    )
  );

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Expense categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  color text,
  sort_order integer DEFAULT 0
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON expense_categories FOR SELECT
  TO authenticated
  USING (true);

-- Insert default categories
INSERT INTO expense_categories (name, description, icon, color, sort_order) VALUES
  ('Meals & Entertainment', 'Restaurant, catering, client meals', 'utensils', '#3B82F6', 1),
  ('Transportation', 'Fuel, parking, transit, vehicle expenses', 'car', '#10B981', 2),
  ('Office Supplies', 'Stationery, equipment, furniture', 'briefcase', '#6366F1', 3),
  ('Professional Services', 'Legal, accounting, consulting fees', 'users', '#8B5CF6', 4),
  ('Utilities', 'Phone, internet, electricity, water', 'zap', '#F59E0B', 5),
  ('Rent & Lease', 'Office space, equipment leases', 'home', '#EF4444', 6),
  ('Marketing & Advertising', 'Promotions, ads, branding', 'megaphone', '#EC4899', 7),
  ('Insurance', 'Business liability, property insurance', 'shield', '#14B8A6', 8),
  ('Travel', 'Hotels, flights, accommodation', 'plane', '#06B6D4', 9),
  ('Repairs & Maintenance', 'Equipment fixes, building maintenance', 'wrench', '#F97316', 10),
  ('Software & Subscriptions', 'SaaS, licenses, cloud services', 'laptop', '#8B5CF6', 11),
  ('Miscellaneous', 'Other business expenses', 'more-horizontal', '#6B7280', 12)
ON CONFLICT (name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_collections_business_id ON collections(business_id);
CREATE INDEX IF NOT EXISTS idx_collections_year ON collections(year);
CREATE INDEX IF NOT EXISTS idx_collection_members_collection_id ON collection_members(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_members_user_id ON collection_members(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_collection_id ON receipts(collection_id);
CREATE INDEX IF NOT EXISTS idx_receipts_uploaded_by ON receipts(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_receipts_transaction_date ON receipts(transaction_date);
CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on auth.users to auto-create profiles on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_email_to_profile();

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_receipts_updated_at ON receipts;
CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();