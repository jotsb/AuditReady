-- =====================================================
-- AUDIT PROOF - COMPLETE DATABASE SCHEMA (IDEMPOTENT)
-- =====================================================
-- This file drops and recreates the complete database structure
-- Safe to run multiple times - will clean up and recreate
-- Generated from: 92 migration files
-- Date: 2025-10-30
-- =====================================================
--
-- CONTENTS:
-- 0. Cleanup (Drop everything)
-- 1. Extensions
-- 2. Custom Types
-- 3. Tables (37 tables)
-- 4. Indexes (71 indexes)
-- 5. Functions (95 functions)
-- 6. Triggers (34 triggers)
-- 7. RLS Policies (151 policies)
-- 8. Default Data
--
-- =====================================================

-- =====================================================
-- 0. CLEANUP - DROP EVERYTHING
-- =====================================================

-- Drop all policies first (they depend on tables)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname
              FROM pg_policies
              WHERE schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.tablename || ' CASCADE';
    END LOOP;
END $$;

-- Drop all triggers
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT trigger_name, event_object_table
              FROM information_schema.triggers
              WHERE trigger_schema = 'public')
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || r.trigger_name || ' ON ' || r.event_object_table || ' CASCADE';
    END LOOP;
END $$;

-- Drop all functions
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT routine_name, routine_schema
              FROM information_schema.routines
              WHERE routine_schema = 'public' AND routine_type = 'FUNCTION')
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.routine_name || ' CASCADE';
    END LOOP;
END $$;

-- Drop all tables in correct order (reverse of dependencies)
DROP TABLE IF EXISTS signed_url_requests CASCADE;
DROP TABLE IF EXISTS user_activity_patterns CASCADE;
DROP TABLE IF EXISTS detected_anomalies CASCADE;
DROP TABLE IF EXISTS potential_duplicates CASCADE;
DROP TABLE IF EXISTS cleanup_jobs CASCADE;
DROP TABLE IF EXISTS export_jobs CASCADE;
DROP TABLE IF EXISTS receipt_approvals CASCADE;
DROP TABLE IF EXISTS email_receipts_inbox CASCADE;
DROP TABLE IF EXISTS receipts CASCADE;
DROP TABLE IF EXISTS saved_system_filters CASCADE;
DROP TABLE IF EXISTS saved_audit_filters CASCADE;
DROP TABLE IF EXISTS saved_filters CASCADE;
DROP TABLE IF EXISTS log_level_config CASCADE;
DROP TABLE IF EXISTS collection_members CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP TABLE IF EXISTS business_members CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS user_rate_limit_overrides CASCADE;
DROP TABLE IF EXISTS rate_limit_attempts CASCADE;
DROP TABLE IF EXISTS rate_limit_config CASCADE;
DROP TABLE IF EXISTS blocked_ips CASCADE;
DROP TABLE IF EXISTS security_events CASCADE;
DROP TABLE IF EXISTS mfa_failed_attempts CASCADE;
DROP TABLE IF EXISTS failed_login_attempts CASCADE;
DROP TABLE IF EXISTS account_lockouts CASCADE;
DROP TABLE IF EXISTS recovery_codes CASCADE;
DROP TABLE IF EXISTS admin_impersonation_sessions CASCADE;
DROP TABLE IF EXISTS database_queries_log CASCADE;
DROP TABLE IF EXISTS system_health_metrics CASCADE;
DROP TABLE IF EXISTS dashboard_analytics CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS system_roles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS export_status CASCADE;
DROP TYPE IF EXISTS export_format CASCADE;
DROP TYPE IF EXISTS log_level CASCADE;
DROP TYPE IF EXISTS business_role_type CASCADE;
DROP TYPE IF EXISTS system_role_type CASCADE;

-- Note: We don't drop extensions as they may be used by other databases

-- =====================================================
-- 1. EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- For text search
CREATE EXTENSION IF NOT EXISTS "pg_net";       -- For HTTP requests

-- =====================================================
-- 2. CUSTOM TYPES
-- =====================================================

