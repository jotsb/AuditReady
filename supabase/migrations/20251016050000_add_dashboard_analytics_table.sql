/*
  # Dashboard Analytics Table

  1. New Table
    - `dashboard_analytics`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses)
      - `user_id` (uuid, references profiles) - NULL for business-wide stats
      - `total_expenses` (numeric) - Sum of all receipt amounts
      - `receipt_count` (integer) - Total number of receipts
      - `monthly_total` (numeric) - Current month total
      - `tax_total` (numeric) - Total tax amount
      - `category_breakdown` (jsonb) - Category spending breakdown
      - `last_calculated_at` (timestamptz) - When stats were last updated
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Triggers
    - Auto-update analytics when receipts are inserted/updated/deleted
    - Recalculate on collection changes

  3. Functions
    - `calculate_dashboard_analytics(p_business_id, p_user_id)` - Calculate stats
    - `refresh_dashboard_analytics()` - Trigger function

  4. Security
    - Enable RLS
    - Users can read their own analytics
    - System can write analytics

  5. Indexes
    - (business_id, user_id) for fast lookups
    - (last_calculated_at) for cache invalidation
*/

-- Create dashboard_analytics table
CREATE TABLE IF NOT EXISTS dashboard_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  total_expenses numeric DEFAULT 0 NOT NULL,
  receipt_count integer DEFAULT 0 NOT NULL,
  monthly_total numeric DEFAULT 0 NOT NULL,
  tax_total numeric DEFAULT 0 NOT NULL,
  category_breakdown jsonb DEFAULT '[]'::jsonb NOT NULL,
  last_calculated_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(business_id, user_id)
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_dashboard_analytics_business_user
  ON dashboard_analytics(business_id, user_id);

-- Add index for cache invalidation
CREATE INDEX IF NOT EXISTS idx_dashboard_analytics_last_calculated
  ON dashboard_analytics(last_calculated_at DESC);

-- Enable RLS
ALTER TABLE dashboard_analytics ENABLE ROW LEVEL SECURITY;

-- Users can read their own analytics
CREATE POLICY "Users can read own analytics"
  ON dashboard_analytics FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      user_id IS NULL
      AND business_id IN (
        SELECT business_id
        FROM business_users
        WHERE user_id = auth.uid()
      )
    )
  );

-- System can insert/update analytics (for triggers)
CREATE POLICY "System can manage analytics"
  ON dashboard_analytics FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to calculate dashboard analytics for a user
CREATE OR REPLACE FUNCTION calculate_dashboard_analytics(
  p_business_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
      COALESCE(SUM(amount), 0),
      COUNT(*),
      COALESCE(SUM(CASE WHEN transaction_date >= v_start_of_month THEN amount ELSE 0 END), 0),
      COALESCE(SUM(tax_amount), 0)
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
        'category', COALESCE(ec.name, 'Uncategorized'),
        'amount', category_sum,
        'color', COALESCE(ec.color, '#6B7280')
      )
    ), '[]'::jsonb)
    INTO v_category_breakdown
    FROM (
      SELECT
        r.category,
        SUM(r.amount) as category_sum
      FROM receipts r
      INNER JOIN collections c ON r.collection_id = c.id
      WHERE c.business_id = p_business_id
        AND r.deleted_at IS NULL
      GROUP BY r.category
    ) cat
    LEFT JOIN expense_categories ec ON ec.id = cat.category AND ec.business_id = p_business_id;
  ELSE
    -- User-specific stats
    SELECT
      COALESCE(SUM(amount), 0),
      COUNT(*),
      COALESCE(SUM(CASE WHEN transaction_date >= v_start_of_month THEN amount ELSE 0 END), 0),
      COALESCE(SUM(tax_amount), 0)
    INTO
      v_total_expenses,
      v_receipt_count,
      v_monthly_total,
      v_tax_total
    FROM receipts r
    INNER JOIN collections c ON r.collection_id = c.id
    WHERE c.business_id = p_business_id
      AND c.user_id = p_user_id
      AND r.deleted_at IS NULL;

    -- Category breakdown (user-specific)
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'category', COALESCE(ec.name, 'Uncategorized'),
        'amount', category_sum,
        'color', COALESCE(ec.color, '#6B7280')
      )
    ), '[]'::jsonb)
    INTO v_category_breakdown
    FROM (
      SELECT
        r.category,
        SUM(r.amount) as category_sum
      FROM receipts r
      INNER JOIN collections c ON r.collection_id = c.id
      WHERE c.business_id = p_business_id
        AND c.user_id = p_user_id
        AND r.deleted_at IS NULL
      GROUP BY r.category
    ) cat
    LEFT JOIN expense_categories ec ON ec.id = cat.category AND ec.business_id = p_business_id;
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

-- Trigger function to refresh analytics when receipts change
CREATE OR REPLACE FUNCTION refresh_dashboard_analytics_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id uuid;
  v_user_id uuid;
BEGIN
  -- Get business_id and user_id from the collection
  IF TG_OP = 'DELETE' THEN
    SELECT c.business_id, c.user_id
    INTO v_business_id, v_user_id
    FROM collections c
    WHERE c.id = OLD.collection_id;
  ELSE
    SELECT c.business_id, c.user_id
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

-- Add trigger to receipts table
DROP TRIGGER IF EXISTS trigger_refresh_analytics_on_receipt_change ON receipts;
CREATE TRIGGER trigger_refresh_analytics_on_receipt_change
  AFTER INSERT OR UPDATE OR DELETE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION refresh_dashboard_analytics_trigger();

-- Function to initialize analytics for existing data
CREATE OR REPLACE FUNCTION initialize_dashboard_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
    SELECT DISTINCT c.business_id, c.user_id
    FROM collections c
    WHERE c.user_id IS NOT NULL
  LOOP
    PERFORM calculate_dashboard_analytics(v_user.business_id, v_user.user_id);
  END LOOP;
END;
$$;

-- Initialize analytics for existing data
SELECT initialize_dashboard_analytics();
