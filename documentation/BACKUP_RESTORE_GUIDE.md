# Database Backup and Restore Guide

Complete guide for backing up your Bolt.new Supabase database and restoring it to your local Unraid setup.

## Overview

This process allows you to:
1. Create a complete backup of your Bolt.new database (schema + data)
2. Restore it to your self-hosted Unraid Supabase instance
3. Migrate all users, receipts, and business data seamlessly

## Prerequisites

### On Your Local Machine (for backup)
- PostgreSQL client tools (`pg_dump`, `psql`)
- Access to your Bolt.new Supabase project
- Database password from Bolt/Supabase dashboard

### On Your Unraid Server (for restore)
- Self-hosted Supabase instance running
- `.env.supabase.production` file configured
- Docker and docker-compose installed

## Step-by-Step Process

### Step 1: Get Your Bolt Database Password

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `mnmfwqfbksughmthfutg`
3. Navigate to **Settings** → **Database**
4. Copy the database password (under "Connection string")

### Step 2: Run Backup on Local Machine

```bash
# Navigate to project directory
cd /path/to/audit-proof

# Run backup script
./scripts/backup-bolt-database.sh
```

The script will:
- Prompt for your Bolt database password
- Create `backups/` directory
- Generate two files:
  - `bolt_database_backup_YYYYMMDD_HHMMSS.sql` (schema)
  - `bolt_database_data_YYYYMMDD_HHMMSS.sql` (data)

**Example output:**
```
═══════════════════════════════════════════════
  BOLT DATABASE BACKUP UTILITY
═══════════════════════════════════════════════

✓ Created backup directory: ./backups
Enter Bolt database password: ********

Testing connection to Bolt database...
✓ Connected successfully!

Backing up database schema...
✓ Schema backed up to: backups/bolt_database_backup_20250130_143022.sql

Backing up database data...
✓ Data backed up to: backups/bolt_database_data_20250130_143022.sql

═══════════════════════════════════════════════
  BACKUP COMPLETED SUCCESSFULLY
═══════════════════════════════════════════════

Schema backup: backups/bolt_database_backup_20250130_143022.sql (125K)
Data backup:   backups/bolt_database_data_20250130_143022.sql (2.3M)
```

### Step 3: Transfer Files to Unraid

Copy both backup files to your Unraid server:

```bash
# Using SCP
scp backups/bolt_database_backup_*.sql root@unraid-server:/mnt/user/appdata/audit-proof/backups/
scp backups/bolt_database_data_*.sql root@unraid-server:/mnt/user/appdata/audit-proof/backups/

# Or using rsync
rsync -avz backups/*.sql root@unraid-server:/mnt/user/appdata/audit-proof/backups/
```

### Step 4: Stop Frontend (Optional but Recommended)

On your Unraid server, stop the frontend to prevent users from accessing during restore:

```bash
cd /mnt/user/appdata/audit-proof
docker-compose stop frontend
```

### Step 5: Run Restore on Unraid

SSH into your Unraid server and run:

```bash
cd /mnt/user/appdata/audit-proof

# Run restore script with both backup files
./scripts/restore-to-unraid.sh \
  backups/bolt_database_backup_20250130_143022.sql \
  backups/bolt_database_data_20250130_143022.sql
```

The script will:
- Confirm you want to proceed (⚠️ destructive operation)
- Test connection to your Unraid database
- Drop existing public schema
- Restore schema structure
- Restore all data
- Verify restoration

**Example output:**
```
═══════════════════════════════════════════════
  RESTORE DATABASE TO UNRAID
═══════════════════════════════════════════════

✓ Found schema backup: backups/bolt_database_backup_20250130_143022.sql
✓ Found data backup: backups/bolt_database_data_20250130_143022.sql

Target Unraid Database:
  Host: db
  Port: 5432
  Database: postgres

⚠️  WARNING: This will REPLACE your Unraid database!
   All existing data will be lost!

Are you sure you want to continue? (yes/no): yes

Testing connection to Unraid database...
✓ Connected successfully!

Dropping existing public schema...
✓ Schema dropped and recreated

Restoring database schema...
✓ Schema restored

Restoring database data...
✓ Data restored

Verifying restoration...
✓ Found 37 tables in public schema

═══════════════════════════════════════════════
  RESTORE COMPLETED SUCCESSFULLY
═══════════════════════════════════════════════
```

### Step 6: Restart Supabase Services