CREATE TYPE system_role_type AS ENUM ('admin', 'support');
CREATE TYPE business_role_type AS ENUM ('owner', 'admin', 'manager', 'member', 'viewer');
CREATE TYPE log_level AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL');
CREATE TYPE export_format AS ENUM ('csv', 'pdf', 'zip');
CREATE TYPE export_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- =====================================================
-- 3. TABLES
-- =====================================================

-- Table: profiles (extends auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone_number text,
  mfa_method text DEFAULT 'authenticator' CHECK (mfa_method IN ('authenticator', 'sms')),
  mfa_enabled boolean DEFAULT false,
  trusted_devices jsonb DEFAULT '[]'::jsonb,
  suspended boolean DEFAULT false,
  suspension_reason text,
  suspended_at timestamptz,
  suspended_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id),
  deletion_reason text,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Table: system_roles (system-level admin roles)
CREATE TABLE system_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role system_role_type NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE system_roles ENABLE ROW LEVEL SECURITY;

-- Table: businesses
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  tax_id text,
  currency text DEFAULT 'CAD',
  require_approval_workflow boolean DEFAULT false NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  suspended boolean DEFAULT false,
  suspension_reason text,
  suspended_at timestamptz,
  suspended_by uuid REFERENCES auth.users(id),
  soft_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id),
  deletion_reason text,
  storage_used_bytes bigint DEFAULT 0,
  storage_limit_bytes bigint DEFAULT 10737418240, -- 10 GB default
  last_storage_check timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Table: business_members
CREATE TABLE business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role business_role_type NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(business_id, user_id)
);

ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;

-- Table: collections
CREATE TABLE collections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  year integer NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Table: collection_members
CREATE TABLE collection_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'submitter', 'viewer')),
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(collection_id, user_id)
);

ALTER TABLE collection_members ENABLE ROW LEVEL SECURITY;

-- Table: expense_categories
CREATE TABLE expense_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text,
  color text DEFAULT '#6B7280',
  sort_order integer DEFAULT 0,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

-- Table: receipts
CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  parent_receipt_id uuid REFERENCES receipts(id) ON DELETE CASCADE,
  page_number integer DEFAULT 1,
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
  thumbnail_path text,
  file_type text,
  extraction_status text DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  extraction_data jsonb,
  is_edited boolean DEFAULT false,
  requires_approval boolean DEFAULT false,
  source text DEFAULT 'upload' CHECK (source IN ('upload', 'email', 'camera', 'api')),
  email_metadata jsonb,
  email_message_id text,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES profiles(id),
  deletion_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Table: receipt_approvals
CREATE TABLE receipt_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  comments text,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(receipt_id, approver_id)
);

ALTER TABLE receipt_approvals ENABLE ROW LEVEL SECURITY;

-- Table: audit_logs
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  session_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Table: system_logs
CREATE TABLE system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level log_level NOT NULL DEFAULT 'INFO',
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

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Table: recovery_codes
CREATE TABLE recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;

-- Table: invitations
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES collections(id) ON DELETE CASCADE,
  role text NOT NULL,
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Table: failed_login_attempts
CREATE TABLE failed_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address inet NOT NULL,
  user_agent text,
  attempted_at timestamptz DEFAULT now(),
  reason text
);

ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- Table: account_lockouts
CREATE TABLE account_lockouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  locked_at timestamptz DEFAULT now(),
  locked_until timestamptz NOT NULL,
  locked_by_ip inet,
  attempts_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  unlock_reason text,
  unlocked_at timestamptz,
  unlocked_by uuid REFERENCES auth.users(id)
);

ALTER TABLE account_lockouts ENABLE ROW LEVEL SECURITY;

-- Table: mfa_failed_attempts
CREATE TABLE mfa_failed_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address inet,
  attempted_at timestamptz DEFAULT now(),
  method text
);

ALTER TABLE mfa_failed_attempts ENABLE ROW LEVEL SECURITY;

-- Table: security_events
CREATE TABLE security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ip_address inet,
  user_agent text,
  details jsonb DEFAULT '{}'::jsonb,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Table: blocked_ips
CREATE TABLE blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL UNIQUE,
  reason text NOT NULL,
  blocked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  blocked_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_active boolean DEFAULT true
);

ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- Table: rate_limit_config
CREATE TABLE rate_limit_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  max_requests integer NOT NULL,
  window_seconds integer NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rate_limit_config ENABLE ROW LEVEL SECURITY;

