# Fix for "column 'amount' does not exist" Error

## 🔍 Problem Analysis

### Why Bolt Cloud Works But Self-Hosted Doesn't

Your **self-hosted Supabase** has an older, buggy migration file that references a non-existent column `amount` instead of `total_amount`. The Bolt cloud instance likely has a newer database that was rebuilt from scratch with corrected migrations.

### Root Cause

The migration file `20251016050000_add_dashboard_analytics_table.sql` contains **multiple SQL queries that reference `r.amount`** which doesn't exist in your database schema. The correct column name is `r.total_amount`.

**Locations of the bug:**
- Line 109: `SUM(amount)` should be `SUM(total_amount)`
- Line 111: `SUM(CASE WHEN transaction_date >= v_start_of_month THEN amount ELSE 0 END)` should use `total_amount`
- Line 112: `SUM(tax_amount)` should be `SUM(gst_amount + pst_amount)`
- Line 135: `SUM(r.amount)` should be `SUM(r.total_amount)`
- Lines 146-173: Same issues repeated in the user-specific stats section

### Database Schema Reference

Your `receipts` table has these columns (from `/supabase/migrations/20251006010328_create_auditready_schema.sql`):
```sql
CREATE TABLE receipts (
  id uuid PRIMARY KEY,
  collection_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  vendor_name text,
  vendor_address text,
  transaction_date timestamptz,
  subtotal numeric(10,2),
  gst_amount numeric(10,2) DEFAULT 0,    -- ✅ Exists
  pst_amount numeric(10,2) DEFAULT 0,    -- ✅ Exists
  total_amount numeric(10,2) NOT NULL,   -- ✅ Exists (not 'amount')
  payment_method text,
  category text,
  notes text,
  file_path text,
  file_type text,
  extraction_status text,
  extraction_data jsonb,
  is_edited boolean DEFAULT false,
  created_at timestamptz,
  updated_at timestamptz
);
```

**There is NO `amount` column.** It's `total_amount`.

## ✅ Solution

The migration file has been **FIXED** in your project:

### Changes Made:
1. ✅ Replaced `SUM(amount)` → `SUM(total_amount)` (4 instances)
2. ✅ Replaced `SUM(tax_amount)` → `SUM(gst_amount + pst_amount)` (2 instances)
3. ✅ Fixed expense_categories JOIN to use `ec.name = cat.category` instead of `ec.id = cat.category`

## 🚀 How to Apply the Fix

### Option 1: Re-apply the Corrected Migration (Recommended)

On your Unraid server, SSH in and run:

```bash
cd /path/to/your/supabase/docker-compose/directory

# Drop the buggy function
docker exec supabase-db psql -U postgres -d postgres -c "
DROP FUNCTION IF EXISTS calculate_dashboard_analytics(uuid, uuid);
DROP FUNCTION IF EXISTS refresh_dashboard_analytics_trigger();
DROP TRIGGER IF EXISTS trigger_refresh_analytics_on_receipt_change ON receipts;
"

# Re-apply the corrected migration
docker exec -i supabase-db psql -U postgres -d postgres < /path/to/project/supabase/migrations/20251016050000_add_dashboard_analytics_table.sql
```

### Option 2: Manually Patch the Database (Quick Fix)

```bash
docker exec supabase-db psql -U postgres -d postgres <<'EOF'
-- Drop and recreate the buggy function with correct column names
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

  IF p_user_id IS NULL THEN
    -- Business-wide stats
    SELECT
      COALESCE(SUM(total_amount), 0),
      COUNT(*),
      COALESCE(SUM(CASE WHEN transaction_date >= v_start_of_month THEN total_amount ELSE 0 END), 0),
      COALESCE(SUM(gst_amount + pst_amount), 0)
    INTO
      v_total_expenses,
      v_receipt_count,
      v_monthly_total,
      v_tax_total
    FROM receipts r
    INNER JOIN collections c ON r.collection_id = c.id
    WHERE c.business_id = p_business_id
      AND r.deleted_at IS NULL;

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
        SUM(r.total_amount) as category_sum
      FROM receipts r
      INNER JOIN collections c ON r.collection_id = c.id
      WHERE c.business_id = p_business_id
        AND r.deleted_at IS NULL
      GROUP BY r.category
    ) cat
    LEFT JOIN expense_categories ec ON ec.name = cat.category;
  ELSE
    -- User-specific stats
    SELECT
      COALESCE(SUM(total_amount), 0),
      COUNT(*),
      COALESCE(SUM(CASE WHEN transaction_date >= v_start_of_month THEN total_amount ELSE 0 END), 0),
      COALESCE(SUM(gst_amount + pst_amount), 0)
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
        SUM(r.total_amount) as category_sum
      FROM receipts r
      INNER JOIN collections c ON r.collection_id = c.id
      WHERE c.business_id = p_business_id
        AND c.created_by = p_user_id
        AND r.deleted_at IS NULL
      GROUP BY r.category
    ) cat
    LEFT JOIN expense_categories ec ON ec.name = cat.category;
  END IF;

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
EOF
```

### Option 3: Nuclear Option - Rebuild Database

If you want a completely fresh start:

```bash
# Backup first!
docker exec supabase-db pg_dump -U postgres postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# Stop and remove database
docker-compose stop db
docker-compose rm -f db
docker volume rm supabase_db_data

# Recreate from scratch with corrected migrations
docker-compose up -d db
sleep 10

# Apply all migrations in order
for migration in supabase/migrations/*.sql; do
  echo "Applying $migration"
  docker exec -i supabase-db psql -U postgres -d postgres < "$migration"
done
```

## 🧪 Verify the Fix

After applying the fix, test by uploading a receipt:

```bash
# Check if the function exists and is correct
docker exec supabase-db psql -U postgres -d postgres -c "
\df calculate_dashboard_analytics
"

# Try to manually run the function
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT calculate_dashboard_analytics(
  (SELECT id FROM businesses LIMIT 1),
  NULL
);
"
```

If no errors appear, try uploading a receipt from the web interface.

## 📝 Summary

- **Problem**: Migration file had wrong column names (`amount` instead of `total_amount`)
- **Cause**: Database schema discrepancy between Bolt cloud (clean) and self-hosted (incremental migrations)
- **Fix**: Corrected migration file + database function patch
- **Prevention**: Always validate migration files against actual schema before applying

## 🔗 Related Files
- Fixed migration: `/supabase/migrations/20251016050000_add_dashboard_analytics_table.sql`
- Schema reference: `/supabase/migrations/20251006010328_create_auditready_schema.sql`
