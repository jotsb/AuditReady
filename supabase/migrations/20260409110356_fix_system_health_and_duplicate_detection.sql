/*
  # Fix System Health Snapshot and Create Duplicate Detection Tables

  ## Problem 1: System Health "column size does not exist"
  - The `get_system_health_snapshot` function references `storage.objects.size` which does not exist
  - The correct approach is to use `(metadata->>'size')::bigint` or `businesses.storage_used_bytes`
  - The function is replaced with one that uses correct column references

  ## Problem 2: Duplicate Detection "table potential_duplicates not found"
  - The `potential_duplicates` table was never created (original migration likely failed)
  - Related tables `system_health_metrics`, `database_queries_log`, `admin_impersonation_sessions` also missing
  - All tables, functions, indexes, RLS policies, and triggers are created here

  ## New Tables
  1. `potential_duplicates` - tracks potential duplicate receipts
  2. `admin_impersonation_sessions` - tracks admin impersonation for support
  3. `system_health_metrics` - stores periodic health snapshots
  4. `database_queries_log` - audit trail for admin database queries

  ## Modified Functions
  1. `get_system_health_snapshot()` - fixed storage query to use `businesses.storage_used_bytes`
  2. `detect_duplicate_receipts()` - recreated with the table
  3. `execute_admin_query()` - recreated with the table

  ## Security
  - RLS enabled on all new tables
  - Policies restrict access to business members and system admins
  - All admin actions are logged
*/

-- =====================================================
-- 1. POTENTIAL DUPLICATES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS potential_duplicates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  duplicate_of_receipt_id uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  confidence_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  match_reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed', 'merged')),
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(receipt_id, duplicate_of_receipt_id),
  CHECK (receipt_id != duplicate_of_receipt_id)
);

CREATE INDEX IF NOT EXISTS idx_potential_duplicates_receipt_id ON potential_duplicates(receipt_id);
CREATE INDEX IF NOT EXISTS idx_potential_duplicates_status ON potential_duplicates(status);
CREATE INDEX IF NOT EXISTS idx_potential_duplicates_confidence ON potential_duplicates(confidence_score DESC);

ALTER TABLE potential_duplicates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view duplicates for their business receipts" ON potential_duplicates;
DROP POLICY IF EXISTS "Users can update duplicate status for their receipts" ON potential_duplicates;
DROP POLICY IF EXISTS "System admins can view all duplicates" ON potential_duplicates;
DROP POLICY IF EXISTS "System admins can insert duplicates" ON potential_duplicates;
DROP POLICY IF EXISTS "System admins can delete duplicates" ON potential_duplicates;

CREATE POLICY "Users can view duplicates for their business receipts"
  ON potential_duplicates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM receipts r
      JOIN collections c ON c.id = r.collection_id
      JOIN business_members bm ON bm.business_id = c.business_id
      WHERE r.id = potential_duplicates.receipt_id
      AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update duplicate status for their receipts"
  ON potential_duplicates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM receipts r
      JOIN collections c ON c.id = r.collection_id
      JOIN business_members bm ON bm.business_id = c.business_id
      WHERE r.id = potential_duplicates.receipt_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM receipts r
      JOIN collections c ON c.id = r.collection_id
      JOIN business_members bm ON bm.business_id = c.business_id
      WHERE r.id = potential_duplicates.receipt_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'manager')
    )
  );

