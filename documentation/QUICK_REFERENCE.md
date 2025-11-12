# Migration Quick Reference

## Fast Commands

### Run Migrations (Start Here)
```bash
./run-migrations.sh
```

### Check Environment First
```bash
./pre-flight-check.sh
```

### Verify After Completion
```bash
./verify-migrations.sh
```

### Re-run Everything
```bash
./run-migrations.sh --reset
```

### Analyze for Issues
```bash
./analyze-migrations.sh
```

## Common Scenarios

### First Time Setup
```bash
./pre-flight-check.sh    # Verify environment
./run-migrations.sh      # Run all migrations
./verify-migrations.sh   # Confirm success
```

### Migration Failed
```bash
# 1. Read the error message
# 2. Check which migration failed
# 3. Review that migration file
# 4. Fix the issue
# 5. Re-run (continues from failure)
./run-migrations.sh
```

### Start From Scratch
```bash
# Back up first!
docker exec -i supabase-db pg_dump -U postgres -d postgres > backup.sql

# Reset and re-run
./run-migrations.sh --reset
```

### Check Status
```bash
docker exec -i supabase-db psql -U postgres -d postgres -c \
  'SELECT COUNT(*) as applied FROM schema_migrations;'
```

## File Reference

| File | Purpose |
|------|---------|
| `run-migrations.sh` | Main migration runner |
| `pre-flight-check.sh` | Environment validation |
| `verify-migrations.sh` | Post-migration validation |
| `analyze-migrations.sh` | Find potential conflicts |
| `MIGRATION_GUIDE.md` | Detailed usage guide |
| `MIGRATION_FIXES_SUMMARY.md` | What was fixed |
| `SOLUTION_SUMMARY.md` | Root cause analysis |

## Key Numbers

- **Total Migrations**: 78
- **Critical Tables**: 30+
- **Required Extensions**: 3 (uuid-ossp, pg_net, pg_trgm)
- **Storage Buckets**: 1 (receipts)

## Troubleshooting

| Error | Solution |
|-------|----------|
| Container not found | `docker-compose up -d` |
| Cannot connect | Check logs: `docker logs supabase-db` |
| Policy exists | Migration needs `DROP POLICY IF EXISTS` |
| Column exists | Migration needs `IF NOT EXISTS` |
| Function conflict | Migration needs `DROP FUNCTION IF EXISTS` |

## Success Indicators

✓ All migrations applied
✓ 30+ tables created
✓ RLS enabled on all tables
✓ All extensions installed
✓ Storage bucket exists
✓ No critical errors

## Documentation

- **Getting Started**: `MIGRATION_GUIDE.md`
- **What Changed**: `MIGRATION_FIXES_SUMMARY.md`
- **Why It Works**: `SOLUTION_SUMMARY.md`
- **Quick Help**: This file

## Support Flow

1. Read error message
2. Check `MIGRATION_GUIDE.md` troubleshooting section
3. Review specific migration file
4. Check PostgreSQL logs if needed
5. Fix and re-run

---

**Most Common Command**: `./run-migrations.sh`

**Most Common Issue**: Container not running → `docker-compose up -d`

**Best Practice**: Always run `./pre-flight-check.sh` first