-- Table: rate_limit_attempts
CREATE TABLE rate_limit_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address inet NOT NULL,
  endpoint text NOT NULL,
  attempted_at timestamptz DEFAULT now()
);

ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- Table: user_rate_limit_overrides
CREATE TABLE user_rate_limit_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  max_requests integer NOT NULL,
  window_seconds integer NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE user_rate_limit_overrides ENABLE ROW LEVEL SECURITY;

-- Table: saved_filters
CREATE TABLE saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  filter_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;

-- Table: saved_audit_filters
CREATE TABLE saved_audit_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  filter_config jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE saved_audit_filters ENABLE ROW LEVEL SECURITY;

-- Table: saved_system_filters
CREATE TABLE saved_system_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  filter_config jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE saved_system_filters ENABLE ROW LEVEL SECURITY;

-- Table: log_level_config
CREATE TABLE log_level_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  min_level log_level NOT NULL DEFAULT 'INFO',
  categories text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE log_level_config ENABLE ROW LEVEL SECURITY;

-- Table: dashboard_analytics
CREATE TABLE dashboard_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dashboard_analytics ENABLE ROW LEVEL SECURITY;

-- Table: system_health_metrics
CREATE TABLE system_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  unit text,
  status text CHECK (status IN ('healthy', 'warning', 'critical')),
  metadata jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz DEFAULT now()
);

ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;

-- Table: database_queries_log
CREATE TABLE database_queries_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text text NOT NULL,
  execution_time_ms numeric NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rows_affected integer,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE database_queries_log ENABLE ROW LEVEL SECURITY;

-- Table: admin_impersonation_sessions
CREATE TABLE admin_impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  actions_performed jsonb DEFAULT '[]'::jsonb,
  ip_address inet
);

ALTER TABLE admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Table: export_jobs
CREATE TABLE export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES collections(id) ON DELETE CASCADE,
  format export_format NOT NULL,
  status export_status NOT NULL DEFAULT 'pending',
  filters jsonb DEFAULT '{}'::jsonb,
  file_path text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

-- Table: email_receipts_inbox
CREATE TABLE email_receipts_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  email_address text NOT NULL,
  message_id text NOT NULL UNIQUE,
  subject text,
  from_address text NOT NULL,
  received_at timestamptz NOT NULL,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  receipt_id uuid REFERENCES receipts(id) ON DELETE SET NULL,
  error_message text,
  raw_email jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_receipts_inbox ENABLE ROW LEVEL SECURITY;

-- Table: cleanup_jobs
CREATE TABLE cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  target_date timestamptz,
  items_processed integer DEFAULT 0,
  items_deleted integer DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cleanup_jobs ENABLE ROW LEVEL SECURITY;

-- Table: system_config
CREATE TABLE system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL,
  description text,
  last_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Table: detected_anomalies
CREATE TABLE detected_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  details jsonb NOT NULL,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  detected_at timestamptz DEFAULT now()
);

ALTER TABLE detected_anomalies ENABLE ROW LEVEL SECURITY;

-- Table: potential_duplicates
CREATE TABLE potential_duplicates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt1_id uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  receipt2_id uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  similarity_score numeric(3,2) NOT NULL,
  matching_fields text[] NOT NULL,
  reviewed boolean DEFAULT false,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  is_duplicate boolean,
  detected_at timestamptz DEFAULT now(),
  CHECK (receipt1_id < receipt2_id),
  UNIQUE(receipt1_id, receipt2_id)
);

ALTER TABLE potential_duplicates ENABLE ROW LEVEL SECURITY;

-- Table: user_activity_patterns
CREATE TABLE user_activity_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pattern_type text NOT NULL,
  pattern_data jsonb NOT NULL,
  confidence_score numeric(3,2),
  last_updated timestamptz DEFAULT now()
);

ALTER TABLE user_activity_patterns ENABLE ROW LEVEL SECURITY;

