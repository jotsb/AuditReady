/*
  # Update Categories to be Generic (Not Business-Specific)

  ## Overview
  This migration is now a NO-OP because the expense_categories table
  was created in the base schema with the final structure already applied.

  This file is kept for historical reference and to maintain migration order.

  ## Original Purpose
  Would have removed business_id and is_default columns, but the base schema
  was updated to create the table with the final structure from the start.
*/

-- Ensure columns are dropped if they exist (in case someone ran old migrations)
DO $$
BEGIN
  -- Drop business_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expense_categories'
    AND column_name = 'business_id'
  ) THEN
    ALTER TABLE expense_categories DROP COLUMN business_id;
  END IF;

  -- Drop is_default if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expense_categories'
    AND column_name = 'is_default'
  ) THEN
    ALTER TABLE expense_categories DROP COLUMN is_default;
  END IF;

  -- Add icon column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expense_categories'
    AND column_name = 'icon'
  ) THEN
    ALTER TABLE expense_categories ADD COLUMN icon text;
  END IF;

  -- Add color column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expense_categories'
    AND column_name = 'color'
  ) THEN
    ALTER TABLE expense_categories ADD COLUMN color text;
  END IF;
END $$;

-- Ensure proper RLS policies exist
DROP POLICY IF EXISTS "Users can view accessible categories" ON expense_categories;
DROP POLICY IF EXISTS "Business owners can create categories" ON expense_categories;
DROP POLICY IF EXISTS "Business owners can update their categories" ON expense_categories;
DROP POLICY IF EXISTS "Business owners can delete their categories" ON expense_categories;

-- Create global policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'expense_categories'
    AND policyname = 'Anyone can view categories'
  ) THEN
    CREATE POLICY "Anyone can view categories"
      ON expense_categories FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'expense_categories'
    AND policyname = 'Authenticated users can create categories'
  ) THEN
    CREATE POLICY "Authenticated users can create categories"
      ON expense_categories FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'expense_categories'
    AND policyname = 'Authenticated users can update categories'
  ) THEN
    CREATE POLICY "Authenticated users can update categories"
      ON expense_categories FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'expense_categories'
    AND policyname = 'Authenticated users can delete categories'
  ) THEN
    CREATE POLICY "Authenticated users can delete categories"
      ON expense_categories FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Seed default categories if table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM expense_categories LIMIT 1) THEN
    INSERT INTO expense_categories (name, description, sort_order) VALUES
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
  END IF;
END $$;
