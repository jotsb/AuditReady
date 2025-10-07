/*
  # Add color column to expense_categories table

  1. Changes
    - Add `color` column to `expense_categories` table with default color value
    - Add `sort_order` column (referenced in code but missing)
    - Update existing categories with sensible default colors
    
  2. Notes
    - Color values use hex format for consistency
    - Sort order helps maintain category display order
    - Uses IF NOT EXISTS pattern for safety
*/

-- Add color column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expense_categories' AND column_name = 'color'
  ) THEN
    ALTER TABLE expense_categories ADD COLUMN color text DEFAULT '#6B7280';
  END IF;
END $$;

-- Add sort_order column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expense_categories' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE expense_categories ADD COLUMN sort_order integer DEFAULT 0;
  END IF;
END $$;

-- Insert default expense categories with colors if table is empty
INSERT INTO expense_categories (name, description, color, sort_order)
SELECT * FROM (VALUES
  ('Office Supplies', 'Stationery, pens, paper, and office equipment', '#3B82F6', 1),
  ('Travel', 'Transportation, accommodation, and travel expenses', '#10B981', 2),
  ('Meals & Entertainment', 'Business meals, client entertainment', '#F59E0B', 3),
  ('Utilities', 'Electricity, water, internet, phone', '#8B5CF6', 4),
  ('Marketing', 'Advertising, promotions, and marketing materials', '#EC4899', 5),
  ('Professional Services', 'Legal, accounting, consulting fees', '#06B6D4', 6),
  ('Equipment', 'Computers, machinery, and tools', '#6366F1', 7),
  ('Insurance', 'Business insurance premiums', '#14B8A6', 8),
  ('Rent', 'Office or retail space rental', '#F97316', 9),
  ('Miscellaneous', 'Other business expenses', '#6B7280', 10)
) AS v(name, description, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM expense_categories LIMIT 1);