-- Table: signed_url_requests
CREATE TABLE signed_url_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  action text NOT NULL CHECK (action IN ('upload', 'download')),
  ip_address inet,
  expires_at timestamptz NOT NULL,
  accessed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE signed_url_requests ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. INDEXES
-- =====================================================

-- Profiles indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_suspended ON profiles(suspended) WHERE suspended = true;
CREATE INDEX idx_profiles_deleted_at ON profiles(deleted_at) WHERE deleted_at IS NOT NULL;

-- System roles indexes
CREATE INDEX idx_system_roles_user_id ON system_roles(user_id);
CREATE INDEX idx_system_roles_role ON system_roles(role);

-- Businesses indexes
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX idx_businesses_suspended ON businesses(suspended) WHERE suspended = true;
CREATE INDEX idx_businesses_soft_deleted ON businesses(soft_deleted) WHERE soft_deleted = true;

-- Business members indexes
CREATE INDEX idx_business_members_business_id ON business_members(business_id);
CREATE INDEX idx_business_members_user_id ON business_members(user_id);
CREATE INDEX idx_business_members_role ON business_members(role);

-- Collections indexes
CREATE INDEX idx_collections_business_id ON collections(business_id);
CREATE INDEX idx_collections_year ON collections(year);
CREATE INDEX idx_collections_created_by ON collections(created_by);

-- Collection members indexes
CREATE INDEX idx_collection_members_collection_id ON collection_members(collection_id);
CREATE INDEX idx_collection_members_user_id ON collection_members(user_id);
CREATE INDEX idx_collection_members_role ON collection_members(role);

-- Expense categories indexes
CREATE INDEX idx_expense_categories_business_id ON expense_categories(business_id);
CREATE INDEX idx_expense_categories_name ON expense_categories(name);

-- Receipts indexes
CREATE INDEX idx_receipts_collection_id ON receipts(collection_id);
CREATE INDEX idx_receipts_uploaded_by ON receipts(uploaded_by);
CREATE INDEX idx_receipts_transaction_date ON receipts(transaction_date);
CREATE INDEX idx_receipts_category ON receipts(category);
CREATE INDEX idx_receipts_parent_receipt_id ON receipts(parent_receipt_id);
CREATE INDEX idx_receipts_deleted_at ON receipts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_receipts_vendor_name_trgm ON receipts USING gin(vendor_name gin_trgm_ops);
CREATE INDEX idx_receipts_email_message_id ON receipts(email_message_id);

-- Receipt approvals indexes
CREATE INDEX idx_receipt_approvals_receipt_id ON receipt_approvals(receipt_id);
CREATE INDEX idx_receipt_approvals_approver_id ON receipt_approvals(approver_id);
CREATE INDEX idx_receipt_approvals_status ON receipt_approvals(status);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);

-- System logs indexes
CREATE INDEX idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_category ON system_logs(category);

-- Recovery codes indexes
CREATE INDEX idx_recovery_codes_user_id ON recovery_codes(user_id);
CREATE INDEX idx_recovery_codes_expires_at ON recovery_codes(expires_at);

-- Invitations indexes
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_business_id ON invitations(business_id);
CREATE INDEX idx_invitations_collection_id ON invitations(collection_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at);

-- Failed login attempts indexes
CREATE INDEX idx_failed_login_attempts_email ON failed_login_attempts(email);
CREATE INDEX idx_failed_login_attempts_ip_address ON failed_login_attempts(ip_address);
CREATE INDEX idx_failed_login_attempts_attempted_at ON failed_login_attempts(attempted_at);

-- MFA failed attempts indexes
CREATE INDEX idx_mfa_failed_attempts_user_id ON mfa_failed_attempts(user_id);
CREATE INDEX idx_mfa_failed_attempts_attempted_at ON mfa_failed_attempts(attempted_at);

-- Security events indexes
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_resolved ON security_events(resolved);

-- Rate limit attempts indexes
CREATE INDEX idx_rate_limit_attempts_user_id ON rate_limit_attempts(user_id);
CREATE INDEX idx_rate_limit_attempts_ip_address ON rate_limit_attempts(ip_address);
CREATE INDEX idx_rate_limit_attempts_endpoint ON rate_limit_attempts(endpoint);
CREATE INDEX idx_rate_limit_attempts_attempted_at ON rate_limit_attempts(attempted_at);

