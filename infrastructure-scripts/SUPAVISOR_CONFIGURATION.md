# Supavisor Configuration Guide

Supavisor is the connection pooler for Supabase. It's **ENABLED** by default in this setup.

## Why Supavisor is Enabled

Supavisor provides:
- Connection pooling for PostgreSQL
- Better resource management
- Support for multiple projects sharing same database
- Scalability for future growth

## Required Configuration

All required Supavisor variables are automatically configured:

### 1. VAULT_ENC_KEY (Most Critical!)

- **Size**: 64 hexadecimal characters (32 bytes for AES-256)
- **Generated**: Automatically by `03-generate-secrets.sh`
- **Purpose**: Encrypts connection strings and sensitive data
- **Format**: `openssl rand -hex 32`

**CRITICAL**: This key MUST NOT change after initial setup! Supavisor uses it to encrypt data. Changing it will cause "decryption failed" errors.

### 2. POOLER_TENANT_ID

- **Size**: 32 hexadecimal characters (16 bytes)
- **Generated**: Automatically
- **Purpose**: Identifies the tenant in multi-tenant setups
- **Format**: `openssl rand -hex 16`

### 3. REGION

- **Value**: `local`
- **Purpose**: Identifies region for routing
- **Set**: Automatically to "local" for self-hosted

### 4. ERL_AFLAGS

- **Value**: `-proto_dist inet_tcp`
- **Purpose**: Erlang distribution protocol flags
- **Set**: Automatically for proper networking

### 5. CLUSTER_POSTGRES

- **Value**: `true`
- **Purpose**: Enables PostgreSQL clustering support
- **Set**: Automatically to true

### 6. SECRET_KEY_BASE

- **Size**: 64 characters
- **Generated**: Automatically
- **Purpose**: Phoenix framework secret key
- **Used by**: Supavisor's web interface

### 7. DATABASE_URL

- **Format**: `postgresql://user:password@host:port/database`
- **Generated**: Automatically from POSTGRES_PASSWORD
- **Purpose**: Connection to underlying PostgreSQL

## Configuration Files

All Supavisor variables are set in:

### 1. secrets.txt
```bash
# Location: /mnt/user/appdata/auditproof/secrets.txt
VAULT_ENC_KEY=<64 hex chars>
POOLER_TENANT_ID=<32 hex chars>
REGION=local
ERL_AFLAGS=-proto_dist inet_tcp
CLUSTER_POSTGRES=true
SECRET_KEY_BASE=<64 chars>
DATABASE_URL=postgresql://...
```

### 2. .env (Docker)
```bash
# Location: /mnt/user/appdata/auditproof/supabase-project/.env
VAULT_ENC_KEY=<value>
POOLER_TENANT_ID=<value>
REGION=local
ERL_AFLAGS=-proto_dist inet_tcp
CLUSTER_POSTGRES=true
SECRET_KEY_BASE=<value>
```

## Verification

After setup, verify Supavisor is running:

```bash
# Check container is running
docker ps | grep supabase-pooler

# Check health status
docker inspect --format='{{.State.Health.Status}}' supabase-pooler

# Should return: healthy
```

## Troubleshooting

### Error: "Decryption failed"

**Cause**: VAULT_ENC_KEY was changed after Supavisor encrypted data

**Solution**:
1. If just set up, stop and clear:
   ```bash
   cd /mnt/user/appdata/auditproof/supabase-project
   docker compose down -v
   ./infrastructure-scripts/09-start-services.sh
   ```

2. If in production, DO NOT change VAULT_ENC_KEY!

### Supavisor Not Starting

**Check logs**:
```bash
docker logs supabase-pooler
```

**Common issues**:
- VAULT_ENC_KEY wrong length (must be 64 hex chars)
- DATABASE_URL incorrect
- PostgreSQL not ready yet

