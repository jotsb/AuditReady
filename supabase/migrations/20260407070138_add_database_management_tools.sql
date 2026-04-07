/*
  # Database Management Admin Tools

  1. New Tables
    - `database_backups` - Tracks database backup history and metadata
      - `id` (uuid, primary key)
      - `name` (text) - Human-readable backup name
      - `description` (text) - Optional description
      - `status` (text) - pending, in_progress, completed, failed
      - `backup_type` (text) - manual, scheduled, pre_migration
      - `tables_included` (text[]) - List of tables in backup
      - `size_bytes` (bigint) - Backup file size
      - `storage_path` (text) - Path in storage bucket
      - `row_counts` (jsonb) - Row count per table at backup time
      - `error_message` (text) - Error details if failed
      - `created_by` (uuid) - Admin who initiated backup
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)

  2. New Functions (all admin-only, SECURITY DEFINER)
    - `admin_get_table_info()` - List all tables with sizes and row counts
    - `admin_get_table_columns(text)` - Get column details for a table
    - `admin_get_table_indexes(text)` - Get index details for a table
    - `admin_get_foreign_keys()` - Get all foreign key relationships
    - `admin_get_rls_policies(text)` - Get RLS policies for a table
    - `admin_get_database_stats()` - Get comprehensive database statistics
    - `admin_browse_table_data(text, int, int, text, text)` - Browse table data with pagination

  3. Security
    - RLS enabled on database_backups
    - All policies restricted to system admins
    - All functions verify admin role before executing
    - Table name validation prevents SQL injection
    - Data browsing limited to 100 rows per request

  4. Storage
    - Creates `database-backups` storage bucket for backup files
*/

-- ============================================================================
-- DATABASE BACKUPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS database_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  backup_type text NOT NULL DEFAULT 'manual'
    CHECK (backup_type IN ('manual', 'scheduled', 'pre_migration')),
  tables_included text[] NOT NULL DEFAULT '{}',
  size_bytes bigint DEFAULT 0,
  storage_path text,
  row_counts jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE database_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view backups"
  ON database_backups FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can create backups"
  ON database_backups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update backups"
  ON database_backups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete backups"
  ON database_backups FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_database_backups_created_at
  ON database_backups(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_database_backups_status
  ON database_backups(status);

-- ============================================================================
-- STORAGE BUCKET FOR BACKUPS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'database-backups',
  'database-backups',
  false,
  524288000,
  ARRAY['application/json', 'application/zip']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can manage backup files"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'database-backups'
    AND EXISTS (SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    bucket_id = 'database-backups'
    AND EXISTS (SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- ADMIN FUNCTION: Get Table Info
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_get_table_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'table_name', s.relname,
        'row_estimate', s.n_live_tup,
        'size_bytes', pg_total_relation_size(quote_ident(s.schemaname) || '.' || quote_ident(s.relname)),
        'size_pretty', pg_size_pretty(pg_total_relation_size(quote_ident(s.schemaname) || '.' || quote_ident(s.relname))),
        'dead_tuples', s.n_dead_tup,
        'last_vacuum', s.last_vacuum,
        'last_autovacuum', s.last_autovacuum,
        'last_analyze', s.last_analyze,
        'rls_enabled', (
          SELECT c.relrowsecurity
          FROM pg_class c
          JOIN pg_namespace n ON c.relnamespace = n.oid
          WHERE n.nspname = 'public' AND c.relname = s.relname
        )
      ) ORDER BY pg_total_relation_size(quote_ident(s.schemaname) || '.' || quote_ident(s.relname)) DESC
    ), '[]'::jsonb)
    FROM pg_stat_user_tables s
    WHERE s.schemaname = 'public'
  );
END;
$$;

-- ============================================================================
-- ADMIN FUNCTION: Get Table Columns
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_get_table_columns(p_table_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table_name AND table_type = 'BASE TABLE'
  ) THEN
    RAISE EXCEPTION 'Table not found: %', p_table_name;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'column_name', c.column_name,
        'data_type', c.data_type,
        'udt_name', c.udt_name,
        'is_nullable', c.is_nullable,
        'column_default', c.column_default,
        'character_maximum_length', c.character_maximum_length,
        'ordinal_position', c.ordinal_position,
        'is_primary_key', EXISTS (
          SELECT 1
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = 'public'
            AND tc.table_name = p_table_name
            AND tc.constraint_type = 'PRIMARY KEY'
            AND kcu.column_name = c.column_name
        )
      ) ORDER BY c.ordinal_position
    ), '[]'::jsonb)
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = p_table_name
  );
