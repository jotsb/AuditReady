# Audit Proof Database Schema

## Overview

This directory contains the complete database schema for the Audit Proof receipt management application.

## Files

### Main Schema File
- **`database_schema_complete.sql`** (205KB, 7,402 lines)
  - Complete consolidated schema from all 92 migrations
  - Includes: Extensions, Types, Tables, Indexes, Functions, Triggers, RLS Policies, Default Data
  - Can be run on a fresh database to create the complete structure

## Database Statistics

- **Tables**: 37
- **Functions**: 95
- **Triggers**: 34
- **RLS Policies**: 151
- **Indexes**: 71
- **Extensions**: 3 (uuid-ossp, pg_trgm, pg_net)

## Core Tables

### Authentication & Users
- `profiles` - User profile data (extends auth.users)
- `system_roles` - System-level roles (admin, support)
- `recovery_codes` - MFA recovery codes
- `failed_login_attempts` - Failed login tracking
- `mfa_failed_attempts` - MFA failure tracking
- `account_lockouts` - Account lockout tracking

### Business & Organizations
- `businesses` - Company/entity records
- `business_members` - Business membership with roles
- `collections` - Receipt organizational units (by year/department)
- `collection_members` - Collection access with roles

### Core Data
- `receipts` - Receipt/expense records (main entity)
- `expense_categories` - Expense classification
- `email_receipts_inbox` - Email-forwarded receipts
- `receipt_approvals` - Approval workflow records

### Security & Auditing
- `audit_logs` - Comprehensive audit trail
- `system_logs` - System-level logs
- `security_events` - Security-related events
- `blocked_ips` - IP blocking
- `rate_limit_config` - Rate limiting configuration
- `rate_limit_attempts` - Rate limit tracking
- `signed_url_requests` - Presigned URL tracking

### System Management
- `system_config` - System configuration
- `system_health_metrics` - Health monitoring
- `dashboard_analytics` - Analytics data
- `database_queries_log` - Query logging
- `admin_impersonation_sessions` - Admin impersonation tracking
- `user_activity_patterns` - User behavior patterns
- `detected_anomalies` - Anomaly detection
- `potential_duplicates` - Duplicate receipt detection

### User Features
- `invitations` - User invitations
- `saved_filters` - Saved search filters
- `saved_audit_filters` - Saved audit log filters
- `saved_system_filters` - Saved system log filters
- `export_jobs` - Export job tracking
- `cleanup_jobs` - Cleanup job tracking
- `log_level_config` - Per-user log level configuration

## Usage

### Fresh Database Installation

```bash
# Connect to your PostgreSQL database
psql -U postgres -d your_database

# Run the complete schema
\i database_schema_complete.sql
```

### Backup Current Schema

```bash
# Dump schema only (no data)
pg_dump -U postgres -d your_database --schema-only > backup_schema.sql

# Dump schema with data
pg_dump -U postgres -d your_database > backup_full.sql
```

### Verify Installation

```sql
-- Check tables
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Check RLS policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Security

All tables have **Row Level Security (RLS)** enabled with comprehensive policies:

- Users can only access their own data
- Business owners control their business data
- Collection membership controls receipt access
- Audit logs are immutable and access-controlled
- Rate limiting prevents abuse
- IP blocking for security threats

## Key Features

### Multi-Tenancy
- Business-based isolation
- Collection-based access control
- Role-based permissions (owner, admin, manager, member, viewer)

### Audit Trail
- Complete audit logging for all actions
- Immutable audit logs (no updates/deletes)
- IP address and user agent tracking
- Detailed change tracking (before/after values)

### Security
- MFA support (authenticator apps, SMS)
- Account lockout after failed attempts
- Rate limiting on critical endpoints
- IP blocking for repeated violations
- Session management and tracking

### Advanced Features
- Email receipt forwarding
- Multi-page receipt support
- Soft delete with audit trail
- Duplicate detection
- Export jobs (CSV, PDF, ZIP)
- Storage quota management
- Health monitoring and metrics

## Migrations

The original 92 migration files are preserved in `supabase/migrations/` for:
- Historical reference
- Incremental updates
- Rollback capabilities
- Understanding evolution

## Notes

1. **Foreign Key Constraints**: Most use `ON DELETE CASCADE` for data cleanup
2. **Timestamps**: All use `timestamptz` for timezone awareness
3. **Monetary Values**: Use `numeric(10,2)` for precision
4. **JSON Data**: Extensive use of `jsonb` for flexible data storage
5. **Full Text Search**: `pg_trgm` extension enables similarity searches
6. **HTTP Requests**: `pg_net` extension allows database-triggered webhooks

## Support

For issues or questions about the database schema:
1. Check migration files in `supabase/migrations/`
2. Review TypeScript types in `src/lib/database.types.ts`
3. Consult documentation in `documentation/` directory
