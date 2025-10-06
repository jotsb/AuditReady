/*
  # Update Categories to be Generic (Not Business-Specific)

  ## Changes
  1. Drop business_id column from expense_categories
  2. Remove business-specific RLS policies
  3. Make categories global for all users
  4. Add unique constraint on category names
  5. Expand default categories to 25+ options
  
  ## New Structure
  Categories are now global and shared across all businesses
  Users can view all categories
  Only admins can create/update/delete categories (for now, all authenticated users)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view accessible categories" ON expense_categories;
DROP POLICY IF EXISTS "Business owners can create categories" ON expense_categories;
DROP POLICY IF EXISTS "Business owners can update their categories" ON expense_categories;
DROP POLICY IF EXISTS "Business owners can delete their categories" ON expense_categories;

-- Remove duplicates first
DELETE FROM expense_categories a USING expense_categories b
WHERE a.id > b.id AND a.name = b.name;

-- Remove business_id column
ALTER TABLE expense_categories DROP COLUMN IF EXISTS business_id;

-- Remove is_default column since all are now global
ALTER TABLE expense_categories DROP COLUMN IF EXISTS is_default;

-- Add unique constraint on name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expense_categories_name_key'
  ) THEN
    ALTER TABLE expense_categories ADD CONSTRAINT expense_categories_name_key UNIQUE (name);
  END IF;
END $$;

-- New RLS policies for global categories
CREATE POLICY "Anyone can view categories"
  ON expense_categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create categories"
  ON expense_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories"
  ON expense_categories
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete categories"
  ON expense_categories
  FOR DELETE
  TO authenticated
  USING (true);

-- Delete existing categories and insert comprehensive list
DELETE FROM expense_categories;

INSERT INTO expense_categories (name, description, display_order) VALUES
  ('Advertising & Marketing', 'Marketing campaigns, ads, promotions, and brand development', 1),
  ('Auto & Vehicle Expenses', 'Vehicle purchases, fuel, maintenance, parking, tolls', 2),
  ('Bank Fees & Charges', 'Banking fees, transaction charges, wire fees', 3),
  ('Business Insurance', 'General liability, property, professional liability insurance', 4),
  ('Client Entertainment', 'Business meals, entertainment, gifts for clients', 5),
  ('Computer & IT Equipment', 'Hardware, computers, servers, peripherals', 6),
  ('Consulting & Professional Fees', 'Legal, accounting, consulting, advisory services', 7),
  ('Depreciation', 'Asset depreciation expenses', 8),
  ('Dues & Subscriptions', 'Professional memberships, publications, subscriptions', 9),
  ('Education & Training', 'Courses, seminars, workshops, certifications', 10),
  ('Employee Benefits', 'Health insurance, retirement plans, perks', 11),
  ('Equipment Rental', 'Rental of tools, equipment, machinery', 12),
  ('Furniture & Fixtures', 'Office furniture, fixtures, decorations', 13),
  ('Insurance - Health', 'Employee health and dental insurance', 14),
  ('Insurance - Other', 'Other business insurance not categorized', 15),
  ('Interest Expense', 'Loan interest, credit card interest', 16),
  ('Licenses & Permits', 'Business licenses, permits, certifications', 17),
  ('Maintenance & Repairs', 'Building and equipment maintenance and repairs', 18),
  ('Meals - Business', 'Business-related meals and refreshments', 19),
  ('Office Supplies', 'Paper, pens, printing, and general office items', 20),
  ('Payroll Expenses', 'Salaries, wages, payroll taxes', 21),
  ('Postage & Shipping', 'Mail, courier, shipping costs', 22),
  ('Professional Development', 'Training, coaching, skill development', 23),
  ('Rent - Equipment', 'Equipment and machinery rental', 24),
  ('Rent - Office', 'Office and facility rent', 25),
  ('Software & Subscriptions', 'Software licenses, SaaS, cloud services', 26),
  ('Taxes & Licenses', 'Business taxes, fees, licenses', 27),
  ('Telecommunications', 'Phone, internet, mobile services', 28),
  ('Travel - Accommodation', 'Hotels, lodging for business travel', 29),
  ('Travel - Airfare', 'Flight tickets for business travel', 30),
  ('Travel - Ground Transport', 'Taxis, rideshare, car rentals for business', 31),
  ('Utilities', 'Electricity, water, gas, heating', 32),
  ('Website & Hosting', 'Domain, hosting, web development', 33),
  ('Miscellaneous', 'Other expenses not categorized elsewhere', 99)
ON CONFLICT (name) DO NOTHING;
