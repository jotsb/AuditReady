# Standalone Script Execution Guide

All infrastructure scripts can be run independently for maintenance, updates, or troubleshooting.

## Prerequisites for Standalone Execution

Each script requires:
1. **00-config.sh** in the same directory
2. **Proper paths** configured (will prompt if not set)
3. **Secrets** (for scripts that need them)

## Running Scripts Individually

### 1. Validate Paths Only

```bash
cd /mnt/user/appdata/auditproof/project/AuditReady/infrastructure-scripts
./01-validate-paths.sh
```

This will:
- Prompt for all paths (or use defaults)
- Validate directories exist
- Create required directories
- Save configuration to `.infrastructure-paths`

### 2. Backup Only

```bash
./02-backup-all.sh
```

Creates backup without making any changes. Useful before manual updates.

### 3. Regenerate Secrets

```bash
./03-generate-secrets.sh
```

**WARNING**: This generates NEW secrets. Only use if:
- Setting up for the first time
- Need to rotate secrets
- **NOT recommended after initial setup** (will break Supavisor encryption)

### 4. Reconfigure Environment Files

```bash
./04-configure-env.sh
```

Regenerates .env files from current secrets. Useful after:
- Manual secret updates
- Adding SMTP credentials
- Changing domain/URLs

### 5. Rebuild Frontend Only

```bash
./05-build-frontend.sh
```

Rebuilds and deploys frontend without touching backend. Use when:
- Frontend code changes
- UI updates needed
- No database/backend changes

### 6. Reconfigure Nginx

```bash
./06-setup-nginx.sh
```

Regenerates nginx.conf. Use when:
- Updating CSP headers
- Changing security settings
- Modifying proxy configuration

### 7. Redeploy Edge Functions

```bash
./07-copy-functions.sh
```

Copies edge functions from source to volumes. Use when:
- Function code updated
- Adding new functions
- Fixing function issues

### 8. Database Operations

```bash
./08-setup-database.sh
```

**WARNING**: This applies migrations and creates buckets. Only use:
- Initial setup
- After adding new migrations
- **Not recommended on production with data**

### 9. Restart Services

```bash
./09-start-services.sh
```

Restarts all Supabase services including Supavisor. Use when:
- After .env changes
- Service issues
- Need clean restart

### 10. Restart Frontend Container

```bash
./10-start-frontend.sh
```

Restarts only the frontend container. Use when:
- Frontend not responding
- After nginx.conf changes
- After rebuilding frontend

### 11. Verify Installation

```bash
./11-verify-all.sh
```

Can run anytime to check system health:
- Verifies all containers running
- Checks Supavisor health
- Confirms admin user exists
- Tests frontend accessibility
- No changes made

### 99. Reset Everything

```bash
./99-reset-infrastructure.sh
```

**DANGER**: This DESTROYS everything! Use only when:
- Starting completely fresh
- Major issues requiring clean slate
- Testing deployment process

## Common Scenarios

### Scenario 1: Update Frontend Code

```bash
cd /mnt/user/appdata/auditproof/project/AuditReady/infrastructure-scripts

# Build and deploy frontend
./05-build-frontend.sh

# Restart frontend container
./10-start-frontend.sh

# Verify it's working
./11-verify-all.sh
```

### Scenario 2: Add/Update Edge Function

```bash
# Copy functions
./07-copy-functions.sh

# Restart services to pick up changes
./09-start-services.sh

# Verify
./11-verify-all.sh
```

### Scenario 3: Update SMTP Configuration

```bash
# 1. Edit secrets.txt
vim /mnt/user/appdata/auditproof/secrets.txt

# 2. Update SMTP_USER and SMTP_PASS

# 3. Regenerate .env files
./04-configure-env.sh

# 4. Restart services
./09-start-services.sh

# 5. Verify
./11-verify-all.sh
```

### Scenario 4: Apply New Migration

```bash
# 1. Add migration to supabase/migrations/

# 2. Run database setup (applies only new migrations)
./08-setup-database.sh

# 3. Restart services
./09-start-services.sh

# 4. Verify
./11-verify-all.sh
```

### Scenario 5: Update CSP Headers

```bash
# 1. Edit the nginx script to change CSP
vim 06-setup-nginx.sh

# 2. Regenerate nginx.conf
./06-setup-nginx.sh

# 3. Restart frontend
./10-start-frontend.sh

# 4. Test in browser
./11-verify-all.sh
```

