/*
  # Add Auto-Populate Trigger for Business created_by Column

  ## Problem
  Error: "new row violates row-level security policy for table businesses"
  
  ## Root Cause
  The `businesses` table has a `created_by` column with a foreign key constraint,
  but no trigger to auto-populate it on INSERT. This causes RLS policies to fail
  because they may check the `created_by` value.
  
  This is the SAME issue that was fixed for `expense_categories` table in migration
  `20251102100000_fix_expense_categories_created_by_trigger.sql`.

  ## Solution
  Add a BEFORE INSERT trigger that automatically sets `created_by = auth.uid()` 
  when NULL, allowing the INSERT to succeed and RLS policies to pass.

  ## Changes
  1. Create trigger function `set_business_created_by()`
  2. Attach BEFORE INSERT trigger to `businesses` table
  3. Auto-populate `created_by` if NULL on every INSERT
  
  ## Security
  - Trigger runs as SECURITY DEFINER to bypass RLS
  - Only sets created_by if NULL (doesn't override explicit values)
  - Uses auth.uid() which is the authenticated user's ID
  
  ## Testing
  After this migration, users should be able to:
  - Create businesses through onboarding wizard
  - INSERT businesses without explicitly setting created_by
  - RLS policies will pass because created_by is populated
*/

-- =============================================================================
-- Create trigger function to auto-set created_by for businesses
-- =============================================================================

CREATE OR REPLACE FUNCTION set_business_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If created_by is NULL, set it to the current authenticated user
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_business_created_by() IS
  'Automatically sets created_by to auth.uid() on INSERT if NULL. Allows RLS policies to pass.';

-- =============================================================================
-- Attach trigger to businesses table
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_set_business_created_by ON businesses;

CREATE TRIGGER trigger_set_business_created_by
  BEFORE INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION set_business_created_by();

COMMENT ON TRIGGER trigger_set_business_created_by ON businesses IS
  'Auto-populates created_by with current user ID on INSERT';

-- =============================================================================
-- Verification
-- =============================================================================

-- Verify the trigger was created successfully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_set_business_created_by'
      AND tgrelid = 'businesses'::regclass
  ) THEN
    RAISE EXCEPTION 'Trigger was not created successfully';
  END IF;

  RAISE NOTICE 'Business created_by trigger created successfully.';
  RAISE NOTICE 'Users can now create businesses without explicitly setting created_by.';
END $$;
