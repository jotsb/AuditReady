-- =====================================================
-- AUDIT PROOF - COMPLETE DATABASE SCHEMA
-- =====================================================
-- Generated from migration files
-- This file creates the complete database structure
-- without any data migration
-- =====================================================

-- =====================================================
-- EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid";


-- =====================================================
-- TABLES
-- =====================================================

-- Table: profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone_number text,
  mfa_method text DEFAULT 'authenticator' CHECK (mfa_method IN ('authenticator', 'sms')),
  mfa_enabled boolean DEFAULT false,
  trusted_devices jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ADD COLUMN email text;
ALTER TABLE profiles ALTER COLUMN full_name DROP NOT NULL;
ALTER TABLE profiles ADD COLUMN suspended boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN suspension_reason text;
ALTER TABLE profiles ADD COLUMN suspended_at timestamptz;
ALTER TABLE profiles ADD COLUMN suspended_by uuid REFERENCES auth.users(id);
ALTER TABLE profiles ADD COLUMN deleted_at timestamptz;
ALTER TABLE profiles ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
ALTER TABLE profiles ADD COLUMN deletion_reason text;
ALTER TABLE profiles ADD COLUMN last_login_at timestamptz;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Table: businesses
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  tax_id text,
  currency text DEFAULT 'CAD',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE businesses ADD COLUMN require_approval_workflow boolean DEFAULT false NOT NULL;
ALTER TABLE businesses ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE businesses ADD COLUMN require_approval_workflow boolean DEFAULT false NOT NULL;
ALTER TABLE businesses ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE businesses ADD COLUMN require_approval_workflow boolean DEFAULT false NOT NULL;
ALTER TABLE businesses ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE businesses ADD COLUMN suspended boolean DEFAULT false;
ALTER TABLE businesses ADD COLUMN suspension_reason text;
ALTER TABLE businesses ADD COLUMN suspended_at timestamptz;
ALTER TABLE businesses ADD COLUMN suspended_by uuid REFERENCES auth.users(id);
ALTER TABLE businesses ADD COLUMN soft_deleted boolean DEFAULT false;
ALTER TABLE businesses ADD COLUMN deleted_at timestamptz;
ALTER TABLE businesses ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
ALTER TABLE businesses ADD COLUMN deletion_reason text;
ALTER TABLE businesses ADD COLUMN storage_used_bytes bigint DEFAULT 0;
ALTER TABLE businesses ADD COLUMN storage_limit_bytes bigint DEFAULT 10737418240;
ALTER TABLE businesses ADD COLUMN last_storage_check timestamptz;

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Table: system_roles
CREATE TABLE IF NOT EXISTS system_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role system_role_type NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE system_roles ENABLE ROW LEVEL SECURITY;

-- Table: collections
CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  year integer NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE collections 
  DROP CONSTRAINT IF EXISTS collections_business_id_fkey;
ALTER TABLE collections
  ADD CONSTRAINT collections_business_id_fkey 
  FOREIGN KEY (business_id) 
  REFERENCES businesses(id) 
  ON DELETE RESTRICT;

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Table: collection_members
CREATE TABLE IF NOT EXISTS collection_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'submitter', 'viewer')),
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(collection_id, user_id)
);

ALTER TABLE collection_members ENABLE ROW LEVEL SECURITY;

-- Table: business_members
CREATE TABLE IF NOT EXISTS business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role business_role_type NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(business_id, user_id)
);

ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;

-- Table: receipts
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vendor_name text,
  vendor_address text,
  transaction_date timestamptz,
  subtotal numeric(10,2),
  gst_amount numeric(10,2) DEFAULT 0,
  pst_amount numeric(10,2) DEFAULT 0,
  total_amount numeric(10,2) NOT NULL,
  payment_method text,
  category text,
  notes text,
  file_path text,
  file_type text,
  extraction_status text DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  extraction_data jsonb,
  is_edited boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE receipts ADD COLUMN uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE receipts ADD COLUMN requires_approval boolean DEFAULT false NOT NULL;
ALTER TABLE receipts ADD COLUMN uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE receipts ADD COLUMN requires_approval boolean DEFAULT false NOT NULL;
ALTER TABLE receipts ADD COLUMN uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE receipts ADD COLUMN requires_approval boolean DEFAULT false NOT NULL;
ALTER TABLE receipts ADD COLUMN thumbnail_path text;
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS parent_receipt_id uuid REFERENCES receipts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS page_number integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS is_parent boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS total_pages integer DEFAULT 1 NOT NULL;
ALTER TABLE receipts
  DROP CONSTRAINT IF EXISTS valid_page_number;
ALTER TABLE receipts
  ADD CONSTRAINT valid_page_number
  CHECK (page_number > 0 AND page_number <= total_pages);
ALTER TABLE receipts
  DROP CONSTRAINT IF EXISTS no_circular_parent;
ALTER TABLE receipts
  ADD CONSTRAINT no_circular_parent
  CHECK (id != parent_receipt_id);
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS parent_receipt_id uuid REFERENCES receipts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS page_number integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS is_parent boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS total_pages integer DEFAULT 1 NOT NULL;
ALTER TABLE receipts
  DROP CONSTRAINT IF EXISTS valid_page_number;
ALTER TABLE receipts
  ADD CONSTRAINT valid_page_number
  CHECK (page_number > 0 AND page_number <= total_pages);
ALTER TABLE receipts
  DROP CONSTRAINT IF EXISTS no_circular_parent;
ALTER TABLE receipts
  ADD CONSTRAINT no_circular_parent
  CHECK (id != parent_receipt_id);
ALTER TABLE receipts ADD COLUMN deleted_at timestamptz;
ALTER TABLE receipts ADD COLUMN deleted_by uuid REFERENCES profiles(id);
ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS source receipt_source DEFAULT 'upload' NOT NULL;
ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS email_metadata JSONB,
ADD COLUMN IF NOT EXISTS email_message_id TEXT;
ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS source receipt_source DEFAULT 'upload' NOT NULL;
ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS email_metadata JSONB,
ADD COLUMN IF NOT EXISTS email_message_id TEXT;
ALTER TABLE receipts DROP COLUMN file_size_bytes;
ALTER TABLE receipts DROP COLUMN file_mime_type;
ALTER TABLE receipts DROP COLUMN file_validated_at;
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS file_mime_type text,
  ADD COLUMN IF NOT EXISTS file_validated_at timestamptz;

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Table: expense_categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE expense_categories DROP COLUMN IF EXISTS business_id;
ALTER TABLE expense_categories DROP COLUMN IF EXISTS is_default;
ALTER TABLE expense_categories ADD CONSTRAINT expense_categories_name_key UNIQUE (name);
ALTER TABLE expense_categories ADD COLUMN color text DEFAULT '#6B7280';
ALTER TABLE expense_categories ADD COLUMN sort_order integer DEFAULT 0;
ALTER TABLE expense_categories
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS snapshot_before jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_after jsonb,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_status_check 
      CHECK (status IN ('success', 'failure', 'denied'));
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS execution_time_ms integer;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Table: system_logs
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz DEFAULT now() NOT NULL,
  level text NOT NULL,
  category text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  ip_address inet,
  user_agent text,
  stack_trace text,
  execution_time_ms integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE system_logs
      ADD CONSTRAINT system_logs_level_check 
      CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'));
ALTER TABLE system_logs
      ADD CONSTRAINT system_logs_category_check 
      CHECK (category IN ('AUTH', 'DATABASE', 'API', 'EDGE_FUNCTION', 'CLIENT_ERROR', 'SECURITY', 'PERFORMANCE'));
ALTER TABLE system_logs
  DROP CONSTRAINT IF EXISTS system_logs_category_check;
ALTER TABLE system_logs
  ADD CONSTRAINT system_logs_category_check 
  CHECK (category IN (
    'AUTH', 'DATABASE', 'API', 'EDGE_FUNCTION', 
    'CLIENT_ERROR', 'SECURITY', 'PERFORMANCE',
    'USER_ACTION', 'PAGE_VIEW', 'NAVIGATION'
  ));

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Table: invitations
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role business_role_type NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  token uuid UNIQUE DEFAULT gen_random_uuid() NOT NULL,
  status invitation_status_type DEFAULT 'pending' NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '7 days') NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Table: recovery_codes
CREATE TABLE IF NOT EXISTS recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code_hash text NOT NULL,
  used boolean DEFAULT false NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '1 year') NOT NULL
);
ALTER TABLE recovery_codes
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '12 months');

ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;

-- Table: saved_filters
CREATE TABLE IF NOT EXISTS saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL CHECK (length(name) > 0 AND length(name) <= 100),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;

-- Table: saved_audit_filters
CREATE TABLE IF NOT EXISTS saved_audit_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT saved_audit_filters_name_length CHECK (length(name) >= 1 AND length(name) <= 100)
);

ALTER TABLE saved_audit_filters ENABLE ROW LEVEL SECURITY;

-- Table: saved_system_filters
CREATE TABLE IF NOT EXISTS saved_system_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT saved_system_filters_name_length CHECK (length(name) >= 1 AND length(name) <= 100)
);

ALTER TABLE saved_system_filters ENABLE ROW LEVEL SECURITY;

-- Table: log_level_config
CREATE TABLE IF NOT EXISTS log_level_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text UNIQUE NOT NULL,
  min_level text NOT NULL DEFAULT 'INFO',
  enabled boolean NOT NULL DEFAULT true,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE log_level_config
  ADD CONSTRAINT log_level_config_level_check 
  CHECK (min_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'));

ALTER TABLE log_level_config ENABLE ROW LEVEL SECURITY;

-- Table: account_lockouts
CREATE TABLE IF NOT EXISTS account_lockouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz NOT NULL,
  locked_by_ip inet NOT NULL,
  attempts_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  unlock_reason text,
  unlocked_at timestamptz,
  unlocked_by uuid REFERENCES auth.users(id)
);

ALTER TABLE account_lockouts ENABLE ROW LEVEL SECURITY;

-- Table: failed_login_attempts
CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address inet NOT NULL,
  attempt_time timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  failure_reason text NOT NULL DEFAULT 'invalid_credentials',
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- Table: mfa_failed_attempts
CREATE TABLE IF NOT EXISTS mfa_failed_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  attempt_type text NOT NULL CHECK (attempt_type IN ('totp', 'recovery_code')),
  attempted_at timestamptz DEFAULT now() NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE mfa_failed_attempts ENABLE ROW LEVEL SECURITY;

-- Table: security_events
CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- 'unauthorized_access', 'suspicious_upload', 'rate_limit_exceeded', etc.
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Table: blocked_ips
CREATE TABLE IF NOT EXISTS blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address inet UNIQUE NOT NULL,
  reason text NOT NULL,
  blocked_by uuid REFERENCES auth.users(id),
  blocked_until timestamptz, -- NULL means permanent
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- Table: rate_limit_config
CREATE TABLE IF NOT EXISTS rate_limit_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_pattern text UNIQUE NOT NULL, -- e.g., '/functions/v1/extract-receipt-data'
  requests_per_minute integer NOT NULL DEFAULT 60,
  requests_per_hour integer NOT NULL DEFAULT 1000,
  requests_per_day integer NOT NULL DEFAULT 10000,
  enabled boolean DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rate_limit_config ENABLE ROW LEVEL SECURITY;

-- Table: rate_limit_attempts
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('login', 'upload', 'api_call', 'export', 'email')),
  attempts integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  window_end timestamptz NOT NULL,
  is_blocked boolean NOT NULL DEFAULT false,
  block_expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- Table: user_rate_limit_overrides
CREATE TABLE IF NOT EXISTS user_rate_limit_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint_pattern text NOT NULL,
  requests_per_minute integer,
  requests_per_hour integer,
  requests_per_day integer,
  reason text,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint_pattern)
);

ALTER TABLE user_rate_limit_overrides ENABLE ROW LEVEL SECURITY;

-- Table: dashboard_analytics
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

ALTER TABLE dashboard_analytics ENABLE ROW LEVEL SECURITY;

-- Table: system_health_metrics
CREATE TABLE IF NOT EXISTS system_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  metric_unit text NOT NULL,
  measured_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;

-- Table: database_queries_log
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

ALTER TABLE database_queries_log ENABLE ROW LEVEL SECURITY;

-- Table: admin_impersonation_sessions
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

ALTER TABLE admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Table: export_jobs
CREATE TABLE IF NOT EXISTS export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status export_job_status NOT NULL DEFAULT 'pending',
  export_type text NOT NULL DEFAULT 'full_business',
  file_path text,
  file_size_bytes bigint DEFAULT 0,
  progress_percent integer DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

-- Table: email_receipts_inbox
CREATE TABLE IF NOT EXISTS email_receipts_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_email_data JSONB NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
  attachments_count INTEGER DEFAULT 0,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_receipts_inbox ENABLE ROW LEVEL SECURITY;

-- Table: receipt_approvals
CREATE TABLE IF NOT EXISTS receipt_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid REFERENCES receipts(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status approval_status_type DEFAULT 'pending' NOT NULL,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE receipt_approvals ENABLE ROW LEVEL SECURITY;

-- Table: cleanup_jobs
CREATE TABLE IF NOT EXISTS cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (job_type IN ('orphaned_files', 'failed_extractions', 'soft_deleted_receipts', 'old_audit_logs')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scanning', 'ready', 'running', 'completed', 'failed', 'cancelled')),
  items_found integer DEFAULT 0,
  items_processed integer DEFAULT 0,
  items_deleted integer DEFAULT 0,
  total_size_bytes bigint DEFAULT 0,
  deleted_size_bytes bigint DEFAULT 0,
  scan_results jsonb DEFAULT '[]'::jsonb,
  error_message text,
  started_by uuid REFERENCES auth.users(id) NOT NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cleanup_jobs ENABLE ROW LEVEL SECURITY;

-- Table: detected_anomalies
CREATE TABLE IF NOT EXISTS detected_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  anomaly_type text NOT NULL, -- 'unusual_time', 'unusual_location', 'unusual_frequency', 'suspicious_pattern'
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description text NOT NULL,
  ip_address inet,
  user_agent text,
  detected_at timestamptz DEFAULT now(),
  reviewed boolean DEFAULT false,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  false_positive boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE detected_anomalies ENABLE ROW LEVEL SECURITY;

-- Table: potential_duplicates
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

ALTER TABLE potential_duplicates ENABLE ROW LEVEL SECURITY;

-- Table: signed_url_requests
CREATE TABLE IF NOT EXISTS signed_url_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address inet,
  expires_at timestamptz NOT NULL,
  accessed boolean DEFAULT false,
  access_count integer DEFAULT 0,
  last_accessed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE signed_url_requests ENABLE ROW LEVEL SECURITY;

-- Table: user_activity_patterns
CREATE TABLE IF NOT EXISTS user_activity_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type text NOT NULL, -- 'login', 'upload', 'download', 'api_call'
  typical_time_of_day integer[], -- Array of hours (0-23)
  typical_days_of_week integer[], -- Array of days (0-6, 0=Sunday)
  typical_locations inet[], -- Array of typical IP addresses
  average_frequency_per_day numeric,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(user_id, pattern_type)
);

ALTER TABLE user_activity_patterns ENABLE ROW LEVEL SECURITY;

-- Table: system_config
CREATE TABLE IF NOT EXISTS system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_settings jsonb NOT NULL DEFAULT '{
    "max_file_size_mb": 10,
    "allowed_file_types": ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    "default_storage_quota_gb": 10
  }'::jsonb,
  email_settings jsonb NOT NULL DEFAULT '{
    "smtp_enabled": false,
    "email_from_name": "Audit Proof",
    "email_from_address": "noreply@auditproof.com"
  }'::jsonb,
  app_settings jsonb NOT NULL DEFAULT '{
    "app_name": "Audit Proof",
    "app_version": "0.8.4",
    "maintenance_mode": false
  }'::jsonb,
  feature_flags jsonb NOT NULL DEFAULT '{
    "mfa_required": false,
    "email_verification_required": true,
    "ai_extraction_enabled": true,
    "multi_page_receipts_enabled": true
  }'::jsonb,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_role ON audit_logs(actor_role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_business_id ON business_members(business_id);
