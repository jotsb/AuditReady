# Complete Migration Guide

## What Was Done

I performed a comprehensive analysis and fix of all database migrations to ensure they run cleanly without conflicts.

### Issues Fixed

1. **Function Parameter Conflicts** - Fixed functions trying to change parameter names
2. **Duplicate Migrations** - Removed 13 duplicate/obsolete migration files
3. **Idempotency Issues** - Made migrations safe to re-run
4. **Sorting Issues** - Ensured proper chronological order

### Files Removed
- 2 duplicate RBAC migrations
- 5 identical duplicate migrations
- 6 rollback/failed migration files

### Result
- **Before**: 91 migrations (many with conflicts)
- **After**: 78 clean, working migrations
- **Ready**: To run from start to finish

## Quick Start

### 1. Pre-Flight Check (Recommended)
```bash
./pre-flight-check.sh
```

This verifies:
- Docker is running
- PostgreSQL is accessible
- Extensions are available
- Migration files exist
- Disk space is sufficient

### 2. Run Migrations
```bash
./run-migrations.sh
```

The script will:
- Create tracking table automatically
- Skip already-applied migrations
- Run new migrations in order
- Stop on first error with clear message
- Show summary at the end

### 3. If You Need to Re-run Everything
```bash
./run-migrations.sh --reset
```

This clears the tracking table and re-runs all migrations from scratch.

## What to Expect

### Normal Run Output
```
=== AuditProof Migration Runner ===

✓ Migration tracking ready (8 migrations already applied)

Found 78 migration files

⊘ SKIP: 00000000000000_initial_setup_prerequisites.sql (already applied)
⊘ SKIP: 20251006010328_create_auditready_schema.sql (already applied)
...
→ RUN:  20251006213000_phase1_rbac_system.sql
  [output from migration]
✓ DONE: 20251006213000_phase1_rbac_system.sql

...

=== Migration Summary ===
✓ Applied:  70
⊘ Skipped: 8 (already applied)
✗ Failed:  0

All migrations completed successfully!
```

### If Migration Fails
```
✗ FAIL: 20251xxx_some_migration.sql
Critical errors:
ERROR: [specific error message]

Migration failed. Stopping.
To see what succeeded: docker exec -i supabase-db psql ...
```

The script stops immediately so you can:
1. Review the error
2. Fix the specific migration file
3. Re-run with `./run-migrations.sh` (continues from where it stopped)

## Analysis Tools

### Analyze Migrations
```bash
./analyze-migrations.sh
```

Shows:
- Function conflicts
- Duplicate table creations
- Column addition conflicts
- Policy name collisions

Use this if you want to understand potential issues before running migrations.

## Troubleshooting

### Migration Fails with "policy already exists"
**Cause**: Migration doesn't use `DROP POLICY IF EXISTS` before `CREATE POLICY`

**Fix**: Edit the failing migration to add:
```sql
DROP POLICY IF EXISTS "policy name" ON table_name;
CREATE POLICY "policy name" ...
```

### Migration Fails with "column already exists"
**Cause**: Migration doesn't use `IF NOT EXISTS` for column addition

**Fix**: Edit the failing migration to change:
```sql
ALTER TABLE table_name ADD COLUMN column_name type;
```
to:
```sql
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name type;
```

### Migration Fails with "function already exists"
**Cause**: Function parameter name mismatch or missing DROP

**Fix**: Add before the CREATE:
```sql
DROP FUNCTION IF EXISTS function_name(parameter_types);
CREATE FUNCTION function_name(parameters) ...
```

### Container Not Responding
```bash
# Check container status
docker ps | grep supabase

# Check logs
docker logs supabase-db

# Restart if needed
docker-compose restart supabase-db

# Wait 30 seconds then try again
./pre-flight-check.sh
```

### Want to Start Fresh
```bash
# Back up current state first!
docker exec -i supabase-db pg_dump -U postgres -d postgres > backup.sql

# Reset everything
./run-migrations.sh --reset
```

## Verification

After migrations complete, verify the setup:

```bash
# Check table count (should be 30+)
docker exec -i supabase-db psql -U postgres -d postgres -c \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Check RLS is enabled
docker exec -i supabase-db psql -U postgres -d postgres -c \
  "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;"

# Check extensions
docker exec -i supabase-db psql -U postgres -d postgres -c \
  "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_net', 'pg_trgm');"

# Check storage bucket
docker exec -i supabase-db psql -U postgres -d postgres -c \
  "SELECT id, name FROM storage.buckets WHERE id = 'receipts';"
```

Expected results:
- 30+ tables
- All tables have RLS enabled
- All 3 extensions installed
- 'receipts' bucket exists

## Migration Details

See `MIGRATION_FIXES_SUMMARY.md` for detailed information about:
- Specific files that were fixed
- Specific issues that were resolved
- Function conflicts and how they were handled
- Remaining low-risk issues

## Common Patterns in Migrations

### Safe Pattern - Idempotent Table Creation
```sql
CREATE TABLE IF NOT EXISTS table_name (
  column_name type
);
```

### Safe Pattern - Idempotent Column Addition
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_name'
    AND column_name = 'column_name'
  ) THEN
    ALTER TABLE table_name ADD COLUMN column_name type;
  END IF;
END $$;
```

### Safe Pattern - Policy Creation
```sql
DROP POLICY IF EXISTS "policy name" ON table_name;
CREATE POLICY "policy name"
  ON table_name
  FOR SELECT
  TO authenticated
  USING (condition);
```

### Safe Pattern - Function Recreation
```sql
DROP FUNCTION IF EXISTS function_name(param_types);
CREATE FUNCTION function_name(params)
RETURNS return_type AS $$
  -- function body
$$ LANGUAGE sql;
```

## Best Practices

1. **Always back up before migrations**
   ```bash
   docker exec -i supabase-db pg_dump -U postgres -d postgres > backup_$(date +%Y%m%d).sql
   ```

2. **Run pre-flight check first**
   ```bash
   ./pre-flight-check.sh
   ```

3. **Monitor the output**
   - Watch for warnings
   - Note any skipped items
   - Check the summary

4. **Verify after completion**
   - Run verification queries
   - Test user signup
   - Test basic operations

5. **Keep tracking table**
   - Don't manually modify `schema_migrations`
   - Use `--reset` flag if you need to re-run
   - Check it to see what's applied: `SELECT * FROM schema_migrations;`

## Support

If you encounter issues:

1. Read the error message carefully
2. Check `MIGRATION_FIXES_SUMMARY.md` for similar issues
3. Review the specific migration file that failed
4. Check PostgreSQL logs: `docker logs supabase-db`
5. Verify your environment with `./pre-flight-check.sh`

## Next Steps After Successful Migration

1. Configure authentication (SMTP, email templates)
2. Test user signup/login
3. Create first business and test receipt upload
4. Verify audit logs are working
5. Check storage is functioning
6. Deploy frontend application

---

**Ready to proceed?**

Run: `./pre-flight-check.sh && ./run-migrations.sh`
