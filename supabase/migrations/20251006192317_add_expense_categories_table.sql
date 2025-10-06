/*
  # Add Expense Categories Management

  ## Overview
  Creates a system for managing custom expense categories per business.
  This allows businesses to define their own category taxonomy and ensures
  receipts are classified according to business-specific categories.

  ## New Tables
  - `expense_categories`
    - `id` (uuid, primary key) - Unique category identifier
    - `business_id` (uuid, foreign key, nullable) - Business that owns this category (null for defaults)
    - `name` (text, not null) - Category name (e.g., "Office Supplies")
    - `description` (text, nullable) - Optional category description
    - `is_default` (boolean) - Whether this is a system default category
    - `display_order` (integer) - Sort order for display
    - `created_at` (timestamptz) - When category was created
    - `updated_at` (timestamptz) - Last modification time

  ## Security
  - Enable RLS on `expense_categories` table
  - Users can view default categories and categories for businesses they're members of
  - Only business owners can create/update/delete their custom categories
  - System default categories cannot be modified or deleted

  ## Default Categories
  Seed the table with common default categories that all businesses can use
*/

-- Create expense_categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_expense_categories_business_id ON expense_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_is_default ON expense_categories(is_default);

-- Enable RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view default categories and categories for their businesses
CREATE POLICY "Users can view accessible categories"
  ON expense_categories
  FOR SELECT
  TO authenticated
  USING (
    is_default = true OR
    EXISTS (
      SELECT 1 FROM collection_members cm
      JOIN collections c ON c.id = cm.collection_id
      WHERE c.business_id = expense_categories.business_id
      AND cm.user_id = auth.uid()
    )
  );

-- Policy: Business owners can create categories
CREATE POLICY "Business owners can create categories"
  ON expense_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = expense_categories.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Business owners can update their categories
CREATE POLICY "Business owners can update their categories"
  ON expense_categories
  FOR UPDATE
  TO authenticated
  USING (
    is_default = false AND
    business_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = expense_categories.business_id
      AND businesses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    is_default = false AND
    business_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = expense_categories.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Business owners can delete non-default categories
CREATE POLICY "Business owners can delete their categories"
  ON expense_categories
  FOR DELETE
  TO authenticated
  USING (
    is_default = false AND
    business_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = expense_categories.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Insert default categories that all businesses can use
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM expense_categories WHERE is_default = true LIMIT 1) THEN
    INSERT INTO expense_categories (name, description, is_default, display_order)
    VALUES
      ('Office Supplies', 'Paper, pens, and general office items', true, 1),
      ('Travel', 'Transportation, accommodation, and travel expenses', true, 2),
      ('Meals & Entertainment', 'Business meals and client entertainment', true, 3),
      ('Utilities', 'Electricity, water, internet, and phone services', true, 4),
      ('Professional Services', 'Legal, accounting, consulting fees', true, 5),
      ('Equipment', 'Computers, machinery, and tools', true, 6),
      ('Marketing', 'Advertising, promotions, and marketing materials', true, 7),
      ('Miscellaneous', 'Other expenses not fitting specific categories', true, 99);
  END IF;
END $$;