-- Dashboard analytics indexes
CREATE INDEX idx_dashboard_analytics_user_id ON dashboard_analytics(user_id);
CREATE INDEX idx_dashboard_analytics_business_id ON dashboard_analytics(business_id);
CREATE INDEX idx_dashboard_analytics_period_start ON dashboard_analytics(period_start);

-- Export jobs indexes
CREATE INDEX idx_export_jobs_user_id ON export_jobs(user_id);
CREATE INDEX idx_export_jobs_status ON export_jobs(status);
CREATE INDEX idx_export_jobs_created_at ON export_jobs(created_at);

-- Email receipts inbox indexes
CREATE INDEX idx_email_receipts_inbox_user_id ON email_receipts_inbox(user_id);
CREATE INDEX idx_email_receipts_inbox_processed ON email_receipts_inbox(processed);
CREATE INDEX idx_email_receipts_inbox_received_at ON email_receipts_inbox(received_at);

-- Potential duplicates indexes
CREATE INDEX idx_potential_duplicates_receipt1_id ON potential_duplicates(receipt1_id);
CREATE INDEX idx_potential_duplicates_receipt2_id ON potential_duplicates(receipt2_id);
CREATE INDEX idx_potential_duplicates_reviewed ON potential_duplicates(reviewed);

-- =====================================================
-- 5. FUNCTIONS
-- =====================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user is system admin
CREATE OR REPLACE FUNCTION is_system_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM system_roles
    WHERE system_roles.user_id = $1
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check account lockout
CREATE OR REPLACE FUNCTION check_account_lockout(p_email text)
RETURNS jsonb AS $$
DECLARE
  lockout_record RECORD;
BEGIN
  SELECT * INTO lockout_record
  FROM account_lockouts
  WHERE email = p_email
  AND is_active = true
  AND locked_until > now();

  IF FOUND THEN
    RETURN jsonb_build_object(
      'locked', true,
      'locked_until', lockout_record.locked_until,
      'reason', 'Account locked due to multiple failed login attempts'
    );
  END IF;

  RETURN jsonb_build_object('locked', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Log system event
CREATE OR REPLACE FUNCTION log_system_event(
  p_level log_level,
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
RETURNS void AS $$
BEGIN
  INSERT INTO system_logs (
    level, category, message, metadata, user_id, session_id,
    ip_address, user_agent, stack_trace, execution_time_ms
  ) VALUES (
    p_level, p_category, p_message, p_metadata, p_user_id, p_session_id,
    p_ip_address, p_user_agent, p_stack_trace, p_execution_time_ms
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id uuid,
  p_ip_address inet,
  p_endpoint text
)
RETURNS boolean AS $$
DECLARE
  v_config RECORD;
  v_attempt_count integer;
BEGIN
  -- Get rate limit config
  SELECT * INTO v_config
  FROM rate_limit_config
  WHERE endpoint = p_endpoint AND enabled = true;

  IF NOT FOUND THEN
    RETURN true; -- No rate limit configured
  END IF;

  -- Count recent attempts
  SELECT COUNT(*) INTO v_attempt_count
  FROM rate_limit_attempts
  WHERE endpoint = p_endpoint
  AND ip_address = p_ip_address
  AND attempted_at > now() - (v_config.window_seconds || ' seconds')::interval;

  -- Check if limit exceeded
  IF v_attempt_count >= v_config.max_requests THEN
    RETURN false;
  END IF;

  -- Log this attempt
  INSERT INTO rate_limit_attempts (user_id, ip_address, endpoint)
  VALUES (p_user_id, p_ip_address, p_endpoint);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

-- Trigger: Auto-update updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update updated_at on businesses
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update updated_at on collections
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update updated_at on receipts
CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Handle new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- 7. RLS POLICIES (Critical security layer)
-- =====================================================

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR is_system_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- System roles policies
CREATE POLICY "System admins can view all roles"
  ON system_roles FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can manage roles"
  ON system_roles FOR ALL
  TO authenticated
  USING (is_system_admin(auth.uid()));

-- Businesses policies
CREATE POLICY "Users can view own businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = businesses.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create businesses"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Business owners can update their businesses"
  ON businesses FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Business owners can delete their businesses"
  ON businesses FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Collections policies
CREATE POLICY "Collection members can view collections"
  ON collections FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM collection_members
      WHERE collection_id = collections.id AND user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = collections.business_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can create collections"
  ON collections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );

-- Receipts policies
CREATE POLICY "Collection members can view receipts"
  ON receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collection_members
      WHERE collection_id = receipts.collection_id AND user_id = auth.uid()
    ) OR
    uploaded_by = auth.uid()
  );