CREATE INDEX IF NOT EXISTS idx_business_members_user_id ON business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_businesses_soft_deleted ON businesses(soft_deleted) WHERE soft_deleted = true;
CREATE INDEX IF NOT EXISTS idx_businesses_storage_usage ON businesses(storage_used_bytes);
CREATE INDEX IF NOT EXISTS idx_businesses_suspended ON businesses(suspended) WHERE suspended = true;
CREATE INDEX IF NOT EXISTS idx_collection_members_collection_id ON collection_members(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_members_user_id ON collection_members(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_business_id ON collections(business_id);
CREATE INDEX IF NOT EXISTS idx_collections_year ON collections(year);
CREATE INDEX IF NOT EXISTS idx_email_inbox_business_id ON email_receipts_inbox(business_id);
CREATE INDEX IF NOT EXISTS idx_email_inbox_message_id ON email_receipts_inbox(message_id);
CREATE INDEX IF NOT EXISTS idx_email_inbox_received_at ON email_receipts_inbox(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_inbox_status ON email_receipts_inbox(processing_status);
CREATE INDEX IF NOT EXISTS idx_expense_categories_business_id ON expense_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_is_default ON expense_categories(is_default);
CREATE INDEX IF NOT EXISTS idx_export_jobs_business_id ON export_jobs(business_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_expires_at ON export_jobs(expires_at);
CREATE INDEX IF NOT EXISTS idx_export_jobs_requested_by ON export_jobs(requested_by);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_health_metrics_name ON system_health_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_health_metrics_time ON system_health_metrics(measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_active ON admin_impersonation_sessions(started_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_impersonation_admin_id ON admin_impersonation_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_target_user ON admin_impersonation_sessions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_mfa_failed_attempts_attempted_at ON mfa_failed_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_mfa_failed_attempts_user_id ON mfa_failed_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_potential_duplicates_confidence ON potential_duplicates(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_potential_duplicates_receipt_id ON potential_duplicates(receipt_id);
CREATE INDEX IF NOT EXISTS idx_potential_duplicates_status ON potential_duplicates(status);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_last_login_at ON profiles(last_login_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_suspended ON profiles(suspended) WHERE suspended = true;
CREATE INDEX IF NOT EXISTS idx_queries_log_admin ON database_queries_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_queries_log_success ON database_queries_log(success);
CREATE INDEX IF NOT EXISTS idx_queries_log_time ON database_queries_log(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipt_approvals_receipt_id ON receipt_approvals(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_approvals_status ON receipt_approvals(status);
CREATE INDEX IF NOT EXISTS idx_receipts_active ON receipts(collection_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts(category);
CREATE INDEX IF NOT EXISTS idx_receipts_collection_id ON receipts(collection_id);
CREATE INDEX IF NOT EXISTS idx_receipts_deleted_at ON receipts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_email_message_id ON receipts(email_message_id) WHERE email_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_extraction_status ON receipts(extraction_status) WHERE extraction_status = 'failed';
CREATE INDEX IF NOT EXISTS idx_receipts_source ON receipts(source);
CREATE INDEX IF NOT EXISTS idx_receipts_transaction_date ON receipts(transaction_date);
CREATE INDEX IF NOT EXISTS idx_receipts_uploaded_by ON receipts(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_receipts_vendor_trgm ON receipts USING gin (LOWER(vendor_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_expires_at ON recovery_codes(expires_at) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_recovery_codes_unused ON recovery_codes(user_id, used) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_recovery_codes_user_id ON recovery_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_audit_filters_user_id ON saved_audit_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_default ON saved_filters(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_system_filters_user_id ON saved_system_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_system_config_updated_at ON system_config(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_session_id ON system_logs(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_roles_user_id ON system_roles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_inbox_unique_message_id ON email_receipts_inbox(message_id);


-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function: admin_reset_user_mfa
CREATE OR REPLACE FUNCTION admin_reset_user_mfa(
  target_user_id uuid,
  admin_user_id uuid,
  reset_reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_factors_deleted integer;
BEGIN
  -- Verify the caller is a system admin
  SELECT EXISTS (
    SELECT 1 FROM system_roles 
    WHERE user_id = admin_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only system admins can reset MFA';
  END IF;

  -- Delete all MFA factors for the target user
  DELETE FROM auth.mfa_factors 
  WHERE user_id = target_user_id;
  
  GET DIAGNOSTICS v_factors_deleted = ROW_COUNT;

  -- Update the user's profile
  UPDATE profiles
  SET 
    mfa_enabled = false,
    mfa_method = null,
    trusted_devices = null,
    updated_at = now()
  WHERE id = target_user_id;

  -- Delete recovery codes
  DELETE FROM recovery_codes
  WHERE user_id = target_user_id;

  -- Log the action in audit_logs
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    admin_user_id,
    'admin_reset_mfa',
    'profile',
    target_user_id,
    jsonb_build_object(
      'reason', reset_reason,
      'via', 'database_function',
      'factors_removed', v_factors_deleted
    )
  );

  -- Log system event
  PERFORM log_system_event(
    'WARN',
    'SECURITY',
    'Admin reset user MFA via database function',
    jsonb_build_object(
      'action', 'reset_mfa',
      'target_user_id', target_user_id,
      'admin_user_id', admin_user_id,
      'reason', reset_reason,
      'factors_removed', v_factors_deleted
    ),
    admin_user_id,
    null,
    null,
    null,
    null,
    null
  );

  RETURN json_build_object(
    'success', true,
    'factors_removed', v_factors_deleted,
    'message', 'MFA reset successfully'
  );
END;
$$ LANGUAGE plpgsql;

-- Function: audit_account_lockouts
CREATE OR REPLACE FUNCTION audit_account_lockouts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      new_values,
      changed_by,
      ip_address
    ) VALUES (
      'account_lockouts',
      NEW.id,
      'INSERT',
      to_jsonb(NEW),
      auth.uid(),
      inet_client_addr()
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_values,
      new_values,
      changed_by,
      ip_address
    ) VALUES (
      'account_lockouts',
      NEW.id,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      auth.uid(),
      inet_client_addr()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: audit_business_admin_changes
CREATE OR REPLACE FUNCTION audit_business_admin_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Audit suspension changes
  IF (OLD.suspended IS DISTINCT FROM NEW.suspended) THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      COALESCE(NEW.suspended_by, auth.uid()),
      CASE WHEN NEW.suspended THEN 'suspend_business' ELSE 'unsuspend_business' END,
      'business',
      NEW.id,
      jsonb_build_object(
        'suspended', NEW.suspended,
        'reason', NEW.suspension_reason,
        'suspended_at', NEW.suspended_at
      )
    );

    -- Log to system logs
    PERFORM log_system_event(
      'WARN',
      'SECURITY',
      CASE WHEN NEW.suspended THEN 'Business suspended' ELSE 'Business unsuspended' END,
      jsonb_build_object(
        'business_id', NEW.id,
        'business_name', NEW.name,
        'suspended', NEW.suspended,
        'reason', NEW.suspension_reason,
        'admin_id', NEW.suspended_by
      ),
      COALESCE(NEW.suspended_by, auth.uid()),
      null,
      null,
      null,
      null,
      null
    );
  END IF;

  -- Audit soft delete changes
  IF (OLD.soft_deleted IS DISTINCT FROM NEW.soft_deleted) THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      COALESCE(NEW.deleted_by, auth.uid()),
      CASE WHEN NEW.soft_deleted THEN 'soft_delete_business' ELSE 'restore_business' END,
      'business',
      NEW.id,
      jsonb_build_object(
        'soft_deleted', NEW.soft_deleted,
        'reason', NEW.deletion_reason,
        'deleted_at', NEW.deleted_at
      )
    );

    -- Log to system logs
    PERFORM log_system_event(
      'WARN',
      'SECURITY',
      CASE WHEN NEW.soft_deleted THEN 'Business soft deleted' ELSE 'Business restored' END,
      jsonb_build_object(
        'business_id', NEW.id,
        'business_name', NEW.name,
        'soft_deleted', NEW.soft_deleted,
        'reason', NEW.deletion_reason,
        'admin_id', NEW.deleted_by
      ),
      COALESCE(NEW.deleted_by, auth.uid()),
      null,
      null,
      null,
      null,
      null
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: audit_duplicate_review
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
$$ LANGUAGE plpgsql;

-- Function: audit_email_receipt_changes
CREATE OR REPLACE FUNCTION audit_email_receipt_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.source = 'email' THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      business_id,
      changes
    ) VALUES (
      COALESCE(NEW.uploaded_by, NEW.created_by),
      'create',
      'receipt',
      NEW.id,
      NEW.business_id,
      jsonb_build_object(
        'source', 'email',
        'email_from', NEW.email_metadata->>'sender',
        'email_subject', NEW.email_metadata->>'subject',
        'email_message_id', NEW.email_message_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: audit_receipt_soft_delete
CREATE OR REPLACE FUNCTION audit_receipt_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is a soft delete operation
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      auth.uid(),
      'soft_delete',
      'receipts',
      NEW.id,
      jsonb_build_object(
        'deleted_at', NEW.deleted_at,
        'deleted_by', NEW.deleted_by,
        'vendor_name', NEW.vendor_name,
        'total_amount', NEW.total_amount,
        'transaction_date', NEW.transaction_date,
        'collection_id', NEW.collection_id
      )
    );
  END IF;

  -- Check if this is a restore operation
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      auth.uid(),
      'restore',
      'receipts',
      NEW.id,
      jsonb_build_object(
        'vendor_name', NEW.vendor_name,
        'total_amount', NEW.total_amount,
        'transaction_date', NEW.transaction_date,
        'collection_id', NEW.collection_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: audit_system_config_changes
CREATE OR REPLACE FUNCTION audit_system_config_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  changed_fields jsonb := '{}'::jsonb;
BEGIN
  -- Track which sections changed
  IF OLD.storage_settings IS DISTINCT FROM NEW.storage_settings THEN
    changed_fields := changed_fields || jsonb_build_object('storage_settings', jsonb_build_object('old', OLD.storage_settings, 'new', NEW.storage_settings));
  END IF;

  IF OLD.email_settings IS DISTINCT FROM NEW.email_settings THEN
    changed_fields := changed_fields || jsonb_build_object('email_settings', jsonb_build_object('old', OLD.email_settings, 'new', NEW.email_settings));
  END IF;

  IF OLD.app_settings IS DISTINCT FROM NEW.app_settings THEN
    changed_fields := changed_fields || jsonb_build_object('app_settings', jsonb_build_object('old', OLD.app_settings, 'new', NEW.app_settings));
  END IF;

  IF OLD.feature_flags IS DISTINCT FROM NEW.feature_flags THEN
    changed_fields := changed_fields || jsonb_build_object('feature_flags', jsonb_build_object('old', OLD.feature_flags, 'new', NEW.feature_flags));
  END IF;

  -- Only log if something changed
  IF changed_fields <> '{}'::jsonb THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      changes,
      ip_address,
      user_agent
    ) VALUES (
      auth.uid(),
      'UPDATE',
      'system_config',
      NEW.id::text,
      changed_fields,
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'user-agent'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: calculate_business_storage
CREATE OR REPLACE FUNCTION calculate_business_storage(business_id_param uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_bytes bigint;
  receipt_paths text[];
BEGIN
  -- Get all file paths for receipts in this business
  SELECT ARRAY_AGG(DISTINCT unnested_path)
  INTO receipt_paths
  FROM (
    SELECT 
      CASE 
        WHEN r.file_path LIKE 'receipts/%' THEN r.file_path
        ELSE 'receipts/' || r.file_path
      END as unnested_path
    FROM receipts r
    INNER JOIN collections c ON r.collection_id = c.id
    WHERE c.business_id = business_id_param
      AND r.file_path IS NOT NULL
    UNION ALL
    SELECT 
      CASE 
        WHEN r.thumbnail_path LIKE 'receipts/%' THEN r.thumbnail_path
        ELSE 'receipts/' || r.thumbnail_path
      END as unnested_path
    FROM receipts r
    INNER JOIN collections c ON r.collection_id = c.id
    WHERE c.business_id = business_id_param
      AND r.thumbnail_path IS NOT NULL
  ) AS paths;

  -- Calculate total storage from storage.objects
  -- If no objects found, check if receipts exist but files aren't in storage yet
  IF receipt_paths IS NULL OR array_length(receipt_paths, 1) = 0 THEN
    total_bytes := 0;
  ELSE
    SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
    INTO total_bytes
    FROM storage.objects
    WHERE bucket_id = 'receipts'
      AND name = ANY(receipt_paths);
    
    -- If storage query returns 0 but we have paths, it might be a path mismatch
    -- Fall back to counting receipt records as estimate (assume avg 500KB per receipt)
    IF total_bytes = 0 THEN
      SELECT COALESCE(COUNT(*) * 524288, 0)  -- 512 KB average per receipt
      INTO total_bytes
      FROM receipts r
      INNER JOIN collections c ON r.collection_id = c.id
      WHERE c.business_id = business_id_param
        AND r.file_path IS NOT NULL;
    END IF;
  END IF;

  -- Update the business record
  UPDATE businesses
  SET 
    storage_used_bytes = total_bytes,
    last_storage_check = now()
  WHERE id = business_id_param;

  -- Log the calculation
  PERFORM log_system_event(
    'INFO',
    'PERFORMANCE',
    'Calculated business storage usage',
    jsonb_build_object(
      'business_id', business_id_param,
      'storage_bytes', total_bytes,
      'storage_mb', ROUND(total_bytes / 1048576.0, 2),
      'file_count', COALESCE(array_length(receipt_paths, 1), 0)
    ),
    null,
    null,
    null,
    null,
    null,
    null
  );

  RETURN total_bytes;
END;
$$ LANGUAGE plpgsql;

-- Function: calculate_dashboard_analytics
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
$$ LANGUAGE plpgsql;

-- Function: check_account_lockout
CREATE OR REPLACE FUNCTION check_account_lockout(
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lockout_record RECORD;
BEGIN
  -- Find active lockout
  SELECT *
  INTO v_lockout_record
  FROM account_lockouts
  WHERE email = p_email
    AND is_active = true
    AND locked_until > now()
  ORDER BY locked_at DESC
  LIMIT 1;

  -- If no active lockout found
  IF v_lockout_record IS NULL THEN
    RETURN jsonb_build_object(
      'locked', false
    );
  END IF;

  -- Return lockout info
  RETURN jsonb_build_object(
    'locked', true,
    'lockedAt', v_lockout_record.locked_at,
    'lockedUntil', v_lockout_record.locked_until,
    'attemptsCount', v_lockout_record.attempts_count,
    'retryAfter', EXTRACT(EPOCH FROM (v_lockout_record.locked_until - now()))::integer
  );
END;
$$ LANGUAGE plpgsql;

-- Function: check_expiring_recovery_codes
CREATE OR REPLACE FUNCTION check_expiring_recovery_codes(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expiring_count int;
  v_earliest_expiry timestamptz;
  v_result jsonb;
BEGIN
  -- Count codes expiring in next 30 days
  SELECT COUNT(*), MIN(expires_at)
  INTO v_expiring_count, v_earliest_expiry
  FROM recovery_codes
  WHERE user_id = p_user_id
    AND used = false
    AND expires_at > now()
    AND expires_at < now() + interval '30 days';

  IF v_expiring_count > 0 THEN
    v_result := jsonb_build_object(
      'has_expiring_codes', true,
      'expiring_count', v_expiring_count,
      'earliest_expiry', v_earliest_expiry,
      'days_until_expiry', EXTRACT(days FROM (v_earliest_expiry - now())),
      'message', format('%s recovery code(s) will expire in %s days',
                       v_expiring_count,
                       EXTRACT(days FROM (v_earliest_expiry - now())))
    );
  ELSE
    v_result := jsonb_build_object(
      'has_expiring_codes', false,
      'expiring_count', 0,
      'earliest_expiry', null,
      'days_until_expiry', null,
      'message', 'No codes expiring soon'
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: check_mfa_lockout
CREATE OR REPLACE FUNCTION check_mfa_lockout(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempt_count int;
  v_lockout_until timestamptz;
  v_result jsonb;
BEGIN
  -- Count failed attempts in last hour
  SELECT COUNT(*)
  INTO v_attempt_count
  FROM mfa_failed_attempts
  WHERE user_id = p_user_id
    AND attempted_at > now() - interval '1 hour';

  -- Determine lockout status
  IF v_attempt_count >= 10 THEN
    -- Severe lockout: 1 hour
    SELECT MAX(attempted_at) + interval '1 hour'
    INTO v_lockout_until
    FROM mfa_failed_attempts
    WHERE user_id = p_user_id;

    v_result := jsonb_build_object(
      'is_locked_out', true,
      'attempt_count', v_attempt_count,
      'lockout_until', v_lockout_until,
      'lockout_duration_minutes', 60,
      'message', 'Too many failed attempts. Account locked for 1 hour.'
    );
  ELSIF v_attempt_count >= 5 THEN
    -- Moderate lockout: 15 minutes
    SELECT MAX(attempted_at) + interval '15 minutes'
    INTO v_lockout_until
    FROM mfa_failed_attempts
    WHERE user_id = p_user_id;

    v_result := jsonb_build_object(
      'is_locked_out', true,
      'attempt_count', v_attempt_count,
      'lockout_until', v_lockout_until,
      'lockout_duration_minutes', 15,
      'message', 'Too many failed attempts. Please wait 15 minutes.'
    );
  ELSIF v_attempt_count >= 3 THEN
    -- Mild lockout: 5 minutes
    SELECT MAX(attempted_at) + interval '5 minutes'
    INTO v_lockout_until
    FROM mfa_failed_attempts
    WHERE user_id = p_user_id;

    v_result := jsonb_build_object(
      'is_locked_out', true,
      'attempt_count', v_attempt_count,
      'lockout_until', v_lockout_until,
      'lockout_duration_minutes', 5,
      'message', 'Too many failed attempts. Please wait 5 minutes.'
    );
  ELSE
    -- Not locked out
    v_result := jsonb_build_object(
      'is_locked_out', false,
      'attempt_count', v_attempt_count,
      'lockout_until', null,
      'lockout_duration_minutes', 0,
      'message', 'Not locked out'
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: check_rate_limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier text,
  p_action_type text,
  p_max_attempts integer DEFAULT 5,
  p_window_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_attempts integer;
  v_window_end timestamptz;
  v_is_blocked boolean;
  v_block_expires_at timestamptz;
  v_remaining integer;
  v_reset_at timestamptz;
BEGIN
  -- Check if identifier is currently blocked
  SELECT is_blocked, block_expires_at
  INTO v_is_blocked, v_block_expires_at
  FROM rate_limit_attempts
  WHERE identifier = p_identifier
    AND action_type = p_action_type
    AND is_blocked = true
    AND block_expires_at > now()
  ORDER BY block_expires_at DESC
  LIMIT 1;

  -- If blocked and block hasn't expired
  IF v_is_blocked AND v_block_expires_at > now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked', true,
      'retryAfter', EXTRACT(EPOCH FROM (v_block_expires_at - now()))::integer,
      'resetAt', v_block_expires_at
    );
  END IF;

  -- Get or create rate limit entry for current window
  SELECT attempts, window_end
  INTO v_current_attempts, v_window_end
  FROM rate_limit_attempts
  WHERE identifier = p_identifier
    AND action_type = p_action_type
    AND window_end > now()
    AND is_blocked = false
  ORDER BY window_end DESC
  LIMIT 1;

  -- Create new window if none exists or expired
  IF v_current_attempts IS NULL THEN
    v_current_attempts := 0;
    v_window_end := now() + (p_window_minutes || ' minutes')::interval;

    INSERT INTO rate_limit_attempts (
      identifier,
      action_type,
      attempts,
      window_start,
      window_end,
      is_blocked
    ) VALUES (
      p_identifier,
      p_action_type,
      0,
      now(),
      v_window_end,
      false
    );
  END IF;

  -- Increment attempt counter
  v_current_attempts := v_current_attempts + 1;

  UPDATE rate_limit_attempts
  SET
    attempts = v_current_attempts,
    updated_at = now()
  WHERE identifier = p_identifier
    AND action_type = p_action_type
    AND window_end = v_window_end;

  -- Check if limit exceeded
  IF v_current_attempts > p_max_attempts THEN
    -- Block for 2x the window time
    v_block_expires_at := now() + (p_window_minutes * 2 || ' minutes')::interval;

    UPDATE rate_limit_attempts
    SET
      is_blocked = true,
      block_expires_at = v_block_expires_at,
      updated_at = now()
    WHERE identifier = p_identifier
      AND action_type = p_action_type
      AND window_end = v_window_end;

    RETURN jsonb_build_object(
      'allowed', false,
      'blocked', true,
      'retryAfter', EXTRACT(EPOCH FROM (v_block_expires_at - now()))::integer,
      'resetAt', v_block_expires_at
    );
  END IF;

  -- Return success with remaining attempts
  v_remaining := p_max_attempts - v_current_attempts;
  v_reset_at := v_window_end;

  RETURN jsonb_build_object(
    'allowed', true,
    'blocked', false,
    'remaining', v_remaining,
    'limit', p_max_attempts,
    'resetAt', v_reset_at
  );
END;
$$ LANGUAGE plpgsql;

-- Function: check_storage_limit
CREATE OR REPLACE FUNCTION check_storage_limit(business_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business record;
  v_usage_percent numeric;
  v_result jsonb;
BEGIN
  SELECT 
    storage_used_bytes,
    storage_limit_bytes
  INTO v_business
  FROM businesses
  WHERE id = business_id_param;

  IF v_business.storage_limit_bytes > 0 THEN
    v_usage_percent := (v_business.storage_used_bytes::numeric / v_business.storage_limit_bytes::numeric) * 100;
  ELSE
    v_usage_percent := 0;
  END IF;

  v_result := jsonb_build_object(
    'used_bytes', v_business.storage_used_bytes,
    'limit_bytes', v_business.storage_limit_bytes,
    'used_mb', ROUND(v_business.storage_used_bytes / 1048576.0, 2),
    'limit_mb', ROUND(v_business.storage_limit_bytes / 1048576.0, 2),
    'usage_percent', ROUND(v_usage_percent, 2),
    'is_warning', v_usage_percent >= 80,
    'is_critical', v_usage_percent >= 95
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: check_user_exists
CREATE OR REPLACE FUNCTION check_user_exists(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE email = user_email
  );
END;
$$ LANGUAGE plpgsql;

-- Function: check_user_mfa_status
CREATE OR REPLACE FUNCTION check_user_mfa_status(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  has_verified_factors boolean;
BEGIN
  -- Only allow users to check their own MFA status
  IF auth.uid() != check_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Can only check your own MFA status';
  END IF;

  -- Check if user has any verified MFA factors
  SELECT EXISTS (
    SELECT 1
    FROM auth.mfa_factors
    WHERE user_id = check_user_id
    AND status = 'verified'
  ) INTO has_verified_factors;

  RETURN COALESCE(has_verified_factors, false);
END;
$$ LANGUAGE plpgsql;

-- Function: cleanup_expired_exports
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_job RECORD;
  deleted_count integer := 0;
BEGIN
  -- Find and delete expired export files
  FOR expired_job IN
    SELECT id, file_path
    FROM export_jobs
    WHERE expires_at < now()
      AND status = 'completed'
      AND file_path IS NOT NULL
  LOOP
    -- Mark as cleaned (storage deletion happens elsewhere)
    UPDATE export_jobs
    SET 
      file_path = NULL,
      metadata = metadata || jsonb_build_object('cleaned_up_at', now())
    WHERE id = expired_job.id;
    
    deleted_count := deleted_count + 1;
  END LOOP;

  -- Log cleanup
  PERFORM log_system_event(
    'INFO',
    'MAINTENANCE',
    'Cleaned up expired export jobs',
    jsonb_build_object('deleted_count', deleted_count),
    null, null, null, null, null, null
  );
END;
$$ LANGUAGE plpgsql;

-- Function: cleanup_expired_recovery_codes
CREATE OR REPLACE FUNCTION cleanup_expired_recovery_codes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count int;
  v_result jsonb;
BEGIN
  WITH deleted AS (
    DELETE FROM recovery_codes
    WHERE expires_at < now()
    RETURNING *
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  v_result := jsonb_build_object(
    'deleted_count', v_deleted_count,
    'cleanup_time', now(),
    'message', format('Deleted %s expired recovery code(s)', v_deleted_count)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: cleanup_expired_signed_urls
CREATE OR REPLACE FUNCTION cleanup_expired_signed_urls()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Delete expired URLs older than 7 days
  DELETE FROM signed_url_requests
  WHERE expires_at < now() - interval '7 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Log cleanup
  PERFORM log_system_event(
    'INFO',
    'DATABASE',
    'Cleaned up expired signed URLs',
    jsonb_build_object('deleted_count', v_deleted_count),
    NULL, NULL, NULL, NULL, NULL, NULL
  );

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: cleanup_old_mfa_attempts
CREATE OR REPLACE FUNCTION cleanup_old_mfa_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM mfa_failed_attempts
  WHERE attempted_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Function: cleanup_old_rate_limits
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Delete expired rate limit attempts (older than 7 days)
  DELETE FROM rate_limit_attempts
  WHERE window_end < (now() - interval '7 days')
    OR (is_blocked = true AND block_expires_at < (now() - interval '7 days'));

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Delete old failed login attempts (older than 30 days)
  DELETE FROM failed_login_attempts
  WHERE attempt_time < (now() - interval '30 days');

  -- Deactivate expired lockouts
  UPDATE account_lockouts
  SET is_active = false
  WHERE is_active = true
    AND locked_until < now();

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: clear_mfa_failed_attempts
CREATE OR REPLACE FUNCTION clear_mfa_failed_attempts(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM mfa_failed_attempts
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function: delete_receipt_file
CREATE OR REPLACE FUNCTION delete_receipt_file()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the file from storage if file_path exists
  IF OLD.file_path IS NOT NULL THEN
    -- Use Supabase storage API to delete the file
    -- The file path is stored in the format: user_id/filename
    PERFORM storage.delete_object('receipts', OLD.file_path);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Function: delete_storage_object
CREATE OR REPLACE FUNCTION delete_storage_object(
  bucket_name text,
  object_path text
)
RETURNS void
SECURITY DEFINER
SET search_path = storage, public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete the storage object record
  DELETE FROM storage.objects
  WHERE bucket_id = bucket_name
  AND name = object_path;
END;
$$ LANGUAGE plpgsql;

-- Function: detect_duplicate_receipts
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
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND admin = true
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
$$ LANGUAGE plpgsql;

-- Function: detect_login_anomaly
CREATE OR REPLACE FUNCTION detect_login_anomaly(
  p_user_id uuid,
  p_ip_address inet,
  p_user_agent text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pattern record;
  v_current_hour integer;
  v_current_day integer;
  v_is_anomaly boolean := false;
  v_anomaly_reasons text[] := ARRAY[]::text[];
BEGIN
  v_current_hour := EXTRACT(HOUR FROM now());
  v_current_day := EXTRACT(DOW FROM now());

  -- Get user's typical pattern
  SELECT * INTO v_pattern
  FROM user_activity_patterns
  WHERE user_id = p_user_id
  AND pattern_type = 'login';

  -- If no pattern exists yet, this is a new user - not an anomaly
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check time of day
  IF v_pattern.typical_time_of_day IS NOT NULL
    AND NOT (v_current_hour = ANY(v_pattern.typical_time_of_day)) THEN
    v_is_anomaly := true;
    v_anomaly_reasons := array_append(v_anomaly_reasons, 'Unusual time of day');
  END IF;

  -- Check day of week
  IF v_pattern.typical_days_of_week IS NOT NULL
    AND NOT (v_current_day = ANY(v_pattern.typical_days_of_week)) THEN
    v_is_anomaly := true;
    v_anomaly_reasons := array_append(v_anomaly_reasons, 'Unusual day of week');
  END IF;

  -- Check location (IP address)
  IF v_pattern.typical_locations IS NOT NULL
    AND NOT (p_ip_address = ANY(v_pattern.typical_locations)) THEN
    v_is_anomaly := true;
    v_anomaly_reasons := array_append(v_anomaly_reasons, 'New location detected');
  END IF;

  -- If anomaly detected, log it
  IF v_is_anomaly THEN
    INSERT INTO detected_anomalies (
      user_id,
      anomaly_type,
      severity,
      description,
      ip_address,
      user_agent,
      metadata
    ) VALUES (
      p_user_id,
      'unusual_login',
      CASE
        WHEN array_length(v_anomaly_reasons, 1) >= 2 THEN 'high'
        ELSE 'medium'
      END,
      'Unusual login pattern detected: ' || array_to_string(v_anomaly_reasons, ', '),
      p_ip_address,
      p_user_agent,
      jsonb_build_object(
        'reasons', v_anomaly_reasons,
        'hour', v_current_hour,
        'day', v_current_day
      )
    );

    -- Also log as security event
    PERFORM log_security_event(
      'unusual_login_pattern',
      CASE
        WHEN array_length(v_anomaly_reasons, 1) >= 2 THEN 'high'
        ELSE 'medium'
      END,
      p_user_id,
      host(p_ip_address),
      p_user_agent,
      jsonb_build_object('reasons', v_anomaly_reasons)
    );
  END IF;

  RETURN v_is_anomaly;
END;
$$ LANGUAGE plpgsql;

-- Function: ensure_single_default_audit_filter
CREATE OR REPLACE FUNCTION ensure_single_default_audit_filter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE saved_audit_filters
    SET is_default = false
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: ensure_single_default_filter
CREATE OR REPLACE FUNCTION ensure_single_default_filter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset any existing default filters for this user
    UPDATE saved_filters 
    SET is_default = false 
    WHERE user_id = NEW.user_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: ensure_single_default_system_filter
CREATE OR REPLACE FUNCTION ensure_single_default_system_filter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE saved_system_filters
    SET is_default = false
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: execute_admin_query
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
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND admin = true
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
$$ LANGUAGE plpgsql;

-- Function: generate_tracked_signed_url
CREATE OR REPLACE FUNCTION generate_tracked_signed_url(
  p_file_path text,
  p_expires_in_seconds integer DEFAULT 3600
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expires_at timestamptz;
  v_request_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  v_expires_at := now() + (p_expires_in_seconds || ' seconds')::interval;

  -- Verify user has access to file
  -- Check if file is in a collection the user has access to
  IF NOT EXISTS (
    SELECT 1
    FROM receipts r
    JOIN collections c ON c.id = r.collection_id
    JOIN business_members bm ON bm.business_id = c.business_id
    WHERE r.file_path = p_file_path
    AND bm.user_id = v_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM system_roles
    WHERE user_id = v_user_id AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'error', 'Access denied to file',
      'success', false
    );
  END IF;

  -- Create tracking record
  INSERT INTO signed_url_requests (
    file_path,
    user_id,
    expires_at,
    ip_address
  ) VALUES (
    p_file_path,
    v_user_id,
    v_expires_at,
    inet_client_addr()
  )
  RETURNING id INTO v_request_id;

  -- Note: Actual signed URL generation happens in application layer
  -- This function just tracks the request
  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'expires_at', v_expires_at,
    'expires_in', p_expires_in_seconds
  );
END;
$$ LANGUAGE plpgsql;

-- Function: get_audit_stats
CREATE OR REPLACE FUNCTION get_audit_stats(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_logs bigint,
  success_count bigint,
  failure_count bigint,
  denied_count bigint,
  unique_users bigint,
  unique_actions bigint,
  avg_execution_time_ms numeric,
  top_actions json
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_logs,
    COUNT(*) FILTER (WHERE status = 'success') as success_count,
    COUNT(*) FILTER (WHERE status = 'failure') as failure_count,
    COUNT(*) FILTER (WHERE status = 'denied') as denied_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT action) as unique_actions,
    AVG(execution_time_ms) as avg_execution_time_ms,
    (
      SELECT json_agg(action_stats)
      FROM (
        SELECT action, COUNT(*) as count
        FROM audit_logs
        WHERE (p_start_date IS NULL OR created_at >= p_start_date)
          AND (p_end_date IS NULL OR created_at <= p_end_date)
        GROUP BY action
        ORDER BY count DESC
        LIMIT 10
      ) action_stats
    ) as top_actions
  FROM audit_logs
  WHERE (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);
END;
$$ LANGUAGE plpgsql;

-- Function: get_parent_receipt
CREATE OR REPLACE FUNCTION get_parent_receipt(receipt_uuid uuid)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  parent_id uuid;
BEGIN
  SELECT parent_receipt_id INTO parent_id
  FROM receipts
  WHERE id = receipt_uuid;

  -- If this is a child, return parent. Otherwise return itself.
  IF parent_id IS NOT NULL THEN
    RETURN parent_id;
  ELSE
    RETURN receipt_uuid;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: get_receipt_pages
CREATE OR REPLACE FUNCTION get_receipt_pages(receipt_uuid uuid)
RETURNS TABLE (
  id uuid,
  page_number integer,
  file_path text,
  thumbnail_path text,
  extraction_data jsonb,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if this is a parent receipt
  IF EXISTS (SELECT 1 FROM receipts WHERE receipts.id = receipt_uuid AND is_parent = true) THEN
    -- Return all child pages, ordered by page_number
    RETURN QUERY
    SELECT
      r.id,
      r.page_number,
      r.file_path,
      r.thumbnail_path,
      r.extraction_data,
      r.created_at
    FROM receipts r
    WHERE r.parent_receipt_id = receipt_uuid
    ORDER BY r.page_number;
  ELSE
    -- Return just this receipt (single page or child page)
    RETURN QUERY
    SELECT
      r.id,
      r.page_number,
      r.file_path,
      r.thumbnail_path,
      r.extraction_data,
      r.created_at
    FROM receipts r
    WHERE r.id = receipt_uuid;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: get_system_config
CREATE OR REPLACE FUNCTION get_system_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config_row system_config%ROWTYPE;
  result jsonb;
BEGIN
  -- Get the configuration (there should only be one row)
  SELECT * INTO config_row FROM system_config LIMIT 1;

  -- If no config exists, create default
  IF NOT FOUND THEN
    INSERT INTO system_config DEFAULT VALUES RETURNING * INTO config_row;
  END IF;

  -- Build result JSON
  result := jsonb_build_object(
    'storage_settings', config_row.storage_settings,
    'email_settings', config_row.email_settings,
    'app_settings', config_row.app_settings,
    'feature_flags', config_row.feature_flags,
    'updated_at', config_row.updated_at,
    'updated_by', config_row.updated_by
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function: get_system_health_snapshot
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
    SELECT 1 FROM system_roles WHERE user_id = auth.uid() AND admin = true
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
$$ LANGUAGE plpgsql;

-- Function: get_user_email
CREATE OR REPLACE FUNCTION get_user_email(user_id uuid)
RETURNS text AS $$
DECLARE
  user_email text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = user_id;
  RETURN user_email;
END;
$$ LANGUAGE plpgsql;

-- Function: handle_receipt_deletion
CREATE OR REPLACE FUNCTION handle_receipt_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Just return OLD to allow the deletion to proceed
  -- Storage cleanup will be handled by the application
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Function: initialize_dashboard_analytics
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
$$ LANGUAGE plpgsql;

-- Function: is_ip_blocked
CREATE OR REPLACE FUNCTION is_ip_blocked(p_ip_address inet)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_ips
    WHERE ip_address = p_ip_address
    AND (blocked_until IS NULL OR blocked_until > now())
  );
END;
$$ LANGUAGE plpgsql;

-- Function: is_system_admin
CREATE OR REPLACE FUNCTION is_system_admin(user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM system_roles
    WHERE system_roles.user_id = $1
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is technical support
CREATE OR REPLACE FUNCTION is_technical_support(user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM system_roles
    WHERE system_roles.user_id = $1
    AND role IN ('admin', 'technical_support')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get user's role in a business
CREATE OR REPLACE FUNCTION get_business_role(user_id uuid, business_id uuid)
RETURNS business_role_type AS $$
  SELECT role FROM business_members
  WHERE business_members.user_id = $1
  AND business_members.business_id = $2
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is business owner
CREATE OR REPLACE FUNCTION is_business_owner(user_id uuid, business_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_members
    WHERE business_members.user_id = $1
    AND business_members.business_id = $2
    AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is business owner or manager
CREATE OR REPLACE FUNCTION is_business_owner_or_manager(user_id uuid, business_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_members
    WHERE business_members.user_id = $1
    AND business_members.business_id = $2
    AND role IN ('owner', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is a member of a business
CREATE OR REPLACE FUNCTION is_business_member(user_id uuid, business_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_members
    WHERE business_members.user_id = $1
    AND business_members.business_id = $2
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- 8. RLS POLICIES - SYSTEM_ROLES
-- ============================================================================

DROP POLICY IF EXISTS "System admins can view all system roles" ON system_roles;
CREATE POLICY "System admins can view all system roles"
  ON system_roles FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "System admins can insert system roles" ON system_roles;
CREATE POLICY "System admins can insert system roles"
  ON system_roles FOR INSERT
  TO authenticated
  WITH CHECK (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "System admins can delete system roles" ON system_roles;
CREATE POLICY "System admins can delete system roles"
  ON system_roles FOR DELETE
  TO authenticated
  USING (is_system_admin(auth.uid()));

-- ============================================================================
-- 9. RLS POLICIES - BUSINESS_MEMBERS
-- ============================================================================

DROP POLICY IF EXISTS "System admins can view all business members" ON business_members;
CREATE POLICY "System admins can view all business members"
  ON business_members FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Business members can view their own memberships" ON business_members;
CREATE POLICY "Business members can view their own memberships"
  ON business_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_business_member(auth.uid(), business_id)
  );

DROP POLICY IF EXISTS "Business owners can insert members" ON business_members;
CREATE POLICY "Business owners can insert members"
  ON business_members FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), business_id)
  );

DROP POLICY IF EXISTS "Business owners can update member roles" ON business_members;
CREATE POLICY "Business owners can update member roles"
  ON business_members FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), business_id)
  );

DROP POLICY IF EXISTS "Business owners can remove members" ON business_members;
CREATE POLICY "Business owners can remove members"
  ON business_members FOR DELETE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), business_id)
  );

-- ============================================================================
-- 10. RLS POLICIES - INVITATIONS
-- ============================================================================

DROP POLICY IF EXISTS "System admins can view all invitations" ON invitations;
CREATE POLICY "System admins can view all invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Business owners can view their business invitations" ON invitations;
CREATE POLICY "Business owners can view their business invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (is_business_owner_or_manager(auth.uid(), business_id));

DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON invitations;
CREATE POLICY "Users can view invitations sent to their email"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Business owners can create invitations" ON invitations;
CREATE POLICY "Business owners can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), business_id)
  );

DROP POLICY IF EXISTS "Business owners can update invitations" ON invitations;
CREATE POLICY "Business owners can update invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), business_id)
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Business owners can delete invitations" ON invitations;
CREATE POLICY "Business owners can delete invitations"
  ON invitations FOR DELETE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), business_id)
  );

-- ============================================================================
-- 11. RLS POLICIES - RECEIPT_APPROVALS
-- ============================================================================

DROP POLICY IF EXISTS "System admins can view all receipt approvals" ON receipt_approvals;
CREATE POLICY "System admins can view all receipt approvals"
  ON receipt_approvals FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Business members can view approvals in their business" ON receipt_approvals;
CREATE POLICY "Business members can view approvals in their business"
  ON receipt_approvals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM receipts r
      JOIN collections c ON r.collection_id = c.id
      WHERE r.id = receipt_approvals.receipt_id
      AND is_business_member(auth.uid(), c.business_id)
    )
  );

DROP POLICY IF EXISTS "Members can create approval requests" ON receipt_approvals;
CREATE POLICY "Members can create approval requests"
  ON receipt_approvals FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system_admin(auth.uid())
    OR submitted_by = auth.uid()
  );

DROP POLICY IF EXISTS "Owners and managers can update approvals" ON receipt_approvals;
CREATE POLICY "Owners and managers can update approvals"
  ON receipt_approvals FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM receipts r
      JOIN collections c ON r.collection_id = c.id
      WHERE r.id = receipt_approvals.receipt_id
      AND is_business_owner_or_manager(auth.uid(), c.business_id)
    )
  );

-- ============================================================================
-- 12. UPDATE EXISTING RLS POLICIES FOR BUSINESSES
-- ============================================================================

-- Drop old business policies
DROP POLICY IF EXISTS "Users can view own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can create own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can update own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can delete own businesses" ON businesses;

-- New business policies considering business_members
DROP POLICY IF EXISTS "System admins can view all businesses" ON businesses;
CREATE POLICY "System admins can view all businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Business members can view their businesses" ON businesses;
CREATE POLICY "Business members can view their businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (is_business_member(auth.uid(), id));

DROP POLICY IF EXISTS "Users can create businesses" ON businesses;
CREATE POLICY "Users can create businesses"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Business owners can update their businesses" ON businesses;
CREATE POLICY "Business owners can update their businesses"
  ON businesses FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), id)
  );

DROP POLICY IF EXISTS "Business owners can delete their businesses" ON businesses;
CREATE POLICY "Business owners can delete their businesses"
  ON businesses FOR DELETE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR is_business_owner(auth.uid(), id)
  );

-- ============================================================================
-- 13. UPDATE EXISTING RLS POLICIES FOR RECEIPTS
-- ============================================================================

-- Drop old receipt policies
DROP POLICY IF EXISTS "Users can view own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can create own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can update own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can delete own receipts" ON receipts;

-- New receipt policies considering business_members and roles
DROP POLICY IF EXISTS "System admins can view all receipts" ON receipts;
CREATE POLICY "System admins can view all receipts"
  ON receipts FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Business members can view receipts in their business" ON receipts;
CREATE POLICY "Business members can view receipts in their business"
  ON receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = receipts.collection_id
      AND is_business_member(auth.uid(), c.business_id)
    )
  );

DROP POLICY IF EXISTS "Business members can create receipts" ON receipts;
CREATE POLICY "Business members can create receipts"
  ON receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = receipts.collection_id
      AND is_business_member(auth.uid(), c.business_id)
    )
  );

DROP POLICY IF EXISTS "Owners and managers can update any receipt" ON receipts;
CREATE POLICY "Owners and managers can update any receipt"
  ON receipts FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = receipts.collection_id
      AND is_business_owner_or_manager(auth.uid(), c.business_id)
    )
  );

DROP POLICY IF EXISTS "Only owners can delete receipts" ON receipts;
CREATE POLICY "Only owners can delete receipts"
  ON receipts FOR DELETE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = receipts.collection_id
      AND is_business_owner(auth.uid(), c.business_id)
    )
  );

-- ============================================================================
-- 14. UPDATE EXISTING RLS POLICIES FOR OTHER TABLES
-- ============================================================================

-- Collections policies
DROP POLICY IF EXISTS "Users can view own collections" ON collections;
DROP POLICY IF EXISTS "System admins can view all collections" ON collections;
CREATE POLICY "System admins can view all collections"
  ON collections FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Business members can view collections in their business" ON collections;
CREATE POLICY "Business members can view collections in their business"
  ON collections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = collections.business_id
      AND is_business_member(auth.uid(), b.id)
    )
  );

DROP POLICY IF EXISTS "Users can create own collections" ON collections;
DROP POLICY IF EXISTS "Business members can create collections" ON collections;
CREATE POLICY "Business members can create collections"
  ON collections FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = collections.business_id
      AND is_business_member(auth.uid(), b.id)
    )
  );

DROP POLICY IF EXISTS "Users can update own collections" ON collections;
DROP POLICY IF EXISTS "Owners and managers can update collections" ON collections;
CREATE POLICY "Owners and managers can update collections"
  ON collections FOR UPDATE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = collections.business_id
      AND is_business_owner_or_manager(auth.uid(), b.id)
    )
  );

DROP POLICY IF EXISTS "Users can delete own collections" ON collections;
DROP POLICY IF EXISTS "Only owners can delete collections" ON collections;
CREATE POLICY "Only owners can delete collections"
  ON collections FOR DELETE
  TO authenticated
  USING (
    is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = collections.business_id
      AND is_business_owner(auth.uid(), b.id)
    )
  );
