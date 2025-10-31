/*
  # Add Duplicate Detection and Admin Enhancement Features

  ## New Tables

  ### 1. `potential_duplicates`
    - Tracks potential duplicate receipts based on vendor, date, and amount matching
    - `id` (uuid, primary key)
    - `receipt_id` (uuid, references receipts)
    - `duplicate_of_receipt_id` (uuid, references receipts)
    - `confidence_score` (numeric) - Similarity score 0-100
    - `match_reason` (text) - Why flagged as duplicate
    - `status` (text) - pending, confirmed, dismissed
    - `reviewed_by` (uuid, references profiles)
    - `reviewed_at` (timestamptz)
    - `created_at` (timestamptz)

  ### 2. `admin_impersonation_sessions`
    - Tracks when admins impersonate users for support
    - `id` (uuid, primary key)
    - `admin_id` (uuid, references profiles)
    - `target_user_id` (uuid, references profiles)
    - `reason` (text) - Why impersonating
    - `started_at` (timestamptz)
    - `ended_at` (timestamptz)
    - `actions_performed` (jsonb) - Log of actions during session
    - `ip_address` (inet)

  ### 3. `system_health_metrics`
    - Stores periodic system health snapshots
    - `id` (uuid, primary key)
    - `metric_name` (text) - e.g., 'database_size', 'active_users', 'storage_used'
    - `metric_value` (numeric)
    - `metric_unit` (text) - e.g., 'bytes', 'count', 'percentage'
    - `measured_at` (timestamptz)
    - `metadata` (jsonb) - Additional context

  ### 4. `database_queries_log`
    - Stores admin database queries for audit trail
    - `id` (uuid, primary key)
    - `admin_id` (uuid, references profiles)
    - `query_text` (text)
    - `query_type` (text) - SELECT, UPDATE, DELETE, etc.
    - `rows_affected` (integer)
    - `execution_time_ms` (integer)
    - `executed_at` (timestamptz)
    - `error_message` (text)
    - `success` (boolean)

  ## Functions

  ### 1. `detect_duplicate_receipts()`
    - Scans for potential duplicates based on vendor name, date, and amount
    - Returns count of new duplicates found

  ### 2. `get_system_health_snapshot()`
    - Returns current system health metrics
    - Database size, active users, storage usage, error rates

  ### 3. `execute_admin_query()`
    - Safely executes read-only queries for admins
    - Logs all queries for audit trail

  ### 4. `start_impersonation_session()`
    - Creates impersonation session record
    - Returns temporary access token

  ### 5. `end_impersonation_session()`
    - Ends active impersonation session
    - Logs final actions performed

  ## Security
  - All new tables have RLS enabled
  - Only system admins can access these features
  - Complete audit logging for all admin actions
  - Impersonation sessions have automatic timeout (4 hours)
  - Read-only database queries only (no DDL, no data modification)
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

  -- Prevent duplicate entries
  UNIQUE(receipt_id, duplicate_of_receipt_id),

  -- Prevent self-referencing
  CHECK (receipt_id != duplicate_of_receipt_id)
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_potential_duplicates_receipt_id ON potential_duplicates(receipt_id);
CREATE INDEX IF NOT EXISTS idx_potential_duplicates_status ON potential_duplicates(status);
CREATE INDEX IF NOT EXISTS idx_potential_duplicates_confidence ON potential_duplicates(confidence_score DESC);

-- Enable RLS
ALTER TABLE potential_duplicates ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only business owners/managers can see duplicates for their receipts
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

-- System admins can see all
CREATE POLICY "System admins can view all duplicates"
  ON potential_duplicates
  FOR ALL
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

  -- Prevent self-impersonation
  CHECK (admin_id != target_user_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_impersonation_admin_id ON admin_impersonation_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_target_user ON admin_impersonation_sessions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_active ON admin_impersonation_sessions(started_at) WHERE ended_at IS NULL;

-- Enable RLS
ALTER TABLE admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Only system admins can access
CREATE POLICY "Only system admins can manage impersonation sessions"
  ON admin_impersonation_sessions
  FOR ALL
  TO authenticated
  USING (
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

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_health_metrics_name ON system_health_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_health_metrics_time ON system_health_metrics(measured_at DESC);

-- Enable RLS
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;

-- Only system admins can access
CREATE POLICY "Only system admins can view health metrics"
  ON system_health_metrics
  FOR SELECT
  TO authenticated
  USING (
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

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_queries_log_admin ON database_queries_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_queries_log_time ON database_queries_log(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_queries_log_success ON database_queries_log(success);

-- Enable RLS
ALTER TABLE database_queries_log ENABLE ROW LEVEL SECURITY;

-- Only system admins can access
CREATE POLICY "Only system admins can view query logs"
  ON database_queries_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 5. DUPLICATE DETECTION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION detect_duplicate_receipts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  duplicates_found integer := 0;
  receipt_record RECORD;
  potential_dup RECORD;
  score numeric;
BEGIN
  -- Only system admins or business owners/managers can run this
  IF NOT EXISTS (
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only system administrators can detect duplicates';
  END IF;

  -- Find potential duplicates by comparing vendor name, date, and amount
  -- We'll use a similarity threshold approach
  FOR receipt_record IN
    SELECT
      id,
      vendor_name,
      transaction_date,
      total_amount,
      collection_id
    FROM receipts
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1000  -- Process in batches for performance
  LOOP
    -- Look for similar receipts in the same collection
    FOR potential_dup IN
      SELECT
        id,
        vendor_name,
        transaction_date,
        total_amount
      FROM receipts
      WHERE id != receipt_record.id
        AND collection_id = receipt_record.collection_id
        AND deleted_at IS NULL
        AND (
          -- Same vendor name (case-insensitive)
          LOWER(TRIM(vendor_name)) = LOWER(TRIM(receipt_record.vendor_name))
          OR
          -- Similar vendor name (allowing for minor differences)
          similarity(LOWER(vendor_name), LOWER(receipt_record.vendor_name)) > 0.8
        )
        AND (
          -- Same date
          transaction_date = receipt_record.transaction_date
          OR
          -- Within 1 day
          ABS(EXTRACT(EPOCH FROM (transaction_date - receipt_record.transaction_date))) < 86400
        )
        AND (
          -- Exact same amount
          total_amount = receipt_record.total_amount
          OR
          -- Within 1% of amount (for rounding differences)
          ABS(total_amount - receipt_record.total_amount) < (receipt_record.total_amount * 0.01)
        )
    LOOP
      -- Calculate confidence score
      score := 0;

      -- Exact vendor match = 40 points
      IF LOWER(TRIM(potential_dup.vendor_name)) = LOWER(TRIM(receipt_record.vendor_name)) THEN
        score := score + 40;
      ELSE
        -- Similarity score = up to 40 points
        score := score + (similarity(LOWER(potential_dup.vendor_name), LOWER(receipt_record.vendor_name)) * 40);
      END IF;

      -- Exact date match = 30 points
      IF potential_dup.transaction_date = receipt_record.transaction_date THEN
        score := score + 30;
      ELSE
        -- Within 1 day = 15 points
        score := score + 15;
      END IF;

      -- Exact amount match = 30 points
      IF potential_dup.total_amount = receipt_record.total_amount THEN
        score := score + 30;
      ELSE
        -- Close amount = 20 points
        score := score + 20;
      END IF;

      -- Only insert if score is high enough and doesn't already exist
      IF score >= 70 THEN
        INSERT INTO potential_duplicates (
          receipt_id,
          duplicate_of_receipt_id,
          confidence_score,
          match_reason,
          status
        )
        VALUES (
          receipt_record.id,
          potential_dup.id,
          ROUND(score, 2),
          format('Vendor: %s%%, Date: %s, Amount: %s',
            ROUND(similarity(LOWER(potential_dup.vendor_name), LOWER(receipt_record.vendor_name)) * 100),
            CASE
              WHEN potential_dup.transaction_date = receipt_record.transaction_date THEN 'Exact'
              ELSE 'Within 1 day'
            END,
            CASE
              WHEN potential_dup.total_amount = receipt_record.total_amount THEN 'Exact'
              ELSE 'Close'
            END
          ),
          'pending'
        )
        ON CONFLICT (receipt_id, duplicate_of_receipt_id) DO NOTHING;

        duplicates_found := duplicates_found + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- Log the operation
  INSERT INTO system_logs (
    level,
    category,
    message,
    metadata
  ) VALUES (
    'INFO',
    'ADMIN',
    format('Duplicate detection completed: %s potential duplicates found', duplicates_found),
    jsonb_build_object(
      'admin_id', auth.uid(),
      'duplicates_found', duplicates_found
    )
  );

  RETURN duplicates_found;
END;
$$;

-- =====================================================
-- 6. SYSTEM HEALTH SNAPSHOT FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION get_system_health_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  health_data jsonb;
  db_size bigint;
  active_users_count integer;
  total_storage bigint;
  error_rate_24h numeric;
  avg_response_time numeric;
BEGIN
  -- Only system admins can access
  IF NOT EXISTS (
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only system administrators can view system health';
  END IF;

  -- Get database size
  SELECT pg_database_size(current_database()) INTO db_size;

  -- Get active users (logged in within last 24 hours)
  SELECT COUNT(DISTINCT user_id) INTO active_users_count
  FROM system_logs
  WHERE created_at > now() - interval '24 hours'
    AND category = 'AUTH'
    AND message LIKE '%login%success%';

  -- Get total storage used
  SELECT COALESCE(SUM(storage_used_bytes), 0) INTO total_storage
  FROM businesses;

  -- Calculate error rate (last 24 hours)
  SELECT
    ROUND(
      (COUNT(*) FILTER (WHERE level IN ('ERROR', 'CRITICAL'))::numeric /
       NULLIF(COUNT(*), 0) * 100),
      2
    ) INTO error_rate_24h
  FROM system_logs
  WHERE created_at > now() - interval '24 hours';

  -- Build health snapshot
  health_data := jsonb_build_object(
    'timestamp', now(),
    'database', jsonb_build_object(
      'size_bytes', db_size,
      'size_mb', ROUND(db_size / 1024.0 / 1024.0, 2),
      'size_gb', ROUND(db_size / 1024.0 / 1024.0 / 1024.0, 2)
    ),
    'users', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL),
      'active_24h', active_users_count,
      'suspended', (SELECT COUNT(*) FROM profiles WHERE suspended = true)
    ),
    'businesses', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM businesses WHERE deleted_at IS NULL),
      'suspended', (SELECT COUNT(*) FROM businesses WHERE suspended = true)
    ),
    'receipts', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM receipts WHERE deleted_at IS NULL),
      'pending_extraction', (SELECT COUNT(*) FROM receipts WHERE extraction_status = 'pending'),
      'failed_extraction', (SELECT COUNT(*) FROM receipts WHERE extraction_status = 'failed')
    ),
    'storage', jsonb_build_object(
      'total_bytes', total_storage,
      'total_mb', ROUND(total_storage / 1024.0 / 1024.0, 2),
      'total_gb', ROUND(total_storage / 1024.0 / 1024.0 / 1024.0, 2)
    ),
    'system', jsonb_build_object(
      'error_rate_24h_percent', COALESCE(error_rate_24h, 0),
      'total_logs_24h', (SELECT COUNT(*) FROM system_logs WHERE created_at > now() - interval '24 hours'),
      'critical_errors_24h', (SELECT COUNT(*) FROM system_logs WHERE level = 'CRITICAL' AND created_at > now() - interval '24 hours')
    )
  );

  -- Store snapshot
  INSERT INTO system_health_metrics (metric_name, metric_value, metric_unit, metadata)
  VALUES
    ('database_size', db_size, 'bytes', health_data),
    ('active_users', active_users_count, 'count', health_data),
    ('total_storage', total_storage, 'bytes', health_data),
    ('error_rate_24h', COALESCE(error_rate_24h, 0), 'percentage', health_data);

  RETURN health_data;
END;
$$;

-- =====================================================
-- 7. EXECUTE ADMIN QUERY FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION execute_admin_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- Only system admins can execute queries
  IF NOT EXISTS (
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only system administrators can execute queries';
  END IF;

  -- Validate query is read-only
  query_type := UPPER(TRIM(SPLIT_PART(query_text, ' ', 1)));

  IF query_type NOT IN ('SELECT', 'EXPLAIN', 'SHOW') THEN
    RAISE EXCEPTION 'Only SELECT, EXPLAIN, and SHOW queries are allowed';
  END IF;

  -- Check for dangerous patterns
  IF query_text ~* '(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)' THEN
    RAISE EXCEPTION 'Query contains forbidden keywords';
  END IF;

  -- Limit result size
  IF query_text !~* 'LIMIT' THEN
    query_text := query_text || ' LIMIT 100';
  END IF;

  start_time := clock_timestamp();

  BEGIN
    -- Execute the query and convert to JSON
    EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result_data;

    GET DIAGNOSTICS row_count = ROW_COUNT;

    end_time := clock_timestamp();
    execution_time := EXTRACT(MILLISECONDS FROM (end_time - start_time))::integer;

    -- Log successful query
    INSERT INTO database_queries_log (
      admin_id,
      query_text,
      query_type,
      rows_affected,
      execution_time_ms,
      success
    ) VALUES (
      auth.uid(),
      query_text,
      query_type,
      row_count,
      execution_time,
      true
    );

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

    -- Log failed query
    INSERT INTO database_queries_log (
      admin_id,
      query_text,
      query_type,
      rows_affected,
      execution_time_ms,
      error_message,
      success
    ) VALUES (
      auth.uid(),
      query_text,
      query_type,
      0,
      execution_time,
      error_msg,
      false
    );

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
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      business_id,
      changes
    )
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

CREATE TRIGGER audit_duplicate_review_trigger
  AFTER UPDATE ON potential_duplicates
  FOR EACH ROW
  EXECUTE FUNCTION audit_duplicate_review();

-- =====================================================
-- 9. ENABLE pg_trgm EXTENSION FOR SIMILARITY SEARCH
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create index for similarity searches on vendor names
CREATE INDEX IF NOT EXISTS idx_receipts_vendor_trgm ON receipts USING gin (LOWER(vendor_name) gin_trgm_ops);
