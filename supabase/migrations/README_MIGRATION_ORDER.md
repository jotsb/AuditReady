# Database Migration Guide for Self-Hosted Supabase

This guide explains how to properly set up the AuditProof database on a self-hosted Supabase instance (like Unraid).

## Problem with Original Migrations

The original migrations were designed to run incrementally on Bolt.new's managed Supabase, which already has:
- Pre-installed PostgreSQL extensions
- Pre-configured storage buckets
- Auth system fully initialized
- Helper functions already present

When running on a fresh self-hosted Supabase, these prerequisites don't exist, causing migrations to fail.

## Solution: Prerequisites Migration

A new migration file `00000000000000_initial_setup_prerequisites.sql` has been created that **MUST** run first.

## Migration Order

### Step 1: Initial Setup (Run Once)

```bash
# From your Unraid server, in the project directory
psql -h localhost -U postgres -d postgres -f supabase/migrations/00000000000000_initial_setup_prerequisites.sql
```

This creates:
- ✅ PostgreSQL extensions (uuid-ossp, pg_net, pg_trgm)
- ✅ Storage bucket configuration (receipts bucket)
- ✅ Basic storage RLS policies
- ✅ Helper functions (logging stubs, role checkers)
- ✅ Profile creation trigger function

### Step 2: Core Schema

```bash
psql -h localhost -U postgres -d postgres -f supabase/migrations/20251006010328_create_auditready_schema.sql
```

This creates:
- All core tables (profiles, businesses, collections, receipts, etc.)
- RLS policies for all tables
- Indexes for performance
- Updated_at triggers
- Profile creation trigger on auth.users

### Step 3: Run Remaining Migrations in Order

Run all other migrations in chronological order (sorted by filename):

```bash
# Run all migrations in order
for file in supabase/migrations/202*.sql; do
  echo "Running: $file"
  psql -h localhost -U postgres -d postgres -f "$file"
done
```

## Using Supabase CLI (Recommended)

If you have Supabase CLI installed:

```bash
# Link to your local Supabase instance
supabase link --project-ref local

# Run all migrations in order
supabase db push
```

The CLI automatically handles migration order based on timestamps.

## What Each Key Migration Does

| Migration | Purpose |
|-----------|---------|
| `00000000000000_initial_setup_prerequisites.sql` | Sets up prerequisites (extensions, storage, helpers) |
| `20251006010328_create_auditready_schema.sql` | Core database schema and tables |
| `20251006213000_phase1_rbac_system.sql` | RBAC system (roles, permissions, business members) |
| `20251007145424_add_comprehensive_logging_system.sql` | System and audit logging infrastructure |
| `20251009165000_add_mfa_recovery_codes.sql` | MFA and recovery code support |
| `20251011035121_add_business_management_phase2.sql` | Business suspension and storage tracking |
| `20251013050000_add_email_receipt_support.sql` | Email-to-receipt functionality |
| `20251015120000_security_hardening_phase_a.sql` | Security enhancements (rate limiting, etc.) |
| `20251026000000_add_duplicate_detection_and_admin_features.sql` | Duplicate detection and admin tools |

## Verification

After running all migrations, verify setup:

```sql
-- Check tables exist
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Should return 30+ tables

-- Check extensions installed
SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_net', 'pg_trgm');
-- Should return 3 rows

-- Check storage bucket exists
SELECT id, name, public FROM storage.buckets WHERE id = 'receipts';
-- Should return 1 row

-- Check RLS is enabled
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (SELECT tablename FROM pg_tables WHERE rowsecurity = false AND schemaname = 'public');
-- Should return all your tables
```

## Common Issues

### Issue: "extension does not exist"
**Solution**: Run the prerequisites migration first (`00000000000000_initial_setup_prerequisites.sql`)

### Issue: "relation storage.buckets does not exist"
**Solution**: Ensure Supabase is fully initialized. Wait 60 seconds after starting docker-compose, then run prerequisites.

### Issue: "function log_system_event does not exist"
**Solution**: The prerequisites migration creates stub functions. Later migrations will replace them with full implementations.

### Issue: "trigger on_auth_user_created already exists"
**Solution**: This is normal. The migration drops existing triggers before creating them.

## Bolt Cloud vs Self-Hosted

| Feature | Bolt Cloud | Self-Hosted Unraid |
|---------|------------|-------------------|
| Extensions | Pre-installed | Must install via migration |
| Storage Buckets | Auto-created | Must create via migration |
| Auth System | Fully configured | Basic config, needs setup |
| Helper Functions | Already present | Must create via migration |
| Profile Trigger | Already exists | Must create explicitly |

## Next Steps After Migrations

1. **Configure Auth** - Set up email templates, SMTP, etc.
2. **Configure Storage** - Ensure storage path is mounted correctly
3. **Test Signup** - Create a test user to verify profile creation works
4. **Import Data** - If migrating from Bolt, import your data
5. **Test Application** - Verify frontend can connect and operate

## Backup Before Migration

Always backup before running migrations:

```bash
# Backup entire database
pg_dump -h localhost -U postgres -d postgres > backup_before_migration.sql

# Backup just schema
pg_dump -h localhost -U postgres -d postgres --schema-only > backup_schema.sql

# Backup just data
pg_dump -h localhost -U postgres -d postgres --data-only > backup_data.sql
```

## Rollback

If something goes wrong:

```bash
# Drop and recreate database
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS postgres;"
psql -h localhost -U postgres -c "CREATE DATABASE postgres;"

# Restore from backup
psql -h localhost -U postgres -d postgres < backup_before_migration.sql

# Or restore using Supabase
supabase db reset
```

## Support

If you encounter issues:
1. Check the PostgreSQL logs: `docker logs supabase-db`
2. Verify Supabase services are running: `docker-compose ps`
3. Check migration error messages carefully
4. Ensure you're running PostgreSQL 15+ with all Supabase extensions