-- ============================================================================
-- 15. CREATE TRIGGERS FOR AUTOMATIC BUSINESS MEMBERSHIP
-- ============================================================================

-- Automatically create business_member entry when a business is created
CREATE OR REPLACE FUNCTION create_business_owner_membership()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO business_members (business_id, user_id, role, joined_at)
  VALUES (NEW.id, NEW.owner_id, 'owner'::business_role_type, NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: log_audit_event
CREATE OR REPLACE FUNCTION log_audit_event(
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_snapshot_before jsonb DEFAULT NULL,
  p_snapshot_after jsonb DEFAULT NULL,
  p_status text DEFAULT 'success',
  p_error_message text DEFAULT NULL,
  p_execution_time_ms integer DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
  v_actor_role text;
  v_business_id uuid;
BEGIN
  -- Try to get actor's role from business_members
  SELECT bm.role::text, bm.business_id INTO v_actor_role, v_business_id
  FROM business_members bm
  WHERE bm.user_id = auth.uid()
  ORDER BY bm.joined_at DESC
  LIMIT 1;

  -- If no business role, check system role
  IF v_actor_role IS NULL THEN
    SELECT sr.role::text INTO v_actor_role
    FROM system_roles sr
    WHERE sr.user_id = auth.uid()
    LIMIT 1;
  END IF;

  -- Insert audit log with all context
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    snapshot_before,
    snapshot_after,
    status,
    error_message,
    actor_role,
    execution_time_ms,
    created_at
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_details || jsonb_build_object(
      'business_id', v_business_id,
      'timestamp', now()::text
    ),
    p_snapshot_before,
    p_snapshot_after,
    p_status,
    p_error_message,
    v_actor_role,
    p_execution_time_ms,
    now()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function: log_auth_event
CREATE OR REPLACE FUNCTION log_auth_event(
  p_event_type text,
  p_user_id uuid,
  p_success boolean,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
BEGIN
  RETURN log_system_event(
    CASE WHEN p_success THEN 'INFO' ELSE 'WARN' END,
    'AUTH',
    format('Authentication event: %s', p_event_type),
    p_metadata || jsonb_build_object('event_type', p_event_type, 'success', p_success),
    p_user_id,
    NULL,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  );
END;
$$ LANGUAGE plpgsql;

-- Function: log_business_action
CREATE OR REPLACE FUNCTION log_business_action()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
      auth.uid(),
      'create_business',
      'business',
      NEW.id,
      jsonb_build_object('name', NEW.name)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
      auth.uid(),
      'update_business',
      'business',
      NEW.id,
      jsonb_build_object('name', NEW.name)
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: log_business_changes_enhanced
CREATE OR REPLACE FUNCTION log_business_changes_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'create_business',
      'business',
      NEW.id,
      jsonb_build_object('name', NEW.name),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'update_business',
      'business',
      NEW.id,
      jsonb_build_object('name', NEW.name),
      to_jsonb(OLD),
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: log_business_changes_with_delete
CREATE OR REPLACE FUNCTION log_business_changes_with_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'create_business',
      'business',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'tax_id', NEW.tax_id),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'update_business',
      'business',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'tax_id', NEW.tax_id),
      to_jsonb(OLD),
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- CRITICAL: Track business deletion
    PERFORM log_audit_event(
      'delete_business',
      'business',
      OLD.id,
      jsonb_build_object(
        'name', OLD.name,
        'owner_id', OLD.owner_id,
        'tax_id', OLD.tax_id,
        'warning', 'Business and all associated data will be deleted'
      ),
      to_jsonb(OLD),
      NULL,
      'success',
      NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: log_business_member_changes
CREATE OR REPLACE FUNCTION log_business_member_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'add_team_member',
      'business_member',
      NEW.id,
      jsonb_build_object(
        'business_id', NEW.business_id,
        'user_id', NEW.user_id,
        'role', NEW.role
      ),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'update_team_member_role',
      'business_member',
      NEW.id,
      jsonb_build_object(
        'business_id', NEW.business_id,
        'user_id', NEW.user_id,
        'old_role', OLD.role,
        'new_role', NEW.role
      ),
      to_jsonb(OLD),
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'remove_team_member',
      'business_member',
      OLD.id,
      jsonb_build_object(
        'business_id', OLD.business_id,
        'user_id', OLD.user_id,
        'role', OLD.role
      ),
      to_jsonb(OLD),
      NULL,
      'success',
      NULL
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: log_collection_action
CREATE OR REPLACE FUNCTION log_collection_action()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
      auth.uid(),
      'create_collection',
      'collection',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'business_id', NEW.business_id)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
      auth.uid(),
      'update_collection',
      'collection',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'business_id', NEW.business_id)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
      auth.uid(),
      'delete_collection',
      'collection',
      OLD.id,
      jsonb_build_object('name', OLD.name, 'business_id', OLD.business_id)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: log_collection_changes_enhanced
