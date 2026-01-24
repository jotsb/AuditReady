/*
  # Fix Dashboard Analytics Column References

  ## Problem
  The original migration `20251016050000_add_dashboard_analytics_table.sql` contained
  a critical bug where it referenced a non-existent column `amount` instead of the
  correct column name `total_amount`. This caused errors when trying to create receipts
  because the trigger function would fail.

  ## Root Cause
  - Migration referenced `r.amount` which doesn't exist in the receipts table
  - Should have used `r.total_amount` (the actual column name)
  - Also referenced `tax_amount` which doesn't exist (should use `gst_amount + pst_amount`)

  ## Changes Made

  ### 1. Drop Existing Buggy Functions and Triggers
  - Drop trigger `trigger_refresh_analytics_on_receipt_change`
  - Drop function `refresh_dashboard_analytics_trigger()`
  - Drop function `calculate_dashboard_analytics()`
  - Drop function `initialize_dashboard_analytics()`

  ### 2. Recreate Functions with Correct Column Names
  - `calculate_dashboard_analytics()` - Now uses `total_amount` instead of `amount`
  - `refresh_dashboard_analytics_trigger()` - Recreated (no changes needed)
  - `initialize_dashboard_analytics()` - Recreated (no changes needed)

  ### 3. Recreate Trigger
  - Reattach trigger to receipts table

  ## Backward Compatibility
  - All existing data in `dashboard_analytics` table is preserved
  - Table structure remains unchanged
  - Only function implementations are updated

  ## Testing
  After applying this migration:
  1. Try uploading a receipt - should work without errors
  2. Check dashboard analytics are calculated correctly
  3. Verify trigger fires on receipt insert/update/delete

  ## Migration Safety
  - Idempotent: Safe to run multiple times
  - Data-preserving: No data loss
  - Zero downtime: Functions recreated atomically
*/

-- =============================================================================
-- STEP 1: Drop existing buggy trigger and functions
-- =============================================================================

-- Drop trigger first (depends on function)
DROP TRIGGER IF EXISTS trigger_refresh_analytics_on_receipt_change ON receipts;

-- Drop trigger function
DROP FUNCTION IF EXISTS refresh_dashboard_analytics_trigger();

-- Drop main calculation function
DROP FUNCTION IF EXISTS calculate_dashboard_analytics(uuid, uuid);

-- Drop initialization function
DROP FUNCTION IF EXISTS initialize_dashboard_analytics();

-- =============================================================================
-- STEP 2: Recreate calculate_dashboard_analytics() with CORRECT column names
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_dashboard_analytics(
  p_business_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_expenses numeric;
  v_receipt_count integer;
  v_monthly_total numeric;
  v_tax_total numeric;
  v_category_breakdown jsonb;
  v_start_of_month date;
BEGIN
  v_start_of_month := date_trunc('month', CURRENT_DATE);

  -- Calculate stats based on user or business
  IF p_user_id IS NULL THEN
    -- Business-wide stats
    SELECT
      COALESCE(SUM(r.total_amount), 0),  -- ✅ FIXED: was 'amount', now 'total_amount'
      COUNT(*),
      COALESCE(SUM(CASE WHEN r.transaction_date >= v_start_of_month THEN r.total_amount ELSE 0 END), 0),  -- ✅ FIXED
      COALESCE(SUM(COALESCE(r.gst_amount, 0) + COALESCE(r.pst_amount, 0)), 0)  -- ✅ FIXED: was 'tax_amount'
    INTO
      v_total_expenses,
      v_receipt_count,
      v_monthly_total,
      v_tax_total
    FROM receipts r
    INNER JOIN collections c ON r.collection_id = c.id
    WHERE c.business_id = p_business_id
      AND r.deleted_at IS NULL;

    -- Category breakdown (business-wide)
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'category', COALESCE(cat.category, 'Uncategorized'),
        'amount', cat.category_sum,
        'color', COALESCE(ec.color, '#6B7280')
      )
    ), '[]'::jsonb)
    INTO v_category_breakdown
    FROM (
      SELECT
        r.category,
        SUM(r.total_amount) as category_sum  -- ✅ FIXED: was 'r.amount'
      FROM receipts r
      INNER JOIN collections c ON r.collection_id = c.id
      WHERE c.business_id = p_business_id
        AND r.deleted_at IS NULL
      GROUP BY r.category
    ) cat
    LEFT JOIN expense_categories ec ON ec.name = cat.category;  -- ✅ FIXED: was 'ec.id = cat.category'

  ELSE
    -- User-specific stats
    SELECT
      COALESCE(SUM(r.total_amount), 0),  -- ✅ FIXED: was 'amount'
      COUNT(*),
      COALESCE(SUM(CASE WHEN r.transaction_date >= v_start_of_month THEN r.total_amount ELSE 0 END), 0),  -- ✅ FIXED
      COALESCE(SUM(COALESCE(r.gst_amount, 0) + COALESCE(r.pst_amount, 0)), 0)  -- ✅ FIXED: was 'tax_amount'
    INTO
      v_total_expenses,
      v_receipt_count,
      v_monthly_total,
      v_tax_total
    FROM receipts r
    INNER JOIN collections c ON r.collection_id = c.id
    WHERE c.business_id = p_business_id
      AND c.created_by = p_user_id
      AND r.deleted_at IS NULL;

    -- Category breakdown (user-specific)
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'category', COALESCE(cat.category, 'Uncategorized'),
        'amount', cat.category_sum,
        'color', COALESCE(ec.color, '#6B7280')
      )
    ), '[]'::jsonb)
    INTO v_category_breakdown
    FROM (
      SELECT
        r.category,
        SUM(r.total_amount) as category_sum  -- ✅ FIXED: was 'r.amount'
      FROM receipts r
      INNER JOIN collections c ON r.collection_id = c.id
      WHERE c.business_id = p_business_id
        AND c.created_by = p_user_id
        AND r.deleted_at IS NULL
      GROUP BY r.category
    ) cat
    LEFT JOIN expense_categories ec ON ec.name = cat.category;  -- ✅ FIXED: was 'ec.id = cat.category'
  END IF;

  -- Upsert analytics record
  INSERT INTO dashboard_analytics (
    business_id,
    user_id,
    total_expenses,
    receipt_count,
    monthly_total,
    tax_total,
    category_breakdown,
    last_calculated_at,
    updated_at
  ) VALUES (
    p_business_id,
    p_user_id,
    v_total_expenses,
    v_receipt_count,
    v_monthly_total,
    v_tax_total,
    v_category_breakdown,
    now(),
    now()
  )
  ON CONFLICT (business_id, user_id)
  DO UPDATE SET
    total_expenses = EXCLUDED.total_expenses,
    receipt_count = EXCLUDED.receipt_count,
    monthly_total = EXCLUDED.monthly_total,
    tax_total = EXCLUDED.tax_total,
    category_breakdown = EXCLUDED.category_breakdown,
    last_calculated_at = now(),
    updated_at = now();