CREATE POLICY "System admins can view all duplicates"
  ON potential_duplicates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System admins can insert duplicates"
  ON potential_duplicates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System admins can delete duplicates"
  ON potential_duplicates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 2. ADMIN IMPERSONATION SESSIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  started_at timestamptz DEFAULT now() NOT NULL,
  ended_at timestamptz,
  actions_performed jsonb DEFAULT '[]'::jsonb,
  ip_address inet,
  CHECK (admin_id != target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_impersonation_admin_id ON admin_impersonation_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_target_user ON admin_impersonation_sessions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_active ON admin_impersonation_sessions(started_at) WHERE ended_at IS NULL;

ALTER TABLE admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admins can view impersonation sessions" ON admin_impersonation_sessions;
DROP POLICY IF EXISTS "System admins can insert impersonation sessions" ON admin_impersonation_sessions;
DROP POLICY IF EXISTS "System admins can update impersonation sessions" ON admin_impersonation_sessions;

CREATE POLICY "System admins can view impersonation sessions"
  ON admin_impersonation_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System admins can insert impersonation sessions"
  ON admin_impersonation_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System admins can update impersonation sessions"
  ON admin_impersonation_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 3. SYSTEM HEALTH METRICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS system_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  metric_unit text NOT NULL,
  measured_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_health_metrics_name ON system_health_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_health_metrics_time ON system_health_metrics(measured_at DESC);

ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admins can view health metrics" ON system_health_metrics;
DROP POLICY IF EXISTS "System admins can insert health metrics" ON system_health_metrics;

CREATE POLICY "System admins can view health metrics"
  ON system_health_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System admins can insert health metrics"
  ON system_health_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 4. DATABASE QUERIES LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS database_queries_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  query_text text NOT NULL,
  query_type text NOT NULL CHECK (query_type IN ('SELECT', 'EXPLAIN', 'SHOW')),
  rows_affected integer DEFAULT 0,
  execution_time_ms integer,
  executed_at timestamptz DEFAULT now() NOT NULL,
  error_message text,
  success boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_queries_log_admin ON database_queries_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_queries_log_time ON database_queries_log(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_queries_log_success ON database_queries_log(success);

ALTER TABLE database_queries_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admins can view query logs" ON database_queries_log;
DROP POLICY IF EXISTS "System admins can insert query logs" ON database_queries_log;

CREATE POLICY "System admins can view query logs"
  ON database_queries_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System admins can insert query logs"
  ON database_queries_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 5. FIX get_system_health_snapshot FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION get_system_health_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  db_size bigint;
  total_users int;
  active_users_24h int;
  suspended_users int;
  total_businesses int;
  suspended_businesses int;
  total_receipts int;
  pending_receipts int;
  failed_receipts int;
  storage_bytes bigint;
  total_logs_24h int;
  error_logs_24h int;
  critical_logs_24h int;
  error_rate numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only system administrators can view system health';
  END IF;

  SELECT pg_database_size(current_database()) INTO db_size;

  SELECT count(*) INTO total_users FROM auth.users;

  SELECT count(*) INTO active_users_24h
  FROM auth.users
  WHERE last_sign_in_at > now() - interval '24 hours';

  SELECT count(*) INTO suspended_users
  FROM public.profiles
  WHERE suspended = true;

  SELECT count(*) INTO total_businesses FROM public.businesses WHERE deleted_at IS NULL;

  SELECT count(*) INTO suspended_businesses
  FROM public.businesses
  WHERE suspended = true;

  SELECT count(*) INTO total_receipts FROM public.receipts WHERE deleted_at IS NULL;

  SELECT count(*) INTO pending_receipts
  FROM public.receipts
  WHERE deleted_at IS NULL AND extraction_status = 'pending';

  SELECT count(*) INTO failed_receipts
  FROM public.receipts
  WHERE deleted_at IS NULL AND extraction_status = 'failed';

  SELECT COALESCE(SUM(storage_used_bytes), 0)::bigint INTO storage_bytes
  FROM public.businesses;

  SELECT count(*) INTO total_logs_24h
  FROM public.system_logs
  WHERE timestamp > now() - interval '24 hours';

  SELECT count(*) INTO error_logs_24h
  FROM public.system_logs
  WHERE timestamp > now() - interval '24 hours'
  AND level IN ('ERROR', 'CRITICAL');

  SELECT count(*) INTO critical_logs_24h
  FROM public.system_logs
  WHERE timestamp > now() - interval '24 hours'
  AND level = 'CRITICAL';

  IF total_logs_24h > 0 THEN
    error_rate := (error_logs_24h::numeric / total_logs_24h::numeric) * 100;
  ELSE
    error_rate := 0;
  END IF;

  result := jsonb_build_object(
    'timestamp', now(),
    'database', jsonb_build_object(
      'size_bytes', db_size,
      'size_mb', round(db_size / 1048576.0, 2),
      'size_gb', round(db_size / 1073741824.0, 2)
    ),
    'users', jsonb_build_object(
      'total', total_users,
      'active_24h', active_users_24h,
      'suspended', suspended_users
    ),
    'businesses', jsonb_build_object(
      'total', total_businesses,
      'suspended', suspended_businesses
    ),
    'receipts', jsonb_build_object(
      'total', total_receipts,
      'pending_extraction', pending_receipts,
      'failed_extraction', failed_receipts
    ),
    'storage', jsonb_build_object(
      'total_bytes', storage_bytes,
      'total_mb', round(storage_bytes / 1048576.0, 2),
      'total_gb', round(storage_bytes / 1073741824.0, 2)
    ),
    'system', jsonb_build_object(
      'error_rate_24h_percent', round(COALESCE(error_rate, 0), 2),
      'total_logs_24h', total_logs_24h,
      'critical_errors_24h', critical_logs_24h
    )
  );

  INSERT INTO system_health_metrics (metric_name, metric_value, metric_unit, metadata)
  VALUES
    ('database_size', db_size, 'bytes', result),
    ('active_users', active_users_24h, 'count', result),
    ('total_storage', storage_bytes, 'bytes', result),
    ('error_rate_24h', COALESCE(error_rate, 0), 'percentage', result);

  RETURN result;
END;
$$;

-- =====================================================
-- 6. DUPLICATE DETECTION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION detect_duplicate_receipts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  duplicates_found integer := 0;
  receipt_record RECORD;
  potential_dup RECORD;
  score numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only system administrators can detect duplicates';
  END IF;

  FOR receipt_record IN
    SELECT id, vendor_name, transaction_date, total_amount, collection_id
    FROM receipts
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1000
  LOOP
    FOR potential_dup IN
      SELECT id, vendor_name, transaction_date, total_amount
      FROM receipts
      WHERE id != receipt_record.id
        AND collection_id = receipt_record.collection_id
        AND deleted_at IS NULL
        AND (
          LOWER(TRIM(vendor_name)) = LOWER(TRIM(receipt_record.vendor_name))
          OR similarity(LOWER(vendor_name), LOWER(receipt_record.vendor_name)) > 0.8
        )
        AND (
          transaction_date = receipt_record.transaction_date
          OR ABS(EXTRACT(EPOCH FROM (transaction_date - receipt_record.transaction_date))) < 86400
        )
        AND (
          total_amount = receipt_record.total_amount
          OR ABS(total_amount - receipt_record.total_amount) < (receipt_record.total_amount * 0.01)
        )
    LOOP
      score := 0;

      IF LOWER(TRIM(potential_dup.vendor_name)) = LOWER(TRIM(receipt_record.vendor_name)) THEN
        score := score + 40;
      ELSE
        score := score + (similarity(LOWER(potential_dup.vendor_name), LOWER(receipt_record.vendor_name)) * 40);
      END IF;

      IF potential_dup.transaction_date = receipt_record.transaction_date THEN
        score := score + 30;
      ELSE
        score := score + 15;
      END IF;

      IF potential_dup.total_amount = receipt_record.total_amount THEN
        score := score + 30;
      ELSE
        score := score + 20;
      END IF;

      IF score >= 70 THEN
        INSERT INTO potential_duplicates (
          receipt_id, duplicate_of_receipt_id, confidence_score, match_reason, status
        )
        VALUES (
          receipt_record.id,
          potential_dup.id,
          ROUND(score, 2),
          format('Vendor: %s%%, Date: %s, Amount: %s',
            ROUND(similarity(LOWER(potential_dup.vendor_name), LOWER(receipt_record.vendor_name)) * 100),
            CASE WHEN potential_dup.transaction_date = receipt_record.transaction_date THEN 'Exact' ELSE 'Within 1 day' END,
            CASE WHEN potential_dup.total_amount = receipt_record.total_amount THEN 'Exact' ELSE 'Close' END
          ),
          'pending'
        )
        ON CONFLICT (receipt_id, duplicate_of_receipt_id) DO NOTHING;

        duplicates_found := duplicates_found + 1;
      END IF;
    END LOOP;
  END LOOP;

  INSERT INTO system_logs (level, category, message, metadata)
  VALUES (
    'INFO', 'ADMIN',
    format('Duplicate detection completed: %s potential duplicates found', duplicates_found),
    jsonb_build_object('admin_id', auth.uid(), 'duplicates_found', duplicates_found)
  );

  RETURN duplicates_found;
END;
$$;

-- =====================================================
-- 7. EXECUTE ADMIN QUERY FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION execute_admin_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_data jsonb;
  row_count integer := 0;
  start_time timestamptz;
  end_time timestamptz;
  execution_time integer;
  query_type text;
  error_msg text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only system administrators can execute queries';
  END IF;

  query_type := UPPER(TRIM(SPLIT_PART(query_text, ' ', 1)));

  IF query_type NOT IN ('SELECT', 'EXPLAIN', 'SHOW') THEN
    RAISE EXCEPTION 'Only SELECT, EXPLAIN, and SHOW queries are allowed';
  END IF;

  IF query_text ~* '(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)' THEN
    RAISE EXCEPTION 'Query contains forbidden keywords';
  END IF;

  IF query_text !~* 'LIMIT' THEN
    query_text := query_text || ' LIMIT 100';
  END IF;

  start_time := clock_timestamp();

  BEGIN
    EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result_data;
    GET DIAGNOSTICS row_count = ROW_COUNT;

    end_time := clock_timestamp();
    execution_time := EXTRACT(MILLISECONDS FROM (end_time - start_time))::integer;

    INSERT INTO database_queries_log (admin_id, query_text, query_type, rows_affected, execution_time_ms, success)
    VALUES (auth.uid(), query_text, query_type, row_count, execution_time, true);

    RETURN jsonb_build_object(
      'success', true,
      'rows', COALESCE(result_data, '[]'::jsonb),
      'row_count', row_count,
      'execution_time_ms', execution_time
    );

  EXCEPTION WHEN OTHERS THEN
    error_msg := SQLERRM;
    end_time := clock_timestamp();
    execution_time := EXTRACT(MILLISECONDS FROM (end_time - start_time))::integer;

    INSERT INTO database_queries_log (admin_id, query_text, query_type, rows_affected, execution_time_ms, error_message, success)
    VALUES (auth.uid(), query_text, query_type, 0, execution_time, error_msg, false);

    RETURN jsonb_build_object(
      'success', false,
      'error', error_msg,
      'execution_time_ms', execution_time
    );
  END;
END;
$$;

-- =====================================================
-- 8. AUDIT TRIGGER FOR DUPLICATE REVIEWS
-- =====================================================

CREATE OR REPLACE FUNCTION audit_duplicate_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, business_id, changes)
    SELECT
      auth.uid(),
      'duplicate_review',
      'receipt',
      NEW.receipt_id,
      c.business_id,
      jsonb_build_object(
        'duplicate_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'confidence_score', NEW.confidence_score,
        'duplicate_of', NEW.duplicate_of_receipt_id
      )
    FROM receipts r
    JOIN collections c ON c.id = r.collection_id
    WHERE r.id = NEW.receipt_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_duplicate_review_trigger ON potential_duplicates;

CREATE TRIGGER audit_duplicate_review_trigger
  AFTER UPDATE ON potential_duplicates
  FOR EACH ROW
  EXECUTE FUNCTION audit_duplicate_review();

CREATE INDEX IF NOT EXISTS idx_receipts_vendor_trgm ON receipts USING gin (LOWER(vendor_name) gin_trgm_ops);