END;
$$;

-- ============================================================================
-- ADMIN FUNCTION: Get Table Indexes
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_get_table_indexes(p_table_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'index_name', i.indexname,
        'index_def', i.indexdef,
        'size_bytes', pg_relation_size(quote_ident(i.schemaname) || '.' || quote_ident(i.indexname)),
        'size_pretty', pg_size_pretty(pg_relation_size(quote_ident(i.schemaname) || '.' || quote_ident(i.indexname)))
      )
    ), '[]'::jsonb)
    FROM pg_indexes i
    WHERE i.schemaname = 'public' AND i.tablename = p_table_name
  );
END;
$$;

-- ============================================================================
-- ADMIN FUNCTION: Get Foreign Keys
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_get_foreign_keys()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'constraint_name', tc.constraint_name,
        'source_table', tc.table_name,
        'source_column', kcu.column_name,
        'target_table', ccu.table_name,
        'target_column', ccu.column_name
      )
    ), '[]'::jsonb)
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  );
END;
$$;

-- ============================================================================
-- ADMIN FUNCTION: Get RLS Policies
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_get_rls_policies(p_table_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'table_name', p.tablename,
        'policy_name', p.policyname,
        'permissive', p.permissive,
        'roles', p.roles,
        'cmd', p.cmd,
        'qual', p.qual,
        'with_check', p.with_check
      )
    ), '[]'::jsonb)
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (p_table_name IS NULL OR p.tablename = p_table_name)
  );
END;
$$;

-- ============================================================================
-- ADMIN FUNCTION: Get Database Statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_get_database_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT jsonb_build_object(
    'database_size', pg_size_pretty(pg_database_size(current_database())),
    'database_size_bytes', pg_database_size(current_database()),
    'table_count', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
    'index_count', (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'),
    'total_rows_estimate', (SELECT COALESCE(sum(n_live_tup), 0) FROM pg_stat_user_tables WHERE schemaname = 'public'),
    'dead_tuples', (SELECT COALESCE(sum(n_dead_tup), 0) FROM pg_stat_user_tables WHERE schemaname = 'public'),
    'cache_hit_ratio', (
      SELECT COALESCE(
        round(sum(heap_blks_hit)::numeric / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100, 2),
        100
      )
      FROM pg_statio_user_tables
    ),
    'index_hit_ratio', (
      SELECT COALESCE(
        round(sum(idx_blks_hit)::numeric / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0) * 100, 2),
        100
      )
      FROM pg_statio_user_indexes
    ),
    'active_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'active'),
    'idle_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle'),
    'total_connections', (SELECT count(*) FROM pg_stat_activity),
    'max_connections', (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'),
    'postgres_version', version(),
    'uptime', (SELECT extract(epoch FROM (now() - pg_postmaster_start_time()))::bigint)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================================
-- ADMIN FUNCTION: Browse Table Data (safe, validated)
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_browse_table_data(
  p_table_name text,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_order_by text DEFAULT NULL,
  p_order_dir text DEFAULT 'ASC'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_count bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table_name AND table_type = 'BASE TABLE'
  ) THEN
    RAISE EXCEPTION 'Table not found: %', p_table_name;
  END IF;

  IF p_limit > 100 THEN p_limit := 100; END IF;
  IF p_limit < 1 THEN p_limit := 1; END IF;
  IF p_offset < 0 THEN p_offset := 0; END IF;

  EXECUTE format('SELECT count(*) FROM %I', p_table_name) INTO total_count;

  IF p_order_by IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = p_order_by
    ) THEN
      p_order_by := NULL;
    END IF;
  END IF;

  IF p_order_dir NOT IN ('ASC', 'DESC') THEN
    p_order_dir := 'ASC';
  END IF;

  IF p_order_by IS NOT NULL THEN
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (SELECT * FROM %I ORDER BY %I ' || p_order_dir || ' LIMIT $1 OFFSET $2) t',
      p_table_name, p_order_by
    ) USING p_limit, p_offset INTO result;
  ELSE
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (SELECT * FROM %I LIMIT $1 OFFSET $2) t',
      p_table_name
    ) USING p_limit, p_offset INTO result;
  END IF;

  RETURN jsonb_build_object(
    'rows', COALESCE(result, '[]'::jsonb),
    'total_count', total_count,
    'page_limit', p_limit,
    'page_offset', p_offset
  );
END;
$$;
