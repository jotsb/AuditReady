/*
  # Add Expense Categories Management

  ## Overview
  This migration is now a NO-OP because the expense_categories table
  was created in the base schema (20251006010328_create_auditready_schema.sql)
  with the final structure.

  This file is kept for historical reference and to maintain migration order.

  ## Original Purpose
  Would have created expense_categories with business_id and is_default columns,
  but those were removed in the next migration, so the base schema was updated
  to skip this intermediate step.
*/

-- Check if table exists, if not create it with final structure
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'expense_categories'
  ) THEN
    -- Table doesn't exist, create it with final structure
    CREATE TABLE expense_categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL UNIQUE,
      description text,
      icon text,
      color text,
      sort_order integer DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Anyone can view categories"
      ON expense_categories FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
