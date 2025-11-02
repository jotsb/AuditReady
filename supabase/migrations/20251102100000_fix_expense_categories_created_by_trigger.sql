/*
  # Fix expense_categories INSERT Failure

  ## Problem
  Users cannot create expense categories because the RLS policy requires
  `created_by = auth.uid()`, but the frontend doesn't set `created_by` on INSERT.

  Error: "new row violates row-level security policy for table expense_categories"

  ## Root Cause
  Migration `20251010021501` added `created_by` column and secure RLS policies,
  but didn't add a trigger to auto-populate `created_by` on INSERT.

  ## Solution
  Add a trigger that automatically sets `created_by = auth.uid()` if NULL.
  This allows the RLS policy to pass without requiring frontend changes.

  ## Changes
  1. Create trigger function `set_expense_category_created_by()`
  2. Attach trigger to `expense_categories` table on INSERT
  3. Auto-populate `created_by` if NULL on every INSERT

  ## Testing
  After this migration, users should be able to:
  - Create categories without specifying `created_by`
  - Update their own categories
  - Delete their own categories
  - View all categories
*/

-- =============================================================================
-- Create trigger function to auto-set created_by
-- =============================================================================

CREATE OR REPLACE FUNCTION set_expense_category_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If created_by is NULL, set it to the current user
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_expense_category_created_by() IS
  'Automatically sets created_by to auth.uid() on INSERT if NULL. Allows RLS policy to pass.';

-- =============================================================================
-- Attach trigger to expense_categories table
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_set_expense_category_created_by ON expense_categories;

CREATE TRIGGER trigger_set_expense_category_created_by
  BEFORE INSERT ON expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION set_expense_category_created_by();

COMMENT ON TRIGGER trigger_set_expense_category_created_by ON expense_categories IS
  'Auto-populates created_by with current user ID on INSERT';

-- =============================================================================
-- Verification
-- =============================================================================

-- Test that the trigger is attached
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_set_expense_category_created_by'
  ) THEN
    RAISE EXCEPTION 'Trigger was not created successfully';
  END IF;

  RAISE NOTICE 'Trigger created successfully. Users can now create categories.';
END $$;