CREATE OR REPLACE FUNCTION log_collection_changes_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'create_collection',
      'collection',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'business_id', NEW.business_id),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'update_collection',
      'collection',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'business_id', NEW.business_id),
      to_jsonb(OLD),
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'delete_collection',
      'collection',
      OLD.id,
      jsonb_build_object('name', OLD.name, 'business_id', OLD.business_id),
      to_jsonb(OLD),
      NULL,
      'success',
      NULL
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: log_collection_member_changes
CREATE OR REPLACE FUNCTION log_collection_member_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name text;
  v_user_email text;
BEGIN
  -- Get collection name and user email for better audit trail
  IF TG_OP = 'DELETE' THEN
    SELECT name INTO v_collection_name FROM collections WHERE id = OLD.collection_id;
    SELECT email INTO v_user_email FROM auth.users WHERE id = OLD.user_id;
  ELSE
    SELECT name INTO v_collection_name FROM collections WHERE id = NEW.collection_id;
    SELECT email INTO v_user_email FROM auth.users WHERE id = NEW.user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'add_collection_member',
      'collection_member',
      NEW.id,
      jsonb_build_object(
        'collection_id', NEW.collection_id,
        'collection_name', v_collection_name,
        'user_id', NEW.user_id,
        'user_email', v_user_email,
        'role', NEW.role,
        'invited_by', NEW.invited_by
      ),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Typically only role changes
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      PERFORM log_audit_event(
        'change_collection_member_role',
        'collection_member',
        NEW.id,
        jsonb_build_object(
          'collection_id', NEW.collection_id,
          'collection_name', v_collection_name,
          'user_id', NEW.user_id,
          'user_email', v_user_email,
          'old_role', OLD.role,
          'new_role', NEW.role
        ),
        to_jsonb(OLD),
        to_jsonb(NEW),
        'success',
        NULL
      );
    ELSE
      -- Generic update
      PERFORM log_audit_event(
        'update_collection_member',
        'collection_member',
        NEW.id,
        jsonb_build_object(
          'collection_id', NEW.collection_id,
          'collection_name', v_collection_name,
          'user_id', NEW.user_id,
          'user_email', v_user_email
        ),
        to_jsonb(OLD),
        to_jsonb(NEW),
        'success',
        NULL
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'remove_collection_member',
      'collection_member',
      OLD.id,
      jsonb_build_object(
        'collection_id', OLD.collection_id,
        'collection_name', v_collection_name,
        'user_id', OLD.user_id,
        'user_email', v_user_email,
        'role', OLD.role
      ),
      to_jsonb(OLD),
      NULL,
      'success',
      NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: log_expense_category_changes
CREATE OR REPLACE FUNCTION log_expense_category_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'create_category',
      'expense_category',
      NEW.id,
      jsonb_build_object(
        'name', NEW.name,
        'description', NEW.description
      ),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'update_category',
      'expense_category',
      NEW.id,
      jsonb_build_object(
        'name', NEW.name,
        'description', NEW.description
      ),
      to_jsonb(OLD),
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'delete_category',
      'expense_category',
      OLD.id,
      jsonb_build_object(
        'name', OLD.name,
        'description', OLD.description
      ),
      to_jsonb(OLD),
      NULL,
      'success',
      NULL
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: log_failed_operation
CREATE OR REPLACE FUNCTION log_failed_operation(
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_error_message text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
BEGIN
  RETURN log_audit_event(
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    NULL,
    NULL,
    'failure',
    p_error_message
  );
END;
$$ LANGUAGE plpgsql;

-- Function: log_invitation_changes
CREATE OR REPLACE FUNCTION log_invitation_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'send_invitation',
      'invitation',
      NEW.id,
      jsonb_build_object(
        'business_id', NEW.business_id,
        'email', NEW.email,
        'role', NEW.role
      ),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      PERFORM log_audit_event(
        'update_invitation_status',
        'invitation',
        NEW.id,
        jsonb_build_object(
          'business_id', NEW.business_id,
          'email', NEW.email,
          'old_status', OLD.status,
          'new_status', NEW.status
        ),
        to_jsonb(OLD),
        to_jsonb(NEW),
        'success',
        NULL
      );
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'cancel_invitation',
      'invitation',
      OLD.id,
      jsonb_build_object(
        'business_id', OLD.business_id,
        'email', OLD.email,
        'status', OLD.status
      ),
      to_jsonb(OLD),
      NULL,
      'success',
      NULL
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: log_log_level_config_changes
CREATE OR REPLACE FUNCTION log_log_level_config_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'create_log_config',
      'log_level_config',
      NEW.id,
      jsonb_build_object(
        'category', NEW.category,
        'min_level', NEW.min_level,
        'enabled', NEW.enabled
      ),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'update_log_config',
      'log_level_config',
      NEW.id,
      jsonb_build_object(
        'category', NEW.category,
        'old_min_level', OLD.min_level,
        'new_min_level', NEW.min_level,
        'old_enabled', OLD.enabled,
        'new_enabled', NEW.enabled
      ),
      to_jsonb(OLD),
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'delete_log_config',
      'log_level_config',
      OLD.id,
      jsonb_build_object(
        'category', OLD.category,
        'min_level', OLD.min_level,
        'enabled', OLD.enabled
      ),
      to_jsonb(OLD),
      NULL,
      'success',
      NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: log_performance_event
CREATE OR REPLACE FUNCTION log_performance_event(
  p_operation text,
  p_execution_time_ms integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
BEGIN
  RETURN log_system_event(
    CASE 
      WHEN p_execution_time_ms > 5000 THEN 'WARN'
      WHEN p_execution_time_ms > 10000 THEN 'ERROR'
      ELSE 'INFO'
    END,
    'PERFORMANCE',
    format('Operation %s took %sms', p_operation, p_execution_time_ms),
    p_metadata || jsonb_build_object('operation', p_operation),
    auth.uid(),
    NULL,
    NULL,
    NULL,
    NULL,
    p_execution_time_ms
  );
END;
$$ LANGUAGE plpgsql;

-- Function: log_permission_denied
CREATE OR REPLACE FUNCTION log_permission_denied(
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_reason text
)
RETURNS uuid AS $$
BEGIN
  RETURN log_audit_event(
    p_action,
    p_resource_type,
    p_resource_id,
    jsonb_build_object('denial_reason', p_reason),
    NULL,
    NULL,
    'denied',
    p_reason
  );
END;
$$ LANGUAGE plpgsql;

-- Function: log_profile_changes
CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action text;
  v_details jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create_profile';
    v_details := jsonb_build_object(
      'full_name', NEW.full_name,
      'email', NEW.email,
      'mfa_enabled', NEW.mfa_enabled
    );

    PERFORM log_audit_event(
      v_action,
      'profile',
      NEW.id,
      v_details,
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine specific action type based on what changed
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'delete_user';
      v_details := jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'full_name', NEW.full_name,
        'deleted_by', NEW.deleted_by,
        'deletion_reason', NEW.deletion_reason
      );

    ELSIF OLD.suspended IS DISTINCT FROM NEW.suspended THEN
      IF NEW.suspended THEN
        v_action := 'suspend_user';
        v_details := jsonb_build_object(
          'user_id', NEW.id,
          'email', NEW.email,
          'suspended_by', NEW.suspended_by,
          'suspension_reason', NEW.suspension_reason
        );
      ELSE
        v_action := 'unsuspend_user';
        v_details := jsonb_build_object(
          'user_id', NEW.id,
          'email', NEW.email,
          'unsuspended_by', auth.uid()
        );
      END IF;

    ELSIF OLD.email IS DISTINCT FROM NEW.email THEN
      v_action := 'change_email';
      v_details := jsonb_build_object(
        'user_id', NEW.id,
        'old_email', OLD.email,
        'new_email', NEW.email
      );

    ELSIF OLD.mfa_enabled IS DISTINCT FROM NEW.mfa_enabled THEN
      IF NEW.mfa_enabled THEN
        v_action := 'enable_mfa';
        v_details := jsonb_build_object(
          'user_id', NEW.id,
          'mfa_method', NEW.mfa_method
        );
      ELSE
        v_action := 'disable_mfa';
        v_details := jsonb_build_object(
          'user_id', NEW.id
        );
      END IF;

    ELSIF OLD.mfa_method IS DISTINCT FROM NEW.mfa_method THEN
      v_action := 'change_mfa_method';
      v_details := jsonb_build_object(
        'user_id', NEW.id,
        'old_method', OLD.mfa_method,
        'new_method', NEW.mfa_method
      );

    ELSIF OLD.trusted_devices IS DISTINCT FROM NEW.trusted_devices THEN
      v_action := 'update_trusted_devices';
      v_details := jsonb_build_object(
        'user_id', NEW.id,
        'devices_count', jsonb_array_length(NEW.trusted_devices)
      );

    ELSIF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
      v_action := 'update_profile_name';
      v_details := jsonb_build_object(
        'user_id', NEW.id,
        'old_name', OLD.full_name,
        'new_name', NEW.full_name
      );

    ELSIF OLD.phone_number IS DISTINCT FROM NEW.phone_number THEN
      v_action := 'update_profile_phone';
      v_details := jsonb_build_object(
        'user_id', NEW.id,
        'old_phone', OLD.phone_number,
        'new_phone', NEW.phone_number
      );

    ELSE
      -- Generic profile update for other fields
      v_action := 'update_profile';
      v_details := jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email
      );
    END IF;

    PERFORM log_audit_event(
      v_action,
      'profile',
      NEW.id,
      v_details,
      to_jsonb(OLD),
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Hard delete (rare, should be avoided)
    PERFORM log_audit_event(
      'hard_delete_user',
      'profile',
      OLD.id,
      jsonb_build_object(
        'user_id', OLD.id,
        'email', OLD.email,
        'full_name', OLD.full_name,
        'warning', 'PERMANENT DELETION - Cannot be recovered'
      ),
      to_jsonb(OLD),
      NULL,
      'success',
      NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: log_receipt_approval_changes
CREATE OR REPLACE FUNCTION log_receipt_approval_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'submit_for_approval',
      'receipt_approval',
      NEW.id,
      jsonb_build_object(
        'receipt_id', NEW.receipt_id,
        'status', NEW.status
      ),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      PERFORM log_audit_event(
        CASE NEW.status
          WHEN 'approved' THEN 'approve_receipt'
          WHEN 'rejected' THEN 'reject_receipt'
          ELSE 'update_approval_status'
        END,
        'receipt_approval',
        NEW.id,
        jsonb_build_object(
          'receipt_id', NEW.receipt_id,
          'old_status', OLD.status,
          'new_status', NEW.status,
          'notes', NEW.notes
        ),
        to_jsonb(OLD),
        to_jsonb(NEW),
        'success',
        NULL
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: log_receipt_delete
CREATE OR REPLACE FUNCTION log_receipt_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'delete_receipt',
    'receipt',
    OLD.id,
    jsonb_build_object(
      'vendor_name', OLD.vendor_name,
      'total_amount', OLD.total_amount,
      'collection_id', OLD.collection_id
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Function: log_receipt_delete_enhanced
CREATE OR REPLACE FUNCTION log_receipt_delete_enhanced()
RETURNS TRIGGER AS $$
DECLARE
  v_child_count INTEGER;
BEGIN
  -- Skip audit logging for child receipts (pages)
  -- The parent receipt deletion will capture the complete action
  IF OLD.parent_receipt_id IS NOT NULL THEN
    RETURN OLD;
  END IF;

  -- Count how many child receipts (pages) will be cascade deleted
  SELECT COUNT(*)
  INTO v_child_count
  FROM receipts
  WHERE parent_receipt_id = OLD.id;

  -- Log the deletion with child count information
  PERFORM log_audit_event(
    'delete_receipt',
    'receipt',
    OLD.id,
    jsonb_build_object(
      'vendor_name', OLD.vendor_name,
      'total_amount', OLD.total_amount,
      'collection_id', OLD.collection_id,
      'is_multi_page', CASE WHEN v_child_count > 0 THEN true ELSE false END,
      'page_count', CASE WHEN v_child_count > 0 THEN v_child_count + 1 ELSE 1 END
    ),
    to_jsonb(OLD),
    NULL,
    'success',
    NULL
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Function: log_receipt_insert
CREATE OR REPLACE FUNCTION log_receipt_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'create_receipt',
    'receipt',
    NEW.id,
    jsonb_build_object(
      'vendor_name', NEW.vendor_name,
      'total_amount', NEW.total_amount,
      'collection_id', NEW.collection_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: log_receipt_insert_enhanced
CREATE OR REPLACE FUNCTION log_receipt_insert_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_audit_event(
    'create_receipt',
    'receipt',
    NEW.id,
    jsonb_build_object(
      'vendor_name', NEW.vendor_name,
      'total_amount', NEW.total_amount,
      'collection_id', NEW.collection_id,
      'category', NEW.category
    ),
    NULL, -- no before state
    to_jsonb(NEW), -- full after state
    'success',
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: log_receipt_update
CREATE OR REPLACE FUNCTION log_receipt_update()
RETURNS TRIGGER AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
BEGIN
  IF OLD.vendor_name IS DISTINCT FROM NEW.vendor_name THEN
    changes := changes || jsonb_build_object('vendor_name', jsonb_build_object('old', OLD.vendor_name, 'new', NEW.vendor_name));
  END IF;
  
  IF OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
    changes := changes || jsonb_build_object('total_amount', jsonb_build_object('old', OLD.total_amount, 'new', NEW.total_amount));
  END IF;
  
  IF OLD.category IS DISTINCT FROM NEW.category THEN
    changes := changes || jsonb_build_object('category', jsonb_build_object('old', OLD.category, 'new', NEW.category));
  END IF;
  
  IF OLD.transaction_date IS DISTINCT FROM NEW.transaction_date THEN
    changes := changes || jsonb_build_object('transaction_date', jsonb_build_object('old', OLD.transaction_date, 'new', NEW.transaction_date));
  END IF;

  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'update_receipt',
    'receipt',
    NEW.id,
    jsonb_build_object(
      'changes', changes,
      'collection_id', NEW.collection_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: log_receipt_update_enhanced
CREATE OR REPLACE FUNCTION log_receipt_update_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_audit_event(
    'update_receipt',
    'receipt',
    NEW.id,
    jsonb_build_object('collection_id', NEW.collection_id),
    to_jsonb(OLD), -- full before state
    to_jsonb(NEW), -- full after state
    'success',
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: log_recovery_code_changes
CREATE OR REPLACE FUNCTION log_recovery_code_changes()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_action text;
  v_details jsonb;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'generate_recovery_codes';
    v_details := jsonb_build_object(
      'user_id', NEW.user_id,
      'expires_at', NEW.expires_at
    );

    -- Log to audit_logs
    INSERT INTO audit_logs (action, user_id, resource_type, resource_id, details)
    VALUES (v_action, NEW.user_id, 'recovery_code', NEW.id, v_details);

    -- Log to system_logs
    INSERT INTO system_logs (level, category, message, metadata, user_id)
    VALUES (
      'INFO',
      'SECURITY',
      'Recovery code generated',
      jsonb_build_object('user_id', NEW.user_id, 'code_id', NEW.id),
      NEW.user_id
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log if code was marked as used
    IF OLD.used = false AND NEW.used = true THEN
      v_action := 'recovery_code_used';
      v_details := jsonb_build_object(
        'user_id', NEW.user_id,
        'code_id', NEW.id,
        'used_at', NEW.used_at
      );

      -- Count remaining codes
      DECLARE
        v_remaining_count int;
      BEGIN
        SELECT COUNT(*) INTO v_remaining_count
        FROM recovery_codes
        WHERE user_id = NEW.user_id
          AND used = false
          AND expires_at > now();

        v_details := v_details || jsonb_build_object('remaining_codes', v_remaining_count);
      END;

      -- Log to audit_logs
      INSERT INTO audit_logs (action, user_id, resource_type, resource_id, details)
      VALUES (v_action, NEW.user_id, 'recovery_code', NEW.id, v_details);

      -- Log to system_logs with WARNING level (recovery code usage is notable)
      INSERT INTO system_logs (level, category, message, metadata, user_id)
      VALUES (
        'WARN',
        'SECURITY',
        'User logged in using recovery code',
        v_details,
        NEW.user_id
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete_recovery_code';
    v_details := jsonb_build_object(
      'user_id', OLD.user_id,
      'code_id', OLD.id,
      'was_used', OLD.used
    );

    -- Log to audit_logs
    INSERT INTO audit_logs (action, user_id, resource_type, resource_id, details)
    VALUES (v_action, OLD.user_id, 'recovery_code', OLD.id, v_details);

    -- Log to system_logs
    INSERT INTO system_logs (level, category, message, metadata, user_id)
    VALUES (
      'INFO',
      'SECURITY',
      'Recovery code deleted',
      v_details,
      OLD.user_id
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: log_security_event
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type text,
  p_severity text,
  p_user_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO security_events (
    event_type,
    severity,
    user_id,
    ip_address,
    user_agent,
    details
  ) VALUES (
    p_event_type,
    p_severity,
    COALESCE(p_user_id, auth.uid()),
    p_ip_address,
    p_user_agent,
    p_details
  )
  RETURNING id INTO v_event_id;

  -- Also log to system_logs for critical events
  IF p_severity IN ('high', 'critical') THEN
    PERFORM log_system_event(
      CASE
        WHEN p_severity = 'critical' THEN 'CRITICAL'
        ELSE 'WARN'
      END,
      'SECURITY',
      format('Security event: %s', p_event_type),
      jsonb_build_object(
        'event_type', p_event_type,
        'severity', p_severity,
        'event_id', v_event_id
      ) || COALESCE(p_details, '{}'::jsonb),
      p_user_id,
      NULL, -- session_id
      p_ip_address,
      p_user_agent,
      NULL, -- stack_trace
      NULL  -- execution_time_ms
    );
  END IF;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function: log_system_event
CREATE OR REPLACE FUNCTION log_system_event(
  p_level text,
  p_category text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_stack_trace text DEFAULT NULL,
  p_execution_time_ms integer DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
  v_actual_ip inet;
BEGIN
  -- Capture the actual client IP address from the connection
  -- Use inet_client_addr() if p_ip_address is null
  v_actual_ip := COALESCE(p_ip_address, inet_client_addr());

  INSERT INTO system_logs (
    level, category, message, metadata, user_id, session_id,
    ip_address, user_agent, stack_trace, execution_time_ms
  ) VALUES (
    p_level, p_category, p_message, p_metadata, p_user_id, p_session_id,
    v_actual_ip, p_user_agent, p_stack_trace, p_execution_time_ms
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function: log_system_role_changes
CREATE OR REPLACE FUNCTION log_system_role_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email text;
  v_granter_email text;
BEGIN
  -- Get user emails for better audit trail
  SELECT email INTO v_user_email FROM auth.users WHERE id = COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP = 'INSERT' THEN
    SELECT email INTO v_granter_email FROM auth.users WHERE id = NEW.granted_by;

    PERFORM log_audit_event(
      'grant_system_role',
      'system_role',
      NEW.id,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'user_email', v_user_email,
        'role', NEW.role,
        'granted_by', NEW.granted_by,
        'granter_email', v_granter_email
      ),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Role should not change once granted, but track if it does
    PERFORM log_audit_event(
      'modify_system_role',
      'system_role',
      NEW.id,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'user_email', v_user_email,
        'old_role', OLD.role,
        'new_role', NEW.role
      ),
      to_jsonb(OLD),
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Role revocation
    PERFORM log_audit_event(
      'revoke_system_role',
      'system_role',
      OLD.id,
      jsonb_build_object(
        'user_id', OLD.user_id,
        'user_email', v_user_email,
        'role', OLD.role,
        'originally_granted_by', OLD.granted_by
      ),
      to_jsonb(OLD),
      NULL,
      'success',
      NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: mask_email
CREATE OR REPLACE FUNCTION mask_email(p_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_local_part text;
  v_domain text;
  v_masked_local text;
BEGIN
  -- Return null for null input
  IF p_email IS NULL THEN
    RETURN NULL;
  END IF;

  -- Split email into local and domain parts
  v_local_part := split_part(p_email, '@', 1);
  v_domain := split_part(p_email, '@', 2);

  -- If no @ symbol, just mask the whole thing
  IF v_domain = '' THEN
    RETURN substring(p_email from 1 for 1) || '***';
  END IF;

  -- Mask local part: show first and last char
  IF length(v_local_part) <= 2 THEN
    v_masked_local := v_local_part[1] || '*';
  ELSE
    v_masked_local := v_local_part[1] || repeat('*', length(v_local_part) - 2) || v_local_part[length(v_local_part)];
  END IF;

  RETURN v_masked_local || '@' || v_domain;
END;
$$ LANGUAGE plpgsql;

-- Function: mask_ip
CREATE OR REPLACE FUNCTION mask_ip(p_ip_address inet)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN mask_ip(host(p_ip_address));
END;
$$ LANGUAGE plpgsql;

-- Function: mask_phone
CREATE OR REPLACE FUNCTION mask_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_phone IS NULL THEN
    RETURN NULL;
  END IF;

  -- Mask all but last 4 digits
  IF length(p_phone) <= 4 THEN
    RETURN repeat('*', length(p_phone));
  ELSE
    RETURN repeat('*', length(p_phone) - 4) || substring(p_phone from length(p_phone) - 3);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: mask_sensitive_jsonb
CREATE OR REPLACE FUNCTION mask_sensitive_jsonb(p_metadata jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result jsonb := p_metadata;
  v_sensitive_keys text[] := ARRAY['email', 'password', 'token', 'api_key', 'secret', 'ssn', 'credit_card'];
  v_key text;
BEGIN
  IF p_metadata IS NULL THEN
    RETURN NULL;
  END IF;

  -- Mask sensitive fields
  FOREACH v_key IN ARRAY v_sensitive_keys
  LOOP
    IF p_metadata ? v_key THEN
      v_result := jsonb_set(v_result, ARRAY[v_key], to_jsonb('***MASKED***'::text));
    END IF;
  END LOOP;

  -- Mask email if present
  IF p_metadata ? 'user_email' AND p_metadata->>'user_email' IS NOT NULL THEN
    v_result := jsonb_set(
      v_result,
      ARRAY['user_email'],
      to_jsonb(mask_email(p_metadata->>'user_email'))
    );
  END IF;

  -- Mask IP if present
  IF p_metadata ? 'ip_address' AND p_metadata->>'ip_address' IS NOT NULL THEN
    v_result := jsonb_set(
      v_result,
      ARRAY['ip_address'],
      to_jsonb(mask_ip(p_metadata->>'ip_address'))
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: prevent_audit_log_modifications
CREATE OR REPLACE FUNCTION prevent_audit_log_modifications()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE operations are not allowed. Log ID: %', OLD.id
      USING HINT = 'Audit logs cannot be modified to maintain GDPR compliance and audit trail integrity.',
            ERRCODE = 'integrity_constraint_violation';
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit logs are immutable. DELETE operations are not allowed. Log ID: %', OLD.id
      USING HINT = 'Audit logs cannot be deleted to maintain GDPR compliance and audit trail integrity.',
            ERRCODE = 'integrity_constraint_violation';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: prevent_system_log_modifications
CREATE OR REPLACE FUNCTION prevent_system_log_modifications()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'System logs are immutable. UPDATE operations are not allowed. Log ID: %', OLD.id
      USING HINT = 'System logs cannot be modified to maintain audit trail integrity.',
            ERRCODE = 'integrity_constraint_violation';
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'System logs are immutable. DELETE operations are not allowed. Log ID: %', OLD.id
      USING HINT = 'System logs cannot be deleted to maintain audit trail integrity.',
            ERRCODE = 'integrity_constraint_violation';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: public.sync_user_email_to_profile
CREATE OR REPLACE FUNCTION public.sync_user_email_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Insert new profile with email and full_name from auth.users
  -- full_name is extracted from raw_user_meta_data if available
  INSERT INTO public.profiles (id, email, full_name, mfa_enabled)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    false
  )
  ON CONFLICT (id) 
  DO UPDATE SET 
    email = NEW.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: record_failed_login
CREATE OR REPLACE FUNCTION record_failed_login(
  p_email text,
  p_ip_address inet,
  p_user_agent text DEFAULT NULL,
  p_failure_reason text DEFAULT 'invalid_credentials'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recent_attempts integer;
  v_lockout_threshold integer := 5;
  v_lockout_window_minutes integer := 15;
  v_lockout_duration_minutes integer := 30;
  v_lockout_until timestamptz;
BEGIN
  -- Record the failed attempt
  INSERT INTO failed_login_attempts (
    email,
    ip_address,
    attempt_time,
    user_agent,
    failure_reason
  ) VALUES (
    p_email,
    p_ip_address,
    now(),
    p_user_agent,
    p_failure_reason
  );

  -- Count recent failed attempts in the lockout window
  SELECT COUNT(*)
  INTO v_recent_attempts
  FROM failed_login_attempts
  WHERE email = p_email
    AND attempt_time > (now() - (v_lockout_window_minutes || ' minutes')::interval);

  -- Check if we should lock the account
  IF v_recent_attempts >= v_lockout_threshold THEN
    v_lockout_until := now() + (v_lockout_duration_minutes || ' minutes')::interval;

    -- Create or update lockout
    INSERT INTO account_lockouts (
      email,
      locked_at,
      locked_until,
      locked_by_ip,
      attempts_count,
      is_active
    ) VALUES (
      p_email,
      now(),
      v_lockout_until,
      p_ip_address,
      v_recent_attempts,
      true
    )
    ON CONFLICT DO NOTHING;

    -- Log the lockout event
    PERFORM log_system_event(
      p_level := 'WARN',
      p_category := 'AUTH',
      p_message := 'Account locked due to failed login attempts',
      p_user_id := NULL,
      p_business_id := NULL,
      p_ip_address := p_ip_address,
      p_user_agent := p_user_agent,
      p_metadata := jsonb_build_object(
        'email', p_email,
        'attempts', v_recent_attempts,
        'locked_until', v_lockout_until
      )
    );

    RETURN jsonb_build_object(
      'locked', true,
      'attempts', v_recent_attempts,
      'lockedUntil', v_lockout_until,
      'message', 'Account temporarily locked due to multiple failed login attempts'
    );
  END IF;

  -- Return attempt info without lockout
  RETURN jsonb_build_object(
    'locked', false,
    'attempts', v_recent_attempts,
    'remainingAttempts', v_lockout_threshold - v_recent_attempts
  );
END;
$$ LANGUAGE plpgsql;

-- Function: record_mfa_failed_attempt
CREATE OR REPLACE FUNCTION record_mfa_failed_attempt(
  p_user_id uuid,
  p_attempt_type text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO mfa_failed_attempts (user_id, attempt_type, ip_address, user_agent)
  VALUES (p_user_id, p_attempt_type, p_ip_address, p_user_agent);

  -- Clean up old attempts (older than 1 hour)
  DELETE FROM mfa_failed_attempts
  WHERE user_id = p_user_id
    AND attempted_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function: record_signed_url_access
CREATE OR REPLACE FUNCTION record_signed_url_access(
  p_request_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE signed_url_requests
  SET
    accessed = true,
    access_count = access_count + 1,
    last_accessed_at = now()
  WHERE id = p_request_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function: refresh_audit_logs_summary
CREATE OR REPLACE FUNCTION refresh_audit_logs_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY audit_logs_summary;
END;
$$ LANGUAGE plpgsql;

-- Function: refresh_dashboard_analytics_trigger
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
$$ LANGUAGE plpgsql;

-- Function: scan_failed_extractions
CREATE OR REPLACE FUNCTION scan_failed_extractions()
RETURNS TABLE (
  receipt_id uuid,
  file_path text,
  file_size bigint,
  extraction_status text,
  created_at timestamptz,
  business_id uuid
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Find receipts that have permanently failed extraction
  -- (status = 'failed' and older than 7 days)
  RETURN QUERY
  SELECT 
    r.id as receipt_id,
    r.file_path,
    COALESCE((
      SELECT (metadata->>'size')::bigint 
      FROM storage.objects 
      WHERE name = r.file_path 
      AND bucket_id = 'receipts'
      LIMIT 1
    ), 0) as file_size,
    r.extraction_status,
    r.created_at,
    c.business_id
  FROM receipts r
  LEFT JOIN collections c ON c.id = r.collection_id
  WHERE r.extraction_status = 'failed'
  AND r.created_at < (now() - interval '7 days')
  AND r.deleted_at IS NULL
  ORDER BY r.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function: scan_orphaned_files
CREATE OR REPLACE FUNCTION scan_orphaned_files()
RETURNS TABLE (
  storage_path text,
  file_size bigint,
  created_at timestamptz
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Find files in storage.objects that don't have a corresponding receipt
  -- Check both main receipts and child pages (parent_receipt_id IS NOT NULL)
  RETURN QUERY
  SELECT 
    so.name::text as storage_path,
    COALESCE((so.metadata->>'size')::bigint, 0) as file_size,
    so.created_at
  FROM storage.objects so
  WHERE so.bucket_id = 'receipts'
  AND NOT EXISTS (
    SELECT 1 FROM receipts r
    WHERE r.file_path = so.name
    OR r.thumbnail_path = so.name
  )
  ORDER BY COALESCE((so.metadata->>'size')::bigint, 0) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: scan_soft_deleted_receipts
CREATE OR REPLACE FUNCTION scan_soft_deleted_receipts()
RETURNS TABLE (
  receipt_id uuid,
  file_path text,
  file_size bigint,
  deleted_at timestamptz,
  business_id uuid,
  page_count integer
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Find soft-deleted receipts older than 30 days
  -- Count child pages where parent_receipt_id = receipt id
  RETURN QUERY
  SELECT 
    r.id as receipt_id,
    r.file_path,
    COALESCE((
      SELECT (metadata->>'size')::bigint 
      FROM storage.objects 
      WHERE name = r.file_path 
      AND bucket_id = 'receipts'
      LIMIT 1
    ), 0) as file_size,
    r.deleted_at,
    c.business_id,
    COALESCE((SELECT COUNT(*)::integer FROM receipts WHERE parent_receipt_id = r.id), 0) as page_count
  FROM receipts r
  LEFT JOIN collections c ON c.id = r.collection_id
  WHERE r.deleted_at IS NOT NULL
  AND r.deleted_at < (now() - interval '30 days')
  ORDER BY r.deleted_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function: search_audit_logs
CREATE OR REPLACE FUNCTION search_audit_logs(
  p_search_query text,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  action text,
  resource_type text,
  user_email text,
  similarity_score real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.created_at,
    al.action,
    al.resource_type,
    au.email as user_email,
    GREATEST(
      similarity(al.action, p_search_query),
      similarity(al.resource_type, p_search_query),
      similarity(COALESCE(al.details::text, ''), p_search_query)
    ) as similarity_score
  FROM audit_logs al
  LEFT JOIN auth.users au ON al.user_id = au.id
  WHERE
    al.action % p_search_query
    OR al.resource_type % p_search_query
    OR al.details::text ILIKE '%' || p_search_query || '%'
  ORDER BY similarity_score DESC, al.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: send_invitation_email_webhook
CREATE OR REPLACE FUNCTION send_invitation_email_webhook()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  function_url text;
  inviter_name text;
  business_name text;
  supabase_url text;
BEGIN
  -- Get the Supabase URL from environment
  supabase_url := current_setting('request.headers', true)::json->>'x-forwarded-host';
  
  IF supabase_url IS NULL THEN
    supabase_url := 'fvddlksirpbwqopqhwud.supabase.co';
  END IF;
  
  function_url := 'https://' || supabase_url || '/functions/v1/send-invitation-email';

  SELECT p.full_name INTO inviter_name
  FROM profiles p
  WHERE p.id = NEW.invited_by;

  SELECT b.name INTO business_name
  FROM businesses b
  WHERE b.id = NEW.business_id;

  -- Log the attempt
  RAISE LOG 'Sending invitation email to % via %', NEW.email, function_url;

  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('request.jwt.claims', true)::json->>'token'
    ),
    body := jsonb_build_object(
      'email', NEW.email,
      'role', NEW.role,
      'token', NEW.token,
      'inviterName', inviter_name,
      'businessName', business_name
    )
  ) INTO request_id;

  RAISE LOG 'Invitation email request queued with ID: %', request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send invitation email: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: should_log_event
CREATE OR REPLACE FUNCTION should_log_event(
  p_category text,
  p_level text
)
RETURNS boolean AS $$
DECLARE
  v_config record;
  v_level_priority int;
  v_min_priority int;
BEGIN
  -- Get configuration for category
  SELECT * INTO v_config
  FROM log_level_config
  WHERE category = p_category;
  
  -- If no config or disabled, don't log
  IF v_config IS NULL OR NOT v_config.enabled THEN
    RETURN false;
  END IF;
  
  -- Convert levels to priorities (higher = more severe)
  v_level_priority := CASE p_level
    WHEN 'DEBUG' THEN 1
    WHEN 'INFO' THEN 2
    WHEN 'WARN' THEN 3
    WHEN 'ERROR' THEN 4
    WHEN 'CRITICAL' THEN 5
    ELSE 2
  END;
  
  v_min_priority := CASE v_config.min_level
    WHEN 'DEBUG' THEN 1
    WHEN 'INFO' THEN 2
    WHEN 'WARN' THEN 3
    WHEN 'ERROR' THEN 4
    WHEN 'CRITICAL' THEN 5
    ELSE 2
  END;
  
  -- Log if level is at or above minimum
  RETURN v_level_priority >= v_min_priority;
END;
$$ LANGUAGE plpgsql;

-- Function: sync_user_email_to_profile
CREATE OR REPLACE FUNCTION sync_user_email_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, mfa_enabled)
  VALUES (NEW.id, NEW.email, NULL, false)
  ON CONFLICT (id) 
  DO UPDATE SET email = NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: unlock_account
CREATE OR REPLACE FUNCTION unlock_account(
  p_email text,
  p_unlock_reason text DEFAULT 'Manual unlock by admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  -- Verify caller is system admin
  IF NOT is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only system admins can unlock accounts';
  END IF;

  v_admin_id := auth.uid();

  -- Deactivate all active lockouts for this email
  UPDATE account_lockouts
  SET
    is_active = false,
    unlock_reason = p_unlock_reason,
    unlocked_at = now(),
    unlocked_by = v_admin_id
  WHERE email = p_email
    AND is_active = true;

  -- Log the unlock event
  PERFORM log_system_event(
    p_level := 'INFO',
    p_category := 'AUTH',
    p_message := 'Account manually unlocked by admin',
    p_user_id := v_admin_id,
    p_business_id := NULL,
    p_metadata := jsonb_build_object(
      'email', p_email,
      'unlock_reason', p_unlock_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Account unlocked successfully'
  );
END;
$$ LANGUAGE plpgsql;

-- Function: update_email_inbox_updated_at
CREATE OR REPLACE FUNCTION update_email_inbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: update_saved_filter_updated_at
CREATE OR REPLACE FUNCTION update_saved_filter_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: update_saved_filters_updated_at
CREATE OR REPLACE FUNCTION update_saved_filters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: update_system_config
CREATE OR REPLACE FUNCTION update_system_config(
  p_storage_settings jsonb DEFAULT NULL,
  p_email_settings jsonb DEFAULT NULL,
  p_app_settings jsonb DEFAULT NULL,
  p_feature_flags jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config_id uuid;
  updated_config jsonb;
BEGIN
  -- Check if user is system admin
  IF NOT EXISTS (
    SELECT 1 FROM system_roles
    WHERE user_id = auth.uid()
    AND role = 'system_admin'
  ) THEN
    RAISE EXCEPTION 'Only system admins can update system configuration';
  END IF;

  -- Get or create config row
  SELECT id INTO config_id FROM system_config LIMIT 1;

  IF config_id IS NULL THEN
    INSERT INTO system_config DEFAULT VALUES RETURNING id INTO config_id;
  END IF;

  -- Update only provided fields
  UPDATE system_config
  SET
    storage_settings = COALESCE(p_storage_settings, storage_settings),
    email_settings = COALESCE(p_email_settings, email_settings),
    app_settings = COALESCE(p_app_settings, app_settings),
    feature_flags = COALESCE(p_feature_flags, feature_flags),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = config_id;

  -- Return updated config
  SELECT get_system_config() INTO updated_config;

  RETURN updated_config;
END;
$$ LANGUAGE plpgsql;

-- Function: update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: update_user_activity_pattern
CREATE OR REPLACE FUNCTION update_user_activity_pattern(
  p_user_id uuid,
  p_pattern_type text,
  p_ip_address inet DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_hour integer;
  v_current_day integer;
BEGIN
  v_current_hour := EXTRACT(HOUR FROM now());
  v_current_day := EXTRACT(DOW FROM now());

  INSERT INTO user_activity_patterns (
    user_id,
    pattern_type,
    typical_time_of_day,
    typical_days_of_week,
    typical_locations,
    last_updated
  ) VALUES (
    p_user_id,
    p_pattern_type,
    ARRAY[v_current_hour],
    ARRAY[v_current_day],
    CASE WHEN p_ip_address IS NOT NULL THEN ARRAY[p_ip_address] ELSE NULL END,
    now()
  )
  ON CONFLICT (user_id, pattern_type)
  DO UPDATE SET
    typical_time_of_day = (
      SELECT array_agg(DISTINCT hour)
      FROM unnest(user_activity_patterns.typical_time_of_day || v_current_hour) AS hour
      LIMIT 10
    ),
    typical_days_of_week = (
      SELECT array_agg(DISTINCT day)
      FROM unnest(user_activity_patterns.typical_days_of_week || v_current_day) AS day
    ),
    typical_locations = (
      CASE
        WHEN p_ip_address IS NOT NULL THEN (
          SELECT array_agg(DISTINCT ip)
          FROM unnest(COALESCE(user_activity_patterns.typical_locations, ARRAY[]::inet[]) || p_ip_address) AS ip
          LIMIT 5
        )
        ELSE user_activity_patterns.typical_locations
      END
    ),
    last_updated = now();
END;
$$ LANGUAGE plpgsql;

-- Function: validate_file_upload
CREATE OR REPLACE FUNCTION validate_file_upload(
  p_file_name text,
  p_file_size bigint,
  p_mime_type text,
  p_collection_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_file_size bigint := 10485760; -- 10 MB default
  v_allowed_types text[] := ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
  v_result jsonb;
BEGIN
  -- Check file size
  IF p_file_size > v_max_file_size THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', format('File size exceeds maximum allowed size of %s MB', v_max_file_size / 1048576)
    );
  END IF;

  -- Check file type
  IF NOT (p_mime_type = ANY(v_allowed_types)) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', format('File type %s is not allowed. Allowed types: %s', p_mime_type, array_to_string(v_allowed_types, ', '))
    );
  END IF;

  -- Check file extension matches MIME type
  IF p_mime_type LIKE 'image/%' THEN
    IF NOT (p_file_name ~* '\.(jpg|jpeg|png|webp)$') THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'File extension does not match MIME type'
      );
    END IF;
  ELSIF p_mime_type = 'application/pdf' THEN
    IF NOT (p_file_name ~* '\.pdf$') THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'File extension does not match MIME type'
      );
    END IF;
  END IF;

  -- Check collection exists and user has access
  IF NOT EXISTS (
    SELECT 1
    FROM collections c
    JOIN business_members bm ON bm.business_id = c.business_id
    WHERE c.id = p_collection_id
    AND bm.user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Collection not found or access denied'
    );
  END IF;

  -- All validations passed
  RETURN jsonb_build_object(
    'valid', true,
    'message', 'File validation successful'
  );
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger: audit_account_lockouts_trigger
CREATE TRIGGER audit_account_lockouts_trigger
  AFTER INSERT OR UPDATE ON account_lockouts
  FOR EACH ROW
  EXECUTE FUNCTION audit_account_lockouts();

-- Trigger: audit_business_admin_changes_trigger
CREATE TRIGGER audit_business_admin_changes_trigger
  AFTER UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION audit_business_admin_changes();

-- Trigger: audit_business_changes
CREATE TRIGGER audit_business_changes
  AFTER INSERT OR UPDATE OR DELETE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION log_business_changes_with_delete();

-- Trigger: audit_business_member_changes
CREATE TRIGGER audit_business_member_changes
  AFTER INSERT OR UPDATE OR DELETE ON business_members
  FOR EACH ROW
  EXECUTE FUNCTION log_business_member_changes();

-- Trigger: audit_collection_changes
CREATE TRIGGER audit_collection_changes
  AFTER INSERT OR UPDATE OR DELETE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION log_collection_changes_enhanced();

-- Trigger: audit_collection_member_changes
CREATE TRIGGER audit_collection_member_changes
  AFTER INSERT OR UPDATE OR DELETE ON collection_members
  FOR EACH ROW
  EXECUTE FUNCTION log_collection_member_changes();

-- Trigger: audit_duplicate_review_trigger
CREATE TRIGGER audit_duplicate_review_trigger
  AFTER UPDATE ON potential_duplicates
  FOR EACH ROW
  EXECUTE FUNCTION audit_duplicate_review();

-- Trigger: audit_expense_category_changes
CREATE TRIGGER audit_expense_category_changes
  AFTER INSERT OR UPDATE OR DELETE ON expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION log_expense_category_changes();

-- Trigger: audit_invitation_changes
CREATE TRIGGER audit_invitation_changes
  AFTER INSERT OR UPDATE OR DELETE ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION log_invitation_changes();

-- Trigger: audit_log_level_config_changes
CREATE TRIGGER audit_log_level_config_changes
  AFTER INSERT OR UPDATE OR DELETE ON log_level_config
  FOR EACH ROW
  EXECUTE FUNCTION log_log_level_config_changes();

-- Trigger: audit_profile_changes
CREATE TRIGGER audit_profile_changes
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_profile_changes();

-- Trigger: audit_receipt_approval_changes
CREATE TRIGGER audit_receipt_approval_changes
  AFTER INSERT OR UPDATE ON receipt_approvals
  FOR EACH ROW
  EXECUTE FUNCTION log_receipt_approval_changes();

-- Trigger: audit_receipt_delete
CREATE TRIGGER audit_receipt_delete
  BEFORE DELETE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION log_receipt_delete_enhanced();

-- Trigger: audit_receipt_insert
CREATE TRIGGER audit_receipt_insert
  AFTER INSERT ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION log_receipt_insert_enhanced();

-- Trigger: audit_receipt_update
CREATE TRIGGER audit_receipt_update
  AFTER UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION log_receipt_update_enhanced();

-- Trigger: audit_system_config_trigger
CREATE TRIGGER audit_system_config_trigger
  AFTER UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION audit_system_config_changes();

-- Trigger: audit_system_role_changes
CREATE TRIGGER audit_system_role_changes
  AFTER INSERT OR UPDATE OR DELETE ON system_roles
  FOR EACH ROW
  EXECUTE FUNCTION log_system_role_changes();

-- Trigger: ensure_single_default_audit_filter_trigger
CREATE TRIGGER ensure_single_default_audit_filter_trigger
  BEFORE INSERT OR UPDATE ON saved_audit_filters
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_audit_filter();

-- Trigger: ensure_single_default_filter_trigger
CREATE TRIGGER ensure_single_default_filter_trigger
  BEFORE INSERT OR UPDATE ON saved_filters
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_filter();

-- Trigger: ensure_single_default_system_filter_trigger
CREATE TRIGGER ensure_single_default_system_filter_trigger
  BEFORE INSERT OR UPDATE ON saved_system_filters
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_system_filter();

-- Trigger: for
Create trigger for email receipt audit logging
DROP TRIGGER IF EXISTS audit_email_receipt_trigger ON receipts;
CREATE TRIGGER audit_email_receipt_trigger
  AFTER INSERT ON receipts
  FOR EACH ROW
  WHEN (NEW.source = 'email')
  EXECUTE FUNCTION audit_email_receipt_changes();

-- Trigger: function
Create trigger function for audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_log_modifications()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE operations are not allowed. Log ID: %', OLD.id
      USING HINT = 'Audit logs cannot be modified to maintain GDPR compliance and audit trail integrity.',
            ERRCODE = 'integrity_constraint_violation';
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit logs are immutable. DELETE operations are not allowed. Log ID: %', OLD.id
      USING HINT = 'Audit logs cannot be deleted to maintain GDPR compliance and audit trail integrity.',
            ERRCODE = 'integrity_constraint_violation';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS prevent_audit_log_updates ON audit_logs;

-- Apply trigger to audit_logs
CREATE TRIGGER prevent_audit_log_updates
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modifications();

-- Trigger: on_auth_user_email_change
CREATE TRIGGER on_auth_user_email_change
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_email_to_profile();

-- Trigger: on_business_created
CREATE TRIGGER on_business_created
  AFTER INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION create_business_owner_membership();

-- Trigger: on_invitation_created
CREATE TRIGGER on_invitation_created
  AFTER INSERT ON invitations
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION send_invitation_email_webhook();

-- Trigger: to
Create trigger to sync email on auth.users changes
DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
CREATE TRIGGER on_auth_user_email_change
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_email_to_profile();

-- Trigger: trigger_refresh_analytics_on_receipt_change
CREATE TRIGGER trigger_refresh_analytics_on_receipt_change
  AFTER INSERT OR UPDATE OR DELETE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION refresh_dashboard_analytics_trigger();

-- Trigger: update_businesses_updated_at
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: update_collections_updated_at
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: update_profiles_updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: update_receipts_updated_at
CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: update_saved_audit_filters_updated_at
CREATE TRIGGER update_saved_audit_filters_updated_at
  BEFORE UPDATE ON saved_audit_filters
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_filter_updated_at();

-- Trigger: update_saved_filters_updated_at_trigger
CREATE TRIGGER update_saved_filters_updated_at_trigger
  BEFORE UPDATE ON saved_filters
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_filters_updated_at();

-- Trigger: update_saved_system_filters_updated_at
CREATE TRIGGER update_saved_system_filters_updated_at
  BEFORE UPDATE ON saved_system_filters
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_filter_updated_at();


-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================


-- =====================================================
-- DEFAULT DATA
-- =====================================================

INSERT INTO expense_categories (name, description, icon, color, sort_order) VALUES
  ('Meals & Entertainment', 'Restaurant, catering, client meals', 'utensils', '#3B82F6', 1),
  ('Transportation', 'Fuel, parking, transit, vehicle expenses', 'car', '#10B981', 2),
  ('Office Supplies', 'Stationery, equipment, furniture', 'briefcase', '#6366F1', 3),
  ('Professional Services', 'Legal, accounting, consulting fees', 'users', '#8B5CF6', 4),
  ('Utilities', 'Phone, internet, electricity, water', 'zap', '#F59E0B', 5),
  ('Rent & Lease', 'Office space, equipment leases', 'home', '#EF4444', 6),
  ('Marketing & Advertising', 'Promotions, ads, branding', 'megaphone', '#EC4899', 7),
  ('Insurance', 'Business liability, property insurance', 'shield', '#14B8A6', 8),
  ('Travel', 'Hotels, flights, accommodation', 'plane', '#06B6D4', 9),
  ('Repairs & Maintenance', 'Equipment fixes, building maintenance', 'wrench', '#F97316', 10),
  ('Software & Subscriptions', 'SaaS, licenses, cloud services', 'laptop', '#8B5CF6', 11),
  ('Miscellaneous', 'Other business expenses', 'more-horizontal', '#6B7280', 12)
ON CONFLICT (name) DO NOTHING;
INSERT INTO expense_categories (name, description, is_default, display_order)
    VALUES
      ('Office Supplies', 'Paper, pens, and general office items', true, 1),
      ('Travel', 'Transportation, accommodation, and travel expenses', true, 2),
      ('Meals & Entertainment', 'Business meals and client entertainment', true, 3),
      ('Utilities', 'Electricity, water, internet, and phone services', true, 4),
      ('Professional Services', 'Legal, accounting, consulting fees', true, 5),
      ('Equipment', 'Computers, machinery, and tools', true, 6),
      ('Marketing', 'Advertising, promotions, and marketing materials', true, 7),
      ('Miscellaneous', 'Other expenses not fitting specific categories', true, 99);
INSERT INTO expense_categories (name, description, display_order) VALUES
  ('Advertising & Marketing', 'Marketing campaigns, ads, promotions, and brand development', 1),
  ('Auto & Vehicle Expenses', 'Vehicle purchases, fuel, maintenance, parking, tolls', 2),
  ('Bank Fees & Charges', 'Banking fees, transaction charges, wire fees', 3),
  ('Business Insurance', 'General liability, property, professional liability insurance', 4),
  ('Client Entertainment', 'Business meals, entertainment, gifts for clients', 5),
  ('Computer & IT Equipment', 'Hardware, computers, servers, peripherals', 6),
  ('Consulting & Professional Fees', 'Legal, accounting, consulting, advisory services', 7),
  ('Depreciation', 'Asset depreciation expenses', 8),
  ('Dues & Subscriptions', 'Professional memberships, publications, subscriptions', 9),
  ('Education & Training', 'Courses, seminars, workshops, certifications', 10),
  ('Employee Benefits', 'Health insurance, retirement plans, perks', 11),
  ('Equipment Rental', 'Rental of tools, equipment, machinery', 12),
  ('Furniture & Fixtures', 'Office furniture, fixtures, decorations', 13),
  ('Insurance - Health', 'Employee health and dental insurance', 14),
  ('Insurance - Other', 'Other business insurance not categorized', 15),
  ('Interest Expense', 'Loan interest, credit card interest', 16),
  ('Licenses & Permits', 'Business licenses, permits, certifications', 17),
  ('Maintenance & Repairs', 'Building and equipment maintenance and repairs', 18),
  ('Meals - Business', 'Business-related meals and refreshments', 19),
  ('Office Supplies', 'Paper, pens, printing, and general office items', 20),
  ('Payroll Expenses', 'Salaries, wages, payroll taxes', 21),
  ('Postage & Shipping', 'Mail, courier, shipping costs', 22),
  ('Professional Development', 'Training, coaching, skill development', 23),
  ('Rent - Equipment', 'Equipment and machinery rental', 24),
  ('Rent - Office', 'Office and facility rent', 25),
  ('Software & Subscriptions', 'Software licenses, SaaS, cloud services', 26),
  ('Taxes & Licenses', 'Business taxes, fees, licenses', 27),
  ('Telecommunications', 'Phone, internet, mobile services', 28),
  ('Travel - Accommodation', 'Hotels, lodging for business travel', 29),
  ('Travel - Airfare', 'Flight tickets for business travel', 30),
  ('Travel - Ground Transport', 'Taxis, rideshare, car rentals for business', 31),
  ('Utilities', 'Electricity, water, gas, heating', 32),
  ('Website & Hosting', 'Domain, hosting, web development', 33),
  ('Miscellaneous', 'Other expenses not categorized elsewhere', 99)
ON CONFLICT (name) DO NOTHING;
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
INSERT INTO system_config DEFAULT VALUES RETURNING * INTO config_row;
INSERT INTO system_config DEFAULT VALUES RETURNING id INTO config_id;
INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      changes,
      ip_address,
      user_agent
    ) VALUES (
      auth.uid(),
      'UPDATE',
      'system_config',
      NEW.id::text,
      changed_fields,
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'user-agent'
    );
INSERT INTO system_config DEFAULT VALUES
ON CONFLICT DO NOTHING;