END;
$$;

-- Add function comment
COMMENT ON FUNCTION calculate_dashboard_analytics(uuid, uuid) IS
  'Calculates dashboard analytics for a business (user_id=NULL) or specific user. Fixed to use correct column names (total_amount instead of amount).';

-- =============================================================================
-- STEP 3: Recreate trigger function (no changes, but must recreate after drop)
-- =============================================================================

CREATE OR REPLACE FUNCTION refresh_dashboard_analytics_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_user_id uuid;
BEGIN
  -- Get business_id and created_by from the collection
  IF TG_OP = 'DELETE' THEN
    SELECT c.business_id, c.created_by
    INTO v_business_id, v_user_id
    FROM collections c
    WHERE c.id = OLD.collection_id;
  ELSE
    SELECT c.business_id, c.created_by
    INTO v_business_id, v_user_id
    FROM collections c
    WHERE c.id = NEW.collection_id;
  END IF;

  -- Recalculate user-specific analytics
  IF v_user_id IS NOT NULL THEN
    PERFORM calculate_dashboard_analytics(v_business_id, v_user_id);
  END IF;

  -- Recalculate business-wide analytics
  PERFORM calculate_dashboard_analytics(v_business_id, NULL);

  RETURN NULL;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION refresh_dashboard_analytics_trigger() IS
  'Trigger function to refresh dashboard analytics when receipts change.';

-- =============================================================================
-- STEP 4: Recreate initialization function (no changes, but must recreate)
-- =============================================================================

CREATE OR REPLACE FUNCTION initialize_dashboard_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business record;
  v_user record;
BEGIN
  -- Calculate business-wide analytics for all businesses
  FOR v_business IN SELECT id FROM businesses LOOP
    PERFORM calculate_dashboard_analytics(v_business.id, NULL);
  END LOOP;

  -- Calculate user-specific analytics for all users with collections
  FOR v_user IN
    SELECT DISTINCT c.business_id, c.created_by as user_id
    FROM collections c
    WHERE c.created_by IS NOT NULL
  LOOP
    PERFORM calculate_dashboard_analytics(v_user.business_id, v_user.user_id);
  END LOOP;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION initialize_dashboard_analytics() IS
  'Initializes analytics for all businesses and users. Safe to run multiple times.';

-- =============================================================================
-- STEP 5: Reattach trigger to receipts table
-- =============================================================================

CREATE TRIGGER trigger_refresh_analytics_on_receipt_change
  AFTER INSERT OR UPDATE OR DELETE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION refresh_dashboard_analytics_trigger();

-- Add trigger comment
COMMENT ON TRIGGER trigger_refresh_analytics_on_receipt_change ON receipts IS
  'Automatically refreshes dashboard analytics when receipts are modified.';

-- =============================================================================
-- STEP 6: Verify and recalculate analytics (safe to run)
-- =============================================================================

-- Recalculate all analytics with correct column references
-- This will fix any incorrect data that was calculated with the buggy function
DO $$
BEGIN
  -- Only initialize if there are businesses and collections
  IF EXISTS (SELECT 1 FROM businesses LIMIT 1) AND
     EXISTS (SELECT 1 FROM collections LIMIT 1) THEN
    PERFORM initialize_dashboard_analytics();
    RAISE NOTICE 'Dashboard analytics recalculated successfully with correct column names.';
  ELSE
    RAISE NOTICE 'No businesses or collections found. Skipping analytics initialization.';
  END IF;
END $$;

-- =============================================================================
-- VERIFICATION QUERIES (for manual testing)
-- =============================================================================

-- Uncomment to verify the fix works:
-- SELECT calculate_dashboard_analytics(
--   (SELECT id FROM businesses LIMIT 1),
--   NULL
-- );

-- Check if analytics were calculated:
-- SELECT * FROM dashboard_analytics LIMIT 5;