### Scenario 6: Complete Health Check

```bash
# Just run verification
./11-verify-all.sh
```

This checks:
- All containers running
- Supavisor health
- Database connectivity
- Frontend responding
- Admin user exists

### Scenario 7: Restart After Server Reboot

```bash
# Start services
./09-start-services.sh

# Start frontend
./10-start-frontend.sh

# Verify
./11-verify-all.sh
```

## Script Dependencies

Some scripts depend on outputs from others:

```
01-validate-paths.sh
  └─> Creates: .infrastructure-paths

02-backup-all.sh
  └─> Creates: backups/infrastructure_TIMESTAMP/

03-generate-secrets.sh
  ├─> Creates: secrets.txt
  └─> Creates: /tmp/infrastructure_secrets.env

04-configure-env.sh
  ├─> Requires: /tmp/infrastructure_secrets.env
  ├─> Creates: supabase-project/.env
  └─> Creates: project/AuditReady/.env

05-build-frontend.sh
  ├─> Requires: project/AuditReady/.env
  └─> Creates: supabase-project/volumes/dist/

06-setup-nginx.sh
  └─> Creates: supabase-project/volumes/config/nginx.conf

07-copy-functions.sh
  └─> Creates: supabase-project/volumes/functions/

08-setup-database.sh
  ├─> Requires: docker services running
  └─> Requires: migrations in supabase/migrations/

09-start-services.sh
  └─> Requires: supabase-project/.env

10-start-frontend.sh
  ├─> Requires: volumes/dist/
  └─> Requires: volumes/config/nginx.conf

11-verify-all.sh
  └─> No requirements (read-only)
```

## Safety Checks

Before running scripts standalone:

1. **Always backup first**:
   ```bash
   ./02-backup-all.sh
   ```

2. **Check what's running**:
   ```bash
   docker ps
   ```

3. **Verify paths are correct**:
   ```bash
   cat /mnt/user/appdata/auditproof/.infrastructure-paths
   ```

4. **Check logs if something fails**:
   ```bash
   tail -f /mnt/user/appdata/auditproof/logs/infrastructure_setup_*.log
   ```

## Important Notes

### Supavisor Encryption

**CRITICAL**: Never run `03-generate-secrets.sh` after initial setup if Supavisor has encrypted data! The VAULT_ENC_KEY is used to encrypt connection strings. Changing it will break Supavisor.

If you need to rotate secrets:
1. Stop Supavisor
2. Clear encrypted data
3. Generate new secrets
4. Restart with clean state

### Script Order Matters

When running multiple scripts, follow this order:

1. Validate paths (01)
2. Backup (02)
3. Generate secrets (03) - only on first run!
4. Configure env (04)
5. Build/setup steps (05-08)
6. Start services (09-10)
7. Verify (11)

### Standalone vs Full Setup

| Script | Standalone Safe? | Notes |
|--------|------------------|-------|
| 01 | ✅ Yes | Always safe |
| 02 | ✅ Yes | Always safe |
| 03 | ⚠️ Caution | Don't run after initial setup |
| 04 | ✅ Yes | Safe if secrets exist |
| 05 | ✅ Yes | Safe, rebuilds frontend |
| 06 | ✅ Yes | Safe, regenerates config |
| 07 | ✅ Yes | Safe, copies functions |
| 08 | ⚠️ Caution | Can affect database |
| 09 | ✅ Yes | Restarts services |
| 10 | ✅ Yes | Restarts frontend |
| 11 | ✅ Yes | Always safe (read-only) |
| 99 | ❌ Dangerous | DESTROYS everything! |

## Troubleshooting

### "00-config.sh not found"

```bash
# Make sure you're in the right directory
cd /mnt/user/appdata/auditproof/project/AuditReady/infrastructure-scripts
ls -la 00-config.sh
```

### "Secrets not found"

```bash
# Check if secrets exist
cat /mnt/user/appdata/auditproof/secrets.txt

# If missing, run full setup or regenerate
./03-generate-secrets.sh
```

### "Path not found" errors

```bash
# Reconfigure paths
./01-validate-paths.sh
```

### Script hangs or fails

```bash
# Check logs
tail -f /mnt/user/appdata/auditproof/logs/infrastructure_setup_*.log

# Check Docker
docker ps
docker logs [container-name]
```

---

**Remember**: When in doubt, run `./11-verify-all.sh` to check system status before making changes!
