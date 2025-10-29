# Database Rebuild Scripts

Modular scripts for completely wiping and rebuilding the Supabase database.

## Structure

```
scripts/
├── 00-config.sh                   # Shared configuration and functions
├── 01-validate-environment.sh     # Environment validation and .env checks
├── 02-backup.sh                   # Backup .env file
├── 03-stop-services.sh            # Stop all Docker services
├── 04-wipe-database.sh            # Drop all schemas
├── 05-update-encryption-key.sh    # Generate new VAULT_ENC_KEY
├── 06-apply-migrations.sh         # Apply all SQL migrations
├── 07-verify-schema.sh            # Verify database structure
├── 08-start-services.sh           # Start all Docker services
├── 09-health-check.sh             # Comprehensive health checks
└── rebuild-database.sh            # Main orchestrator script
```

## Quick Start

```bash
# Copy to your Unraid server
scp -r scripts/ root@192.168.1.246:/mnt/user/appdata/auditproof/

# Run the main script
ssh root@192.168.1.246
cd /mnt/user/appdata/auditproof/
chmod +x scripts/*.sh
./scripts/rebuild-database.sh
```

## What It Does

### Step 1: Environment Validation
- Checks for required commands (docker, openssl, sed, grep)
- Validates all path locations
- **Validates .env file** with comprehensive checks:
  - Required variables (POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, etc.)
  - Recommended variables (SMTP settings)
  - VAULT_ENC_KEY length (must be 64 chars)
  - JWT_SECRET strength (recommends 32+ chars)
  - POSTGRES_PASSWORD strength (recommends 20+ chars)
- Verifies Docker is running

### Step 2: Backup
- Creates timestamped backup of .env file
- Stores location for cleanup instructions

### Step 3: Stop Services
- Gracefully stops all Supabase containers

### Step 4: Wipe Database
- Starts database container
- Drops ALL schemas (public, auth, storage, _supavisor)
- Verifies database is empty

### Step 5: Update Encryption Key
- Generates new 64-character hex key (32 bytes)
- Updates VAULT_ENC_KEY in .env
- Verifies the update

### Step 6: Apply Migrations
- Applies all migrations in order
- Tracks success/failure for each
- Lists failed migrations if any

### Step 7: Verify Schema
- Shows all created schemas
- Displays table counts per schema

### Step 8: Start Services
- Starts all Supabase containers
- Waits for initialization

### Step 9: Health Check
- Database connection test
- Auth schema verification
- Storage schema verification
- Public schema verification
- Supavisor/pooler status
- Kong (API Gateway) check
- Studio check

## Running Individual Scripts

Each script can be run independently:

```bash
# Validate environment only
./scripts/01-validate-environment.sh

# Just check health
./scripts/09-health-check.sh

# Apply migrations only (requires running database)
./scripts/06-apply-migrations.sh
```

## Configuration

Edit `scripts/00-config.sh` to change:
- Base directory paths
- Required environment variables
- Recommended variables
- Color codes

## Logs

All operations are logged to:
```
/tmp/database-rebuild-YYYYMMDD_HHMMSS.log
```

## Safety Features

1. **Confirmation Required** - Must type "YES" to proceed
2. **Automatic Backups** - .env file backed up before changes
3. **Detailed Logging** - Every command logged to file
4. **Error Handling** - Scripts exit on critical errors
5. **Validation First** - Environment checked before any destructive actions

## Environment Variables Checked

### Required
- POSTGRES_PASSWORD
- JWT_SECRET
- ANON_KEY
- SERVICE_ROLE_KEY
- DASHBOARD_USERNAME
- DASHBOARD_PASSWORD
- VAULT_ENC_KEY
- POSTGRES_HOST
- POSTGRES_DB
- POSTGRES_PORT
- SITE_URL
- API_EXTERNAL_URL

### Recommended
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS
- SMTP_SENDER_NAME

## Troubleshooting

If the script fails:

1. Check the log file location shown at start
2. Look for "✗" marks indicating failures
3. Review failed migration names
4. Check Docker container status: `docker compose ps`
5. View specific logs: `docker logs supabase-db`

## Exit Codes

- `0` - Success
- `1` - Errors occurred (check logs)