```bash
# Restart all services to pick up the new database
docker-compose restart

# Or restart specific services
docker-compose restart kong postgrest realtime storage
```

### Step 7: Update Frontend Configuration

Update your frontend `.env` file to point to your Unraid instance:

```bash
# Edit .env file
nano .env

# Change these values:
VITE_SUPABASE_URL=https://your-unraid-domain.com
VITE_SUPABASE_ANON_KEY=<your-unraid-anon-key>
```

The anon key can be found in `.env.supabase.production` on your Unraid server.

### Step 8: Start Frontend

```bash
docker-compose start frontend
```

### Step 9: Verify Everything Works

1. Open your Audit Proof app: `https://your-unraid-domain.com`
2. Log in with your existing credentials
3. Verify your data:
   - Check businesses
   - Check receipts
   - Check team members
   - Test uploading a new receipt

## Storage Migration (Receipts/Images)

The database backup does NOT include storage files (receipt images). To migrate storage:

### Option 1: Download from Bolt Storage

```bash
# Use Supabase CLI to download storage
npx supabase storage download --project-ref mnmfwqfbksughmthfutg receipts

# Upload to Unraid storage
npx supabase storage upload receipts/*.* --project-ref <unraid-project>
```

### Option 2: Manual Migration Script

Create a script to copy files:

```bash
#!/bin/bash
# Download all receipts from Bolt storage
# Upload to Unraid storage
# This requires Supabase service role key
```

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to Bolt database

**Solution:**
- Verify you're using the correct password
- Check if your IP is whitelisted in Supabase dashboard
- Try connecting via pgAdmin to test credentials

### Restore Failures

**Problem:** Restore script fails with permission errors

**Solution:**
```bash
# Ensure you're in the correct directory
cd /mnt/user/appdata/audit-proof

# Check .env.supabase.production exists
ls -la .env.supabase.production

# Verify PostgreSQL password is correct
grep POSTGRES_PASSWORD .env.supabase.production
```

### Missing Tables After Restore

**Problem:** Some tables are missing after restore

**Solution:**
```bash
# Run the complete schema file as backup
docker exec supabase-db psql -U postgres -d postgres -f /path/to/database_schema_complete.sql

# Then restore data only
./scripts/restore-to-unraid.sh backups/data_file.sql
```

### Auth Issues After Migration

**Problem:** Users cannot log in after migration

**Solution:**
1. Check that `auth.users` table was migrated
2. Verify JWT_SECRET matches between Bolt and Unraid
3. Update SITE_URL in `.env.supabase.production`
4. Restart auth service: `docker-compose restart auth`

## Best Practices

### Regular Backups

Set up automated backups:

```bash
# Add to crontab for daily backups at 2 AM
0 2 * * * cd /mnt/user/appdata/audit-proof && ./scripts/backup-bolt-database.sh
```

### Before Major Updates

Always backup before:
- Supabase version upgrades
- Major schema changes
- Before running new migrations
- Testing new features in production

### Backup Retention

Keep at least:
- Daily backups for 7 days
- Weekly backups for 4 weeks
- Monthly backups for 12 months

### Test Restores

Periodically test your backups:
1. Spin up a test Supabase instance
2. Restore from backup
3. Verify data integrity
4. Document any issues

## Quick Reference Commands

```bash
# Backup from Bolt
./scripts/backup-bolt-database.sh

# Transfer to Unraid
scp backups/*.sql root@unraid:/path/to/backups/

# Restore on Unraid
./scripts/restore-to-unraid.sh backups/schema.sql backups/data.sql

# Restart services
docker-compose restart

# Check service status
docker-compose ps

# View logs
docker-compose logs -f kong postgrest
```

## Security Notes

1. **Backup Security**: Backups contain sensitive data. Store securely and encrypt if needed.
2. **Password Protection**: Never commit database passwords to git.
3. **Access Control**: Limit who can access backup files.
4. **Encryption**: Consider encrypting backups at rest.

## Support

If you encounter issues:
1. Check logs: `docker-compose logs -f`
2. Verify database connection: `docker exec supabase-db psql -U postgres`
3. Review Supabase docs: https://supabase.com/docs
4. Check the troubleshooting section above

## Related Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Unraid Migration Guide](./UNRAID_MIGRATION_GUIDE.md)
- [Database Schema Summary](../DATABASE_SCHEMA_SUMMARY.md)
- [Infrastructure Setup](./INFRASTRUCTURE.md)