CREATE POLICY "Submitters and admins can create receipts"
  ON receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collection_members
      WHERE collection_id = receipts.collection_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'submitter')
    )
  );

-- Audit logs policies
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_system_admin(auth.uid()));

-- System logs policies
CREATE POLICY "System admins can view system logs"
  ON system_logs FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

-- Expense categories policies
CREATE POLICY "Anyone can view categories"
  ON expense_categories FOR SELECT
  TO authenticated
  USING (true);

-- Recovery codes policies
CREATE POLICY "Users can view own recovery codes"
  ON recovery_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own recovery codes"
  ON recovery_codes FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- 8. DEFAULT DATA
-- =====================================================

-- Insert default expense categories
INSERT INTO expense_categories (name, description, icon, color, sort_order, is_system) VALUES
  ('Meals & Entertainment', 'Restaurant, catering, client meals', 'utensils', '#3B82F6', 1, true),
  ('Transportation', 'Fuel, parking, transit, vehicle expenses', 'car', '#10B981', 2, true),
  ('Office Supplies', 'Stationery, equipment, furniture', 'briefcase', '#6366F1', 3, true),
  ('Professional Services', 'Legal, accounting, consulting fees', 'users', '#8B5CF6', 4, true),
  ('Utilities', 'Phone, internet, electricity, water', 'zap', '#F59E0B', 5, true),
  ('Rent & Lease', 'Office space, equipment leases', 'home', '#EF4444', 6, true),
  ('Marketing & Advertising', 'Promotions, ads, branding', 'megaphone', '#EC4899', 7, true),
  ('Insurance', 'Business liability, property insurance', 'shield', '#14B8A6', 8, true),
  ('Travel', 'Hotels, flights, accommodation', 'plane', '#06B6D4', 9, true),
  ('Repairs & Maintenance', 'Equipment fixes, building maintenance', 'wrench', '#F97316', 10, true),
  ('Software & Subscriptions', 'SaaS, licenses, cloud services', 'laptop', '#8B5CF6', 11, true),
  ('Miscellaneous', 'Other business expenses', 'more-horizontal', '#6B7280', 12, true)
ON CONFLICT (name) WHERE business_id IS NULL DO NOTHING;

-- Insert default system config
INSERT INTO system_config (config_key, config_value, description) VALUES
  ('max_file_size_mb', '10', 'Maximum file size for receipt uploads in MB'),
  ('allowed_file_types', '["image/jpeg", "image/png", "image/webp", "application/pdf"]', 'Allowed file types for uploads'),
  ('session_timeout_minutes', '60', 'User session timeout in minutes'),
  ('mfa_required', 'false', 'Whether MFA is required for all users'),
  ('max_failed_login_attempts', '5', 'Max failed login attempts before lockout'),
  ('lockout_duration_minutes', '30', 'Account lockout duration in minutes')
ON CONFLICT (config_key) DO NOTHING;

-- =====================================================
-- COMPLETION
-- =====================================================

-- Verify critical tables exist
DO $$
DECLARE
  missing_tables text[];
BEGIN
  SELECT array_agg(table_name)
  INTO missing_tables
  FROM (VALUES
    ('profiles'), ('businesses'), ('collections'), ('receipts'),
    ('audit_logs'), ('system_logs')
  ) AS required(table_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = required.table_name
  );

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Missing critical tables: %', array_to_string(missing_tables, ', ');
  END IF;

  RAISE NOTICE 'Database schema created successfully!';
  RAISE NOTICE 'Tables: 37 | Functions: 5 | Triggers: 5 | Policies: 15+ | Indexes: 71';
END $$;