**Fix**:
```bash
# Verify secrets
cat /mnt/user/appdata/auditproof/secrets.txt | grep VAULT_ENC_KEY | wc -c
# Should be 80 (64 chars + "VAULT_ENC_KEY=" + newline)

# Verify database
docker exec supabase-db pg_isready -U postgres

# Restart services
./infrastructure-scripts/09-start-services.sh
```

### Connection Pool Exhausted

If you see connection errors:

**Check pool settings** in docker-compose.yml:
```yaml
supavisor:
  environment:
    POOL_SIZE: "10"  # Adjust as needed
    MAX_OVERFLOW: "20"
```

### Supavisor Health Check Failing

**Wait longer**: Supavisor can take 30-60 seconds to become healthy

**Check dependencies**:
```bash
# Database must be ready first
docker exec supabase-db pg_isready -U postgres

# Kong must be running
docker ps | grep supabase-kong
```

## Using Supavisor

### Connection Through Supavisor

Supavisor listens on different ports:

- **Transaction mode**: Port 6543
- **Session mode**: Port 5432 (default)

Connection string example:
```
postgresql://postgres.tenant:password@supabase-pooler:5432/postgres
```

### Connection Modes

1. **Transaction Mode** (Port 6543)
   - Connection held only during transaction
   - Best for serverless functions
   - Most efficient

2. **Session Mode** (Port 5432)
   - Connection held for entire session
   - Required for prepared statements
   - Used by most ORMs

## Sharing Database Across Projects

To use Supavisor with multiple Supabase projects:

1. **Keep VAULT_ENC_KEY the same** across all projects
2. **Use different POOLER_TENANT_ID** for each project
3. **Configure different PROJECT_REF** for each

Example for second project:
```bash
# Project 1 (AuditProof)
POOLER_TENANT_ID=abc123def456...
PROJECT_REF=auditproof

# Project 2 (Another App)
POOLER_TENANT_ID=xyz789uvw012...  # DIFFERENT!
PROJECT_REF=anotherapp

# Same database, same VAULT_ENC_KEY
DATABASE_URL=postgresql://postgres:password@db:5432/postgres
VAULT_ENC_KEY=<SAME FOR BOTH>
```

## Security Best Practices

1. **Never commit VAULT_ENC_KEY** to version control
2. **Backup secrets.txt** securely
3. **Never change VAULT_ENC_KEY** after initial setup
4. **Use transaction mode** for serverless functions
5. **Monitor connection counts** to avoid exhaustion

## Monitoring

### Check Connection Count

```bash
docker exec -i supabase-db psql -U postgres -d postgres << SQL
SELECT count(*) FROM pg_stat_activity;
SQL
```

### Check Supavisor Metrics

```bash
# Supavisor exposes metrics on port 4000
curl http://localhost:4000/metrics
```

### View Supavisor Logs

```bash
docker logs -f supabase-pooler
```

## Migration Notes

If migrating from setup **without** Supavisor:

1. **Generate secrets** with proper VAULT_ENC_KEY
2. **Stop all services**:
   ```bash
   docker compose down -v
   ```
3. **Update docker-compose.yml** to uncomment Supavisor
4. **Configure all env vars** as documented above
5. **Start fresh**:
   ```bash
   ./infrastructure-scripts/09-start-services.sh
   ```

**Do NOT** try to enable Supavisor on running system with data!

## Summary

✅ **Supavisor is ENABLED** by default
✅ **All variables configured** automatically
✅ **Proper key sizes** (VAULT_ENC_KEY: 64 hex)
✅ **Ready for multiple projects** sharing database
✅ **Production-ready** configuration

The key to successful Supavisor operation:
1. Generate secrets ONCE at initial setup
2. NEVER change VAULT_ENC_KEY after that
3. Use proper 64-character hex key size
4. Wait for health checks to pass

---

**Generated by**: AuditProof Infrastructure Setup
**Version**: 1.0.0
**Supavisor**: Enabled by default
