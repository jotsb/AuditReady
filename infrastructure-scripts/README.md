# AuditProof Infrastructure Setup Scripts

Complete automation for deploying the AuditProof application infrastructure.

## 🚀 Quick Start

```bash
# 1. Upload scripts to your server
scp -r infrastructure-scripts root@192.168.1.246:/mnt/user/appdata/auditproof/project/AuditReady/

# 2. SSH to server
ssh root@192.168.1.246

# 3. Run setup
cd /mnt/user/appdata/auditproof/project/AuditReady/infrastructure-scripts
./00-setup-infrastructure.sh
```

That's it! The script handles everything automatically.

## 📋 What Gets Setup

### Infrastructure
- ✅ PostgreSQL database with all migrations
- ✅ Supabase services (Auth, Storage, Realtime, Functions)
- ✅ Kong API Gateway
- ✅ Frontend container (Nginx + React app)
- ✅ Storage buckets (receipts)
- ✅ Edge functions deployed

### Security
- ✅ All secrets generated with correct sizes
- ✅ JWT tokens (placeholders - update after start)
- ✅ Encryption keys (VAULT_ENC_KEY: 64 hex for AES-256)
- ✅ CSP headers configured
- ✅ RLS policies enforced
- ✅ Supavisor disabled (prevents encryption issues)

### User Setup
- ✅ Admin user created automatically
- ✅ Email/password authentication
- ✅ Profile and roles configured

### Configuration
- ✅ SMTP settings (configure if email needed)
- ✅ OpenAI API integration
- ✅ Environment files (.env) for all services
- ✅ Nginx reverse proxy with security headers

## 📁 Scripts Overview

| # | Script | Purpose |
|---|--------|---------|
| 00 | `00-setup-infrastructure.sh` | **Main orchestrator** - run this |
| 00 | `00-config.sh` | Shared configuration |
| 01 | `01-validate-paths.sh` | Validate/configure paths |
| 02 | `02-backup-all.sh` | Backup existing config |
| 03 | `03-generate-secrets.sh` | Generate all secrets |
| 04 | `04-configure-env.sh` | Create .env files |
| 05 | `05-build-frontend.sh` | Build React application |
| 06 | `06-setup-nginx.sh` | Configure Nginx with CSP |
| 07 | `07-copy-functions.sh` | Deploy edge functions |
| 08 | `08-setup-database.sh` | Setup DB + buckets + admin user |
| 09 | `09-start-services.sh` | Start all services |
| 10 | `10-start-frontend.sh` | Start frontend container |
| 11 | `11-verify-all.sh` | Verify installation |
| 99 | `99-reset-infrastructure.sh` | **Reset everything** |

## 🔐 Generated Secrets

All secrets are cryptographically secure and properly sized:

- `POSTGRES_PASSWORD`: 32 characters
- `JWT_SECRET`: 64 hex characters (32 bytes for HS256)
- `VAULT_ENC_KEY`: 64 hex characters (32 bytes for AES-256)
- `SECRET_KEY_BASE`: 64 characters (session encryption)
- `PG_META_CRYPTO_KEY`: 32 characters
- `DASHBOARD_PASSWORD`: 16 characters
- `ADMIN_PASSWORD`: 16 characters

Saved to: `/mnt/user/appdata/auditproof/secrets.txt` (permissions: 600)

## 📊 Admin User

An admin user is automatically created:

- **Email**: `admin@test.auditproof.ca`
- **Password**: (in secrets.txt)
- **Role**: system_admin
- **Permissions**: Full access to all features

Login at: https://test.auditproof.ca

## 📧 SMTP Configuration

SMTP settings are included in .env but credentials are empty by default:

```bash
SMTP_ADMIN_EMAIL=admin@test.auditproof.ca
SMTP_HOST=mail.smtp2go.com
SMTP_PORT=587
SMTP_USER=           # Configure if needed
SMTP_PASS=           # Configure if needed
```

To enable email:
1. Get SMTP credentials from your provider
2. Update `.env` in `supabase-project/`
3. Restart services: `docker compose restart`

## 🗄️ Storage Buckets

The `receipts` bucket is automatically created with:
- Private access (RLS enforced)
- 50MB file size limit
- Allowed types: JPG, PNG, GIF, WebP, PDF

## 🌐 SWAG Configuration

Ensure SWAG is configured at:
`/mnt/user/appdata/swag/nginx/proxy-confs/auditproof.subdomain.conf`

Required configuration:

```nginx
server {
    listen 443 ssl;
    server_name test.auditproof.ca;

    # Frontend
    location / {
        proxy_pass http://192.168.1.246:8080;
    }

    # Supabase services
    location ~ ^/(functions|auth|rest|storage|realtime)/ {
        proxy_pass http://192.168.1.246:8000;
    }
}
```

The script shows a reminder to verify this configuration.

## 🔄 Path Configuration

Default paths (can be customized during setup):

```
/mnt/user/appdata/auditproof/
├── project/AuditReady/          # Frontend source
├── supabase/                    # Migrations & functions source
└── supabase-project/            # Docker runtime
```

The script prompts for path confirmation on first run.

## ✅ Post-Installation

### 1. Update JWT Tokens

The generated ANON_KEY and SERVICE_ROLE_KEY are demo placeholders. Update them:

```bash
cd /mnt/user/appdata/auditproof/supabase-project

# Get real tokens
docker logs supabase-kong 2>&1 | grep -E "(anon|service_role)"

# Update in both:
# - supabase-project/.env
# - project/AuditReady/.env
```

### 2. Test the Application

Follow the comprehensive test workflow:
```bash
cat /mnt/user/appdata/auditproof/project/AuditReady/workflows/TEST_WORKFLOW.md
```

### 3. Configure Email (Optional)

If you need email functionality:
1. Get SMTP credentials
2. Update `supabase-project/.env`
3. Restart services

## 🧪 Testing

A comprehensive test workflow is provided in:
`/mnt/user/appdata/auditproof/project/AuditReady/workflows/TEST_WORKFLOW.md`

The workflow covers:
- Authentication (signup, login, password reset)
- Business & team management
- Receipt upload and OCR
- Collections and organization
- Reporting and export
- Admin functions
- Security testing (RLS, storage, rate limiting)
- Edge functions
- Performance testing
- Mobile responsiveness

## 🐛 Troubleshooting

### Services Not Starting

```bash
cd /mnt/user/appdata/auditproof/supabase-project
docker compose ps
docker compose logs [service-name]
```

### Frontend Not Accessible

```bash
# Check container
docker ps | grep auditproof-frontend
docker logs auditproof-frontend

# Test locally
curl http://localhost:8080
```

### Database Issues

```bash
# Check database
docker exec supabase-db pg_isready -U postgres

# Connect to database
docker exec -it supabase-db psql -U postgres -d postgres

# View logs
docker logs supabase-db
```

### CSP Errors

If you get Content Security Policy errors:
1. Check `/mnt/user/appdata/auditproof/supabase-project/volumes/config/nginx.conf`
2. Verify CSP header includes your domain
3. Restart frontend: `docker restart auditproof-frontend`

### Admin User Not Created

```bash
# Check if user exists
docker exec -i supabase-db psql -U postgres -d postgres << SQL
SELECT email, role FROM auth.users WHERE email = 'admin@test.auditproof.ca';
SQL

# Manually run creation script
docker exec -i supabase-db psql -U postgres -d postgres < /tmp/create_admin_user.sql
```

## 🔄 Reset and Rebuild

To completely reset and start fresh:

```bash
./99-reset-infrastructure.sh  # Type 'DELETE EVERYTHING' to confirm
./00-setup-infrastructure.sh  # Rebuild
```

This will:
- Stop all containers
- Wipe all volumes
- Remove secrets
- Restore from last backup (if available)

## 📝 Logs

All setup actions are logged to:
`/mnt/user/appdata/auditproof/logs/infrastructure_setup_TIMESTAMP.log`

Check logs if anything fails:
```bash
tail -f /mnt/user/appdata/auditproof/logs/infrastructure_setup_*.log
```

## 💾 Backups

Automatic backups are created before each setup:
`/mnt/user/appdata/auditproof/backups/infrastructure_TIMESTAMP/`

Backups include:
- Docker configuration
- Volume contents
- Project .env files

To restore manually:
```bash
BACKUP=/mnt/user/appdata/auditproof/backups/infrastructure_TIMESTAMP
cp -r $BACKUP/docker/* /mnt/user/appdata/auditproof/supabase-project/
cp -r $BACKUP/volumes/* /mnt/user/appdata/auditproof/supabase-project/volumes/
```

## 🔧 Configuration Files

### Generated Files

- `/mnt/user/appdata/auditproof/secrets.txt` - All secrets (backup this!)
- `/mnt/user/appdata/auditproof/.infrastructure-paths` - Path configuration
- `supabase-project/.env` - Backend environment
- `project/AuditReady/.env` - Frontend environment
- `supabase-project/volumes/config/nginx.conf` - Nginx configuration

### Important Locations

- Docker compose: `supabase-project/docker-compose.yml`
- Migrations: `supabase/migrations/*.sql`
- Functions: `supabase/functions/*/index.ts`
- Frontend build: `supabase-project/volumes/dist/`

## 🔒 Security Notes

1. **Secrets File**: Never commit `secrets.txt` to git
2. **Permissions**: All secret files have 600 permissions
3. **JWT Tokens**: Update demo tokens after first run
4. **HTTPS**: Always use HTTPS in production (via SWAG)
5. **Firewall**: Limit database access to localhost

## 📞 Support

If you encounter issues:

1. Check logs in `/mnt/user/appdata/auditproof/logs/`
2. Verify paths in `.infrastructure-paths`
3. Check Docker service health: `docker compose ps`
4. Review secrets.txt for credentials
5. Follow test workflow to identify specific failures

## 🎯 Success Criteria

Setup is successful when:

- ✅ All containers running
- ✅ Frontend accessible at https://test.auditproof.ca
- ✅ Admin user can login
- ✅ Can upload receipts
- ✅ Database migrations applied
- ✅ Storage buckets created
- ✅ No CSP errors in console

## 📚 Related Documentation

- Test Workflow: `workflows/TEST_WORKFLOW.md`
- Supabase Self-Hosting: https://supabase.com/docs/guides/self-hosting/docker
- OpenAI API: https://platform.openai.com/docs

## 📜 License

Proprietary - AuditProof Application

---

**Version**: 1.0.0
**Last Updated**: 2024-10-29
**Maintainer**: AuditProof Development Team
