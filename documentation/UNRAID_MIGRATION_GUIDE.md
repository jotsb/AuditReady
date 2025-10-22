# Audit Proof - Unraid Docker Migration Guide

**Document Version:** 1.0
**Last Updated:** 2025-10-22
**Target Environment:** Unraid Server with Docker
**Estimated Migration Time:** 8-16 hours (first-time setup)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture (Bolt.new)](#current-architecture-boltnew)
3. [Target Architecture (Unraid)](#target-architecture-unraid)
4. [Migration Approach Options](#migration-approach-options)
5. [Recommended Approach: Self-Hosted Supabase](#recommended-approach-self-hosted-supabase)
6. [Prerequisites & Planning](#prerequisites--planning)
7. [Step-by-Step Migration Process](#step-by-step-migration-process)
8. [Docker Compose Configuration](#docker-compose-configuration)
9. [Your Responsibilities](#your-responsibilities)
10. [Maintenance & Operations](#maintenance--operations)
11. [Backup & Disaster Recovery](#backup--disaster-recovery)
12. [Security Considerations](#security-considerations)
13. [Cost Comparison](#cost-comparison)
14. [Troubleshooting](#troubleshooting)

---

## Executive Summary

### What This Guide Covers

This document provides a **complete migration plan** for moving Audit Proof from Bolt.new hosting to your Unraid server using Docker containers. It covers:

- Analysis of all application components
- Two migration approaches (quick vs. complete rewrite)
- Detailed step-by-step instructions
- Docker Compose configurations
- Your responsibilities as the system administrator
- Ongoing maintenance requirements

### Current State

**Hosting:** Bolt.new (temporary development environment)
**Database:** Supabase Cloud (managed PostgreSQL)
**Storage:** Supabase Storage (S3-compatible, cloud)
**Authentication:** Supabase Auth (cloud-based)
**Edge Functions:** Supabase Edge Functions (6 functions, Deno runtime)
**Frontend:** React SPA (static files)

### Target State

**Hosting:** Unraid Docker containers
**Database:** Self-hosted PostgreSQL (or managed Supabase Cloud)
**Storage:** Unraid volumes (local storage)
**Authentication:** Self-hosted (GoTrue or custom)
**API:** Self-hosted Node.js/Express backend
**Frontend:** Nginx serving static files

### Key Decision Point

You have **two viable approaches**:

1. **Option A (Recommended):** Self-hosted Supabase stack (~8-12 hours, minimal code changes)
2. **Option B:** Complete rewrite to custom Node.js + MongoDB stack (~120-175 hours)

This guide focuses on **Option A** as it's the most practical for self-hosting while maintaining all functionality.

---

## Current Architecture (Bolt.new)

### Component Inventory

#### 1. Frontend Application
- **Technology:** React 18.3.1 + TypeScript + Vite
- **Size:** ~2.5 MB (bundled and gzipped)
- **Files:** HTML, JavaScript bundles, CSS, images
- **Environment Variables:**
  ```
  VITE_SUPABASE_URL=https://mnmfwqfbksughmthfutg.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGc...
  ```

#### 2. Supabase Backend (Cloud)
**Database Tables (15 total):**
- `profiles` - User profiles
- `businesses` - Business/organization accounts
- `business_members` - Team membership
- `collections` - Receipt collections/folders
- `collection_members` - Shared collection access
- `receipts` - Receipt metadata and extracted data
- `expense_categories` - Custom expense categories
- `invitations` - Team invitation system
- `audit_logs` - Comprehensive audit trail
- `system_logs` - System event logging
- `saved_filters` - User-saved filter preferences
- `saved_log_filters` - Saved audit log filters
- `mfa_recovery_codes` - MFA backup codes
- `export_jobs` - Async export job queue
- `email_receipts_inbox` - Email forwarding inbox
- `rate_limit_tracking` - Rate limiting system
- `dashboard_analytics` - Dashboard metrics cache
- `system_config` - System-wide configuration

**Storage Buckets:**
- `receipts` - Receipt images and PDFs (~50 MB max per file)

**Edge Functions (6):**
1. `extract-receipt-data` - AI-powered OCR using OpenAI GPT-4 Vision
2. `send-invitation-email` - Team invitation emails via SMTP
3. `receive-email-receipt` - Email forwarding integration (Postmark webhook)
4. `accept-invitation` - Team invitation acceptance
5. `process-export-job` - Async export generation (CSV/PDF/ZIP)
6. `admin-user-management` - Admin operations

**Authentication:**
- Email/password authentication
- JWT token-based sessions
- MFA support with recovery codes
- Password reset flow

#### 3. External Dependencies
- **OpenAI API:** Receipt data extraction (GPT-4 Vision)
- **SMTP Server:** Email delivery (mail.privateemail.com)
- **Postmark:** Email receipt forwarding (optional)

### Data Flow Example
```
User uploads receipt (camera/file)
  ↓
Frontend: Optimize image (compression)
  ↓
Upload to Supabase Storage
  ↓
Call extract-receipt-data Edge Function
  ↓
Edge Function: Download image, call OpenAI API
  ↓
Return extracted data (merchant, amount, date, etc.)
  ↓
User verifies data in modal
  ↓
Insert receipt record in database (with RLS security)
  ↓
Receipt appears in dashboard
```

---

## Target Architecture (Unraid)

### Docker Container Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        UNRAID SERVER                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Container: nginx-frontend                             │ │
│  │  - Serves React app static files                       │ │
│  │  - Port: 8080 → 80                                     │ │
│  │  - Volume: /mnt/user/appdata/auditproof/dist          │ │
│  └──────────────────┬─────────────────────────────────────┘ │
│                     │                                        │
│  ┌──────────────────▼─────────────────────────────────────┐ │
│  │  Container: api-backend                                │ │
│  │  - Node.js/Express API server                          │ │
│  │  - Port: 3000 (internal)                               │ │
│  │  - Handles: Auth, file uploads, business logic        │ │
│  └──────────────────┬─────────────────────────────────────┘ │
│                     │                                        │
│  ┌──────────────────▼─────────────────────────────────────┐ │
│  │  Container: postgres                                   │ │
│  │  - PostgreSQL 15 database                              │ │
│  │  - Port: 5432 (internal)                               │ │
│  │  - Volume: /mnt/user/appdata/auditproof/postgres      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Container: minio (S3-compatible storage)              │ │
│  │  - Object storage for receipt files                    │ │
│  │  - Port: 9000 (API), 9001 (Console)                   │ │
│  │  - Volume: /mnt/user/appdata/auditproof/storage       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Container: redis (optional)                           │ │
│  │  - Session storage and caching                         │ │
│  │  - Port: 6379 (internal)                               │ │
│  │  - Volume: /mnt/user/appdata/auditproof/redis         │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Network Configuration
- **Custom Docker Network:** `auditproof-network` (bridge mode)
- **Internal Communication:** Containers communicate via service names
- **External Access:** Only frontend (port 8080) and optionally Minio console (9001)
- **Reverse Proxy:** Recommended to use Nginx Proxy Manager or Traefik

---

## Migration Approach Options

### Option A: Self-Hosted Supabase (RECOMMENDED)

**What It Is:**
Use Supabase's open-source self-hosted version. This includes all components:
- PostgreSQL with extensions
- GoTrue (authentication service)
- PostgREST (auto-generated REST API)
- Storage API (file management)
- Realtime (websocket subscriptions)
- Kong (API gateway)
- Studio (admin dashboard)

**Pros:**
✅ **Minimal code changes** - Application works as-is
✅ **Fast migration** - 8-12 hours
✅ **All features preserved** - Keep MFA, RLS, Edge Functions
✅ **Active community** - Well documented, good support
✅ **Future flexibility** - Can switch back to cloud if needed
✅ **Admin UI included** - Supabase Studio for database management

**Cons:**
❌ **Multiple containers** - 8-10 containers (more complex)
❌ **Higher resource usage** - ~4-6 GB RAM minimum
❌ **Update maintenance** - Need to manually update Supabase versions
❌ **Edge Functions** - Deno runtime required (included but resource-intensive)

**Estimated Resource Usage:**
- CPU: 2-4 cores (burst)
- RAM: 4-6 GB
- Storage: 50-200 GB (depends on receipt volume)
- Network: Minimal (local only)

**Estimated Time:**
- Initial setup: 4-6 hours
- Data migration: 2-4 hours
- Testing: 2-4 hours
- **Total: 8-14 hours**

---

### Option B: Custom Node.js + MongoDB Stack

**What It Is:**
Complete rewrite of backend using traditional stack:
- MongoDB for database
- Express/Fastify for API
- Passport.js for authentication
- Minio for file storage
- Custom implementation of all features

**Pros:**
✅ **Full control** - Every line of code is yours
✅ **Simpler stack** - Fewer containers (4-5)
✅ **Lower resource usage** - ~2-3 GB RAM
✅ **Learning opportunity** - Deep understanding of every component
✅ **MongoDB flexibility** - Document-based data model

**Cons:**
❌ **Massive time investment** - 120-175 hours (3-4 weeks full-time)
❌ **Feature rewrite** - All 6 Edge Functions need conversion
❌ **Auth system rebuild** - JWT, MFA, sessions from scratch
❌ **RLS reimplementation** - Security logic in application code
❌ **No admin UI** - Need to build or use MongoDB Compass
❌ **Testing burden** - All security features need re-testing
❌ **Maintenance complexity** - More code to maintain

**What Needs Rewriting:**
1. **Database Queries** - ~100+ queries across 40+ files
2. **Authentication System** - Registration, login, sessions, MFA
3. **Authorization** - Row-level security logic in application code
4. **File Storage** - Upload/download/delete operations
5. **Edge Functions** - Convert 6 Deno functions to Node.js
6. **Real-time Features** - Websocket implementation if needed

**Estimated Time Breakdown:**
- Database schema conversion: 20 hours
- Query rewrite: 40 hours
- Auth system: 25 hours
- File storage integration: 15 hours
- Edge Function conversion: 30 hours
- Testing and debugging: 30 hours
- **Total: 160 hours (4 weeks full-time)**

---

## Recommended Approach: Self-Hosted Supabase

Based on your requirements and the application's current state, **Option A (Self-Hosted Supabase)** is strongly recommended because:

1. **Time-efficient** - Get running in a weekend vs. a month
2. **Lower risk** - Proven, tested stack
3. **Feature complete** - No loss of functionality
4. **Easier maintenance** - Community support and updates
5. **Future flexibility** - Can migrate to cloud or custom later

The rest of this guide focuses on **Option A**.

---

## Prerequisites & Planning

### Unraid Server Requirements

**Minimum Specifications:**
- **CPU:** 4 cores (Intel/AMD with virtualization support)
- **RAM:** 8 GB available (16 GB total recommended)
- **Storage:** 100 GB free space on array or cache drive
- **Network:** Static IP address on local network
- **Unraid Version:** 6.10.0 or newer

**Recommended Specifications:**
- **CPU:** 6+ cores
- **RAM:** 16 GB available (32 GB total recommended)
- **Storage:** 500 GB SSD cache drive (for database and hot storage)
- **Network:** Gigabit ethernet

### Required Unraid Apps

Install these from Community Applications:

1. **Docker Compose Manager** (if not using manual docker commands)
2. **Nginx Proxy Manager** (for SSL and reverse proxy)
3. **Uptime Kuma** (optional, for monitoring)
4. **Duplicacy or Duplicati** (for backups)

### Skills & Knowledge Required

**Your Responsibilities Will Include:**

✅ **System Administration:**
- Docker container management
- Volume and network configuration
- Port mapping and firewall rules
- Log monitoring and troubleshooting

✅ **Database Management:**
- PostgreSQL backups (daily recommended)
- Database performance monitoring
- Occasional query optimization
- Schema updates (via migrations)

✅ **Security:**
- SSL certificate management (Let's Encrypt)
- Password and secret management
- Security updates (container images)
- Access control and firewall rules

✅ **Monitoring & Maintenance:**
- Container health checks
- Disk space monitoring
- Log rotation
- Update scheduling

❌ **What You WON'T Need:**
- Application code development
- Deep PostgreSQL expertise (basics sufficient)
- DevOps/Kubernetes knowledge
- Complex networking (just port forwarding)

### Pre-Migration Checklist

**Data Preparation:**
- [ ] Export all data from Supabase Cloud (using `pg_dump`)
- [ ] Download all receipts from Storage (backup)
- [ ] Document current environment variables
- [ ] List all active Edge Function secrets
- [ ] Export user list and roles

**Unraid Setup:**
- [ ] Free up 100+ GB storage space
- [ ] Reserve 8+ GB RAM for containers
- [ ] Set static IP for Unraid server
- [ ] Enable Docker service
- [ ] Create appdata share if not exists

**Network Planning:**
- [ ] Choose internal port mappings
- [ ] Plan domain name (e.g., auditproof.local)
- [ ] Configure DNS or /etc/hosts
- [ ] Open firewall ports if accessing remotely

---

## Step-by-Step Migration Process

### Phase 1: Backup Current System (1-2 hours)

#### Step 1.1: Export Database

```bash
# Install Supabase CLI on your workstation (not Unraid)
# macOS:
brew install supabase/tap/supabase

# Windows (PowerShell):
scoop install supabase

# Linux:
curl -fsSL https://cli.supabase.com/install.sh | sh

# Login
supabase login

# Link to your project
supabase link --project-ref mnmfwqfbksughmthfutg

# Export database schema and data
supabase db dump -f backup-schema.sql --data-only=false
supabase db dump -f backup-data.sql --data-only=true

# Save these files - you'll need them later
```

#### Step 1.2: Backup Storage Files

Option A: Use Supabase CLI
```bash
# List all files
supabase storage list receipts

# Download all files (may need custom script)
# Create a simple script or use rclone
```

Option B: Use rclone (Recommended)
```bash
# Install rclone
brew install rclone  # macOS
# or download from rclone.org

# Configure rclone for Supabase Storage
rclone config

# Name: supabase
# Type: s3
# Provider: Other
# Access Key: [Your Supabase Service Role Key]
# Secret Key: [Your Supabase Service Role Key]
# Endpoint: https://mnmfwqfbksughmthfutg.supabase.co/storage/v1/s3
# Region: (leave blank)

# Download all files
rclone sync supabase:receipts ./backup-storage/receipts/ -P
```

#### Step 1.3: Document Configuration

Create a file `migration-notes.md`:
```markdown
# Current Configuration

## Supabase
- Project ID: mnmfwqfbksughmthfutg
- URL: https://mnmfwqfbksughmthfutg.supabase.co
- Anon Key: eyJhbGc... (public, safe to store)
- Service Role Key: [SECURE - store in password manager]

## Edge Function Secrets
- OPENAI_API_KEY: sk-...
- SMTP_HOST: mail.privateemail.com
- SMTP_PORT: 465
- SMTP_USER: contact@auditproof.ca
- SMTP_PASSWORD: [SECURE]

## External Services
- Email: Postmark (optional)
  - Inbound webhook: receive-email-receipt
  - Server API Token: [if configured]
```

---

### Phase 2: Setup Unraid Environment (2-3 hours)

#### Step 2.1: Create Directory Structure

SSH into your Unraid server:
```bash
ssh root@unraid-ip

# Create application directories
mkdir -p /mnt/user/appdata/auditproof/{postgres,storage,redis,config,backups,logs}

# Set permissions
chmod -R 755 /mnt/user/appdata/auditproof
```

#### Step 2.2: Create Docker Network

```bash
docker network create auditproof-network
```

#### Step 2.3: Generate Secrets

```bash
# Generate JWT secret (64 characters)
openssl rand -base64 48

# Generate API keys
openssl rand -hex 32

# Save these in a secure location
```

---

### Phase 3: Deploy Self-Hosted Supabase (3-5 hours)

#### Step 3.1: Clone Supabase Repository

```bash
cd /mnt/user/appdata/auditproof

# Clone official self-hosted setup
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copy example environment file
cp .env.example .env
```

#### Step 3.2: Configure Environment Variables

Edit `/mnt/user/appdata/auditproof/supabase/docker/.env`:

```bash
############
# Secrets
############

# Generate these with: openssl rand -base64 32
POSTGRES_PASSWORD=your-super-secure-postgres-password
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=your-admin-password

############
# URLs
############

SITE_URL=http://your-unraid-ip:8080
API_EXTERNAL_URL=http://your-unraid-ip:8000

############
# Ports
############

KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443
POSTGRES_PORT=5432
STUDIO_PORT=3000

############
# Database
############

POSTGRES_HOST=db
POSTGRES_DB=postgres

############
# Auth
############

GOTRUE_SITE_URL=http://your-unraid-ip:8080
GOTRUE_JWT_SECRET=${JWT_SECRET}
GOTRUE_SMTP_HOST=mail.privateemail.com
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=contact@auditproof.ca
GOTRUE_SMTP_PASS=your-smtp-password
GOTRUE_SMTP_ADMIN_EMAIL=contact@auditproof.ca

############
# Storage
############

STORAGE_FILE_SIZE_LIMIT=52428800  # 50MB in bytes

############
# Edge Functions
############

FUNCTIONS_VERIFY_JWT=false  # Set to true in production
```

**Important Notes:**
- Replace `your-unraid-ip` with your actual Unraid server IP
- Generate new JWT_SECRET (don't use the example)
- Use strong passwords for POSTGRES_PASSWORD and DASHBOARD_PASSWORD
- The ANON_KEY and SERVICE_ROLE_KEY shown are examples, generate new ones using [JWT.io](https://jwt.io) with your JWT_SECRET

#### Step 3.3: Customize Docker Compose

Edit `/mnt/user/appdata/auditproof/supabase/docker/docker-compose.yml`:

**Modify volume paths to use Unraid:**
```yaml
services:
  db:
    volumes:
      - /mnt/user/appdata/auditproof/postgres:/var/lib/postgresql/data

  storage:
    volumes:
      - /mnt/user/appdata/auditproof/storage:/var/lib/storage

  # ... other services
```

**Add restart policies:**
```yaml
services:
  db:
    restart: unless-stopped

  # Add to all services
```

#### Step 3.4: Start Supabase Stack

```bash
cd /mnt/user/appdata/auditproof/supabase/docker

# Pull all images (this will take 10-20 minutes)
docker compose pull

# Start services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

**Expected Containers (8 total):**
1. `supabase-db` - PostgreSQL database
2. `supabase-auth` - GoTrue authentication service
3. `supabase-rest` - PostgREST API
4. `supabase-storage` - Storage API
5. `supabase-imgproxy` - Image optimization
6. `supabase-kong` - API Gateway
7. `supabase-realtime` - Realtime subscriptions
8. `supabase-studio` - Admin dashboard

**Verify Services:**
- Supabase Studio: `http://unraid-ip:3000`
- API Gateway: `http://unraid-ip:8000`
- PostgreSQL: `postgresql://postgres:your-password@unraid-ip:5432/postgres`

---

### Phase 4: Restore Data (1-2 hours)

#### Step 4.1: Import Database Schema

```bash
# Copy your backup files to Unraid
scp backup-schema.sql root@unraid-ip:/mnt/user/appdata/auditproof/backups/

# SSH into Unraid
ssh root@unraid-ip

# Restore schema
docker exec -i supabase-db psql -U postgres -d postgres < /mnt/user/appdata/auditproof/backups/backup-schema.sql

# Verify tables
docker exec -it supabase-db psql -U postgres -d postgres -c "\dt"
```

#### Step 4.2: Import Data

```bash
# Restore data
docker exec -i supabase-db psql -U postgres -d postgres < /mnt/user/appdata/auditproof/backups/backup-data.sql

# Verify data
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM receipts;"
```

#### Step 4.3: Restore Storage Files

```bash
# Copy storage files to Unraid
scp -r backup-storage/receipts root@unraid-ip:/mnt/user/appdata/auditproof/storage/

# Fix permissions
chmod -R 755 /mnt/user/appdata/auditproof/storage/receipts
```

---

### Phase 5: Deploy Frontend (1 hour)

#### Step 5.1: Build Frontend with New Config

On your workstation:
```bash
cd /path/to/auditproof

# Update .env file
cat > .env << EOF
VITE_SUPABASE_URL=http://unraid-ip:8000
VITE_SUPABASE_ANON_KEY=eyJhbG...  # Use the ANON_KEY from your .env
EOF

# Build
npm run build

# Package for transfer
tar -czf dist.tar.gz dist/
```

#### Step 5.2: Deploy to Nginx Container

```bash
# Transfer to Unraid
scp dist.tar.gz root@unraid-ip:/mnt/user/appdata/auditproof/

# SSH into Unraid
ssh root@unraid-ip
cd /mnt/user/appdata/auditproof

# Extract
tar -xzf dist.tar.gz

# Create Nginx container
docker run -d \
  --name auditproof-frontend \
  --network auditproof-network \
  -p 8080:80 \
  -v /mnt/user/appdata/auditproof/dist:/usr/share/nginx/html:ro \
  -v /mnt/user/appdata/auditproof/config/nginx.conf:/etc/nginx/nginx.conf:ro \
  --restart unless-stopped \
  nginx:alpine
```

#### Step 5.3: Create Nginx Configuration

Create `/mnt/user/appdata/auditproof/config/nginx.conf`:
```nginx
events {
  worker_connections 1024;
}

http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;

  server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # SPA routing - always serve index.html
    location / {
      try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
      expires 1y;
      add_header Cache-Control "public, immutable";
    }
  }
}
```

Restart Nginx:
```bash
docker restart auditproof-frontend
```

---

### Phase 6: Deploy Edge Functions (1-2 hours)

#### Step 6.1: Prepare Function Deployments

On your workstation:
```bash
cd /path/to/auditproof

# Install Supabase CLI if not already done
# ... (see Phase 1)

# Link to local Supabase
supabase link --project-ref http://unraid-ip:8000

# Set secrets
supabase secrets set OPENAI_API_KEY=sk-... --project-ref http://unraid-ip:8000
supabase secrets set SMTP_HOST=mail.privateemail.com --project-ref http://unraid-ip:8000
supabase secrets set SMTP_PORT=465 --project-ref http://unraid-ip:8000
supabase secrets set SMTP_USER=contact@auditproof.ca --project-ref http://unraid-ip:8000
supabase secrets set SMTP_PASSWORD=your-smtp-password --project-ref http://unraid-ip:8000

# Deploy all functions
supabase functions deploy
```

#### Step 6.2: Test Edge Functions

```bash
# Test extract-receipt-data
curl -X POST http://unraid-ip:8000/functions/v1/extract-receipt-data \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"receipt_path": "test.jpg"}'

# Expected: 200 OK with receipt data or error message
```

---

### Phase 7: Testing & Validation (2-3 hours)

#### Step 7.1: Access Application

Open browser: `http://unraid-ip:8080`

#### Step 7.2: Test Core Functionality

**Authentication:**
- [ ] Register new account
- [ ] Login with existing credentials
- [ ] Logout
- [ ] Password reset flow

**Receipt Management:**
- [ ] Upload receipt (camera)
- [ ] Upload receipt (file)
- [ ] AI extraction working
- [ ] Manual receipt entry
- [ ] Edit receipt
- [ ] Delete receipt
- [ ] Multi-page receipt

**Collections:**
- [ ] Create collection
- [ ] Add receipts to collection
- [ ] Share collection
- [ ] Delete collection

**Team Features:**
- [ ] Invite team member
- [ ] Accept invitation
- [ ] View team members
- [ ] Remove team member

**Export:**
- [ ] CSV export
- [ ] PDF export
- [ ] ZIP export

**Admin (if system admin):**
- [ ] View system logs
- [ ] View audit logs
- [ ] Manage users
- [ ] System configuration

#### Step 7.3: Performance Testing

```bash
# Check container resource usage
docker stats

# Expected:
# - Total CPU: 10-30%
# - Total RAM: 2-4 GB (idle), 4-6 GB (active)
# - Network: Minimal

# Check database connections
docker exec supabase-db psql -U postgres -d postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check storage usage
du -sh /mnt/user/appdata/auditproof/*
```

---

## Docker Compose Configuration

### Complete Docker Compose File

For easier management, you can create a custom `docker-compose.yml` that includes Nginx:

Create `/mnt/user/appdata/auditproof/docker-compose.override.yml`:

```yaml
version: '3.8'

services:
  # Frontend
  frontend:
    image: nginx:alpine
    container_name: auditproof-frontend
    networks:
      - default
    ports:
      - "8080:80"
    volumes:
      - /mnt/user/appdata/auditproof/dist:/usr/share/nginx/html:ro
      - /mnt/user/appdata/auditproof/config/nginx.conf:/etc/nginx/nginx.conf:ro
    restart: unless-stopped
    depends_on:
      - kong

  # Add custom backup service
  backup:
    image: postgres:15-alpine
    container_name: auditproof-backup
    networks:
      - default
    volumes:
      - /mnt/user/appdata/auditproof/backups:/backups
      - /mnt/user/appdata/auditproof/scripts:/scripts:ro
    environment:
      POSTGRES_HOST: db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    entrypoint: ["/scripts/backup.sh"]
    restart: "no"  # Run manually or via cron

networks:
  default:
    external: true
    name: auditproof-network
```

### Backup Script

Create `/mnt/user/appdata/auditproof/scripts/backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

echo "Starting backup at $TIMESTAMP..."

# Backup database
pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER -d postgres -F c -f "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"

echo "Backup completed: $BACKUP_FILE.gz"

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Old backups cleaned up"
```

Make executable:
```bash
chmod +x /mnt/user/appdata/auditproof/scripts/backup.sh
```

---

## Your Responsibilities

### Daily Tasks (5-10 minutes)

**Monitoring:**
- [ ] Check container health: `docker compose ps`
- [ ] Review logs for errors: `docker compose logs --tail=100`
- [ ] Check disk space: `df -h /mnt/user/appdata/auditproof`
- [ ] Monitor CPU/RAM usage: `docker stats`

**What to Look For:**
- Containers showing "unhealthy" status
- Repeated errors in logs
- Disk usage above 80%
- High CPU or RAM usage

### Weekly Tasks (15-30 minutes)

**Backups:**
- [ ] Run manual backup script
- [ ] Verify backup file created
- [ ] Test backup restoration (monthly)
- [ ] Copy backups offsite

```bash
# Run backup
docker exec auditproof-backup /scripts/backup.sh

# Verify backup
ls -lh /mnt/user/appdata/auditproof/backups/
```

**Updates:**
- [ ] Check for Supabase updates
- [ ] Review changelogs
- [ ] Plan update window

### Monthly Tasks (1-2 hours)

**Security:**
- [ ] Review audit logs for suspicious activity
- [ ] Check for security vulnerabilities: `docker scout cves`
- [ ] Update container images
- [ ] Rotate API keys if needed

**Performance:**
- [ ] Review database size: `SELECT pg_size_pretty(pg_database_size('postgres'));`
- [ ] Check slow queries
- [ ] Optimize indexes if needed
- [ ] Clean up old logs

**Disaster Recovery:**
- [ ] Test backup restoration
- [ ] Verify all services start correctly
- [ ] Update documentation

### Quarterly Tasks (2-4 hours)

**Major Updates:**
- [ ] Upgrade Supabase version
- [ ] Test in staging environment first
- [ ] Update application dependencies
- [ ] Review and update security policies

**Capacity Planning:**
- [ ] Analyze growth trends
- [ ] Plan storage expansion if needed
- [ ] Evaluate performance bottlenecks
- [ ] Consider hardware upgrades

---

## Maintenance & Operations

### Starting/Stopping Services

```bash
# Stop all services
cd /mnt/user/appdata/auditproof/supabase/docker
docker compose down

# Start all services
docker compose up -d

# Restart single service
docker compose restart db

# View logs
docker compose logs -f [service-name]
```

### Database Maintenance

**Weekly Vacuum:**
```bash
docker exec supabase-db psql -U postgres -d postgres -c "VACUUM ANALYZE;"
```

**Check Database Size:**
```bash
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT
  pg_size_pretty(pg_database_size('postgres')) as db_size,
  pg_size_pretty(pg_total_relation_size('receipts')) as receipts_size,
  pg_size_pretty(pg_total_relation_size('audit_logs')) as audit_logs_size;
"
```

**Backup Database:**
```bash
docker exec supabase-db pg_dump -U postgres -d postgres -F c > backup_$(date +%Y%m%d).dump
```

**Restore Database:**
```bash
docker exec -i supabase-db pg_restore -U postgres -d postgres -c < backup_20251022.dump
```

### Storage Management

**Check Storage Usage:**
```bash
du -sh /mnt/user/appdata/auditproof/storage/*
```

**Clean Up Old Backups:**
```bash
find /mnt/user/appdata/auditproof/backups/ -name "*.dump" -mtime +30 -delete
```

### Log Management

**View Real-time Logs:**
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f db

# Last 100 lines
docker compose logs --tail=100
```

**Log Rotation:**
Edit `/etc/logrotate.d/docker-containers`:
```
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  missingok
  delaycompress
  copytruncate
}
```

### Updating Services

```bash
# Pull latest images
cd /mnt/user/appdata/auditproof/supabase/docker
docker compose pull

# Backup before updating
./scripts/backup.sh

# Update and restart
docker compose up -d

# Check health
docker compose ps
docker compose logs
```

---

## Backup & Disaster Recovery

### Backup Strategy

**3-2-1 Backup Rule:**
- **3** copies of data
- **2** different storage media
- **1** offsite copy

### Automated Backup Script

Create `/mnt/user/appdata/auditproof/scripts/full-backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/mnt/user/backups/auditproof"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"

mkdir -p "$BACKUP_PATH"

echo "=== Starting Full Backup at $TIMESTAMP ==="

# 1. Backup Database
echo "Backing up database..."
docker exec supabase-db pg_dump -U postgres -d postgres -F c -f /tmp/db.dump
docker cp supabase-db:/tmp/db.dump "$BACKUP_PATH/database.dump"
gzip "$BACKUP_PATH/database.dump"

# 2. Backup Storage Files
echo "Backing up storage files..."
tar -czf "$BACKUP_PATH/storage.tar.gz" -C /mnt/user/appdata/auditproof storage/

# 3. Backup Configuration
echo "Backing up configuration..."
cp /mnt/user/appdata/auditproof/supabase/docker/.env "$BACKUP_PATH/config.env"
tar -czf "$BACKUP_PATH/config.tar.gz" -C /mnt/user/appdata/auditproof config/

# 4. Create manifest
cat > "$BACKUP_PATH/manifest.txt" << EOF
Backup Created: $TIMESTAMP
Database Size: $(du -sh $BACKUP_PATH/database.dump.gz | cut -f1)
Storage Size: $(du -sh $BACKUP_PATH/storage.tar.gz | cut -f1)
Config Size: $(du -sh $BACKUP_PATH/config.tar.gz | cut -f1)
EOF

echo "=== Backup Complete ==="
echo "Location: $BACKUP_PATH"
du -sh "$BACKUP_PATH"

# 5. Clean up old backups (keep last 14 days)
find "$BACKUP_DIR" -maxdepth 1 -mtime +14 -type d -exec rm -rf {} \;

# 6. Copy to offsite (optional)
# rsync -avz "$BACKUP_PATH" user@remote-server:/backups/auditproof/
```

Make executable:
```bash
chmod +x /mnt/user/appdata/auditproof/scripts/full-backup.sh
```

### Schedule Backups

Add to Unraid's User Scripts plugin or create cron job:

```bash
# Edit crontab
crontab -e

# Add daily backup at 3 AM
0 3 * * * /mnt/user/appdata/auditproof/scripts/full-backup.sh >> /var/log/auditproof-backup.log 2>&1
```

### Disaster Recovery Procedure

**Full System Restoration:**

1. **Restore Supabase Stack:**
```bash
cd /mnt/user/appdata/auditproof/supabase/docker
docker compose up -d db  # Start database first
sleep 10
```

2. **Restore Database:**
```bash
# Copy backup file
BACKUP_DATE=20251022_030000
gunzip /mnt/user/backups/auditproof/$BACKUP_DATE/database.dump.gz

# Restore
docker exec -i supabase-db pg_restore -U postgres -d postgres -c < /mnt/user/backups/auditproof/$BACKUP_DATE/database.dump
```

3. **Restore Storage:**
```bash
tar -xzf /mnt/user/backups/auditproof/$BACKUP_DATE/storage.tar.gz -C /mnt/user/appdata/auditproof/
```

4. **Restore Configuration:**
```bash
tar -xzf /mnt/user/backups/auditproof/$BACKUP_DATE/config.tar.gz -C /mnt/user/appdata/auditproof/
cp /mnt/user/backups/auditproof/$BACKUP_DATE/config.env /mnt/user/appdata/auditproof/supabase/docker/.env
```

5. **Start All Services:**
```bash
docker compose up -d
```

6. **Verify:**
```bash
docker compose ps
curl http://localhost:8080
```

**Estimated Recovery Time:** 30-60 minutes

---

## Security Considerations

### Network Security

**Firewall Rules:**
```bash
# Allow only necessary ports
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT  # Frontend
iptables -A INPUT -p tcp --dport 8000 -j ACCEPT  # API Gateway
iptables -A INPUT -p tcp --dport 3000 -j DROP    # Studio (internal only)
iptables -A INPUT -p tcp --dport 5432 -j DROP    # PostgreSQL (internal only)
```

**Reverse Proxy (Recommended):**
Use Nginx Proxy Manager to:
- Add SSL certificates (Let's Encrypt)
- Configure custom domain
- Add rate limiting
- Enable fail2ban

### SSL/TLS Setup

**Option A: Nginx Proxy Manager (Easiest)**
1. Install Nginx Proxy Manager from Community Apps
2. Add proxy host:
   - Domain: auditproof.yourdomain.com
   - Forward to: unraid-ip:8080
   - Enable SSL with Let's Encrypt
   - Force SSL

**Option B: Manual SSL with Certbot**
```bash
# Install certbot
docker run -it --rm --name certbot \
  -v "/mnt/user/appdata/auditproof/certs:/etc/letsencrypt" \
  certbot/certbot certonly --standalone \
  -d auditproof.yourdomain.com

# Update Nginx config to use SSL
# Update frontend .env with HTTPS URL
```

### Secret Management

**Never Commit:**
- Database passwords
- JWT secrets
- API keys
- Service role keys

**Store Securely:**
- Use Unraid's built-in password manager
- Or use environment files with proper permissions:
```bash
chmod 600 /mnt/user/appdata/auditproof/supabase/docker/.env
```

### Access Control

**PostgreSQL:**
- Bind only to Docker network (not 0.0.0.0)
- Use strong passwords (16+ characters)
- Limit connections to known IPs

**API Access:**
- Enable JWT verification in production
- Use row-level security (RLS) policies
- Rate limit API endpoints

### Security Checklist

- [ ] Change all default passwords
- [ ] Enable SSL/TLS
- [ ] Configure firewall
- [ ] Disable unnecessary ports
- [ ] Enable audit logging
- [ ] Set up intrusion detection
- [ ] Regular security updates
- [ ] Monitor access logs
- [ ] Implement rate limiting
- [ ] Use strong JWT secrets

---

## Cost Comparison

### Current (Bolt.new + Supabase Cloud)

| Service | Cost | Notes |
|---------|------|-------|
| Bolt.new | $20-50/month | Development environment |
| Supabase Pro | $25/month | Database, auth, storage |
| OpenAI API | $10-50/month | Receipt extraction |
| Email (SMTP) | $0 | Included with domain |
| **Total** | **$55-125/month** | Depends on usage |

### Self-Hosted on Unraid

| Component | Initial Cost | Ongoing Cost | Notes |
|-----------|-------------|--------------|-------|
| Unraid Server | $0 | $0 | Already owned |
| Electricity | $0 | ~$10/month | 100W @ $0.15/kWh |
| OpenAI API | $0 | $10-50/month | Same as before |
| Domain/SSL | $0 | $15/year | Optional |
| **Total** | **$0** | **$10-50/month** | 50-80% savings |

**Payback Period:** Immediate (no upfront costs)
**Annual Savings:** $540-900
**5-Year Savings:** $2,700-4,500

### Hidden Benefits

✅ **Data Sovereignty** - Your data stays on your hardware
✅ **No Usage Limits** - No bandwidth or storage caps
✅ **Privacy** - No third-party access to data
✅ **Learning Experience** - Deeper system understanding
✅ **Offline Access** - Works without internet (except OpenAI)

---

## Troubleshooting

### Container Won't Start

**Symptom:** Container exits immediately after starting

**Solutions:**
```bash
# Check logs
docker logs container-name

# Common issues:
# 1. Port already in use
netstat -tulpn | grep :8000

# 2. Volume permission issues
chmod -R 755 /mnt/user/appdata/auditproof

# 3. Missing environment variables
docker inspect container-name | grep -i env
```

### Database Connection Errors

**Symptom:** "ECONNREFUSED" or "Connection refused"

**Solutions:**
```bash
# 1. Check PostgreSQL is running
docker ps | grep postgres

# 2. Test connection
docker exec -it supabase-db psql -U postgres -d postgres

# 3. Check network
docker network inspect auditproof-network

# 4. Verify credentials
cat /mnt/user/appdata/auditproof/supabase/docker/.env | grep POSTGRES_PASSWORD
```

### Frontend Shows Blank Page

**Symptom:** White screen or "Cannot connect to server"

**Solutions:**
1. Check browser console for errors (F12)
2. Verify API URL in .env matches Unraid IP
3. Check CORS headers in Kong configuration
4. Verify all containers are running
5. Test API endpoint: `curl http://unraid-ip:8000/health`

### Storage Upload Fails

**Symptom:** Receipts fail to upload

**Solutions:**
```bash
# 1. Check storage container
docker logs supabase-storage

# 2. Verify volume permissions
ls -la /mnt/user/appdata/auditproof/storage

# 3. Check disk space
df -h /mnt/user/appdata/auditproof

# 4. Test storage API
curl http://unraid-ip:8000/storage/v1/bucket/receipts
```

### High Memory Usage

**Symptom:** Containers using >8 GB RAM

**Solutions:**
```bash
# 1. Identify culprit
docker stats --no-stream

# 2. Restart heavy containers
docker restart supabase-db

# 3. Tune PostgreSQL
# Edit /mnt/user/appdata/auditproof/postgres/postgresql.conf
shared_buffers = 256MB  # Default 128MB
work_mem = 16MB         # Default 4MB

# 4. Enable connection pooling
# Add to docker-compose.yml
```

### Edge Functions Not Working

**Symptom:** 500 errors when calling functions

**Solutions:**
```bash
# 1. Check function logs
docker logs supabase-functions

# 2. Verify secrets are set
supabase secrets list

# 3. Test function locally
supabase functions serve

# 4. Check OpenAI API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

## Next Steps

### Immediate Actions (Today)

1. **Decision:** Confirm you want to proceed with self-hosted Supabase
2. **Backup:** Export current data from Supabase Cloud
3. **Prepare:** Free up space on Unraid, install prerequisites
4. **Read:** Review this entire document, note questions

### This Weekend (Setup Phase)

1. **Day 1 (Saturday):**
   - Morning: Deploy Supabase stack (Phase 3)
   - Afternoon: Restore data (Phase 4)
   - Evening: Deploy frontend (Phase 5)

2. **Day 2 (Sunday):**
   - Morning: Deploy Edge Functions (Phase 6)
   - Afternoon: Testing (Phase 7)
   - Evening: SSL setup, documentation

### Next Week (Stabilization)

1. **Monday-Wednesday:** Run in parallel with cloud
2. **Thursday:** Compare functionality and performance
3. **Friday:** Final decision and full migration

### Long-term (Ongoing)

- **Week 2-4:** Monitor stability, optimize performance
- **Month 2:** Set up automated backups and monitoring
- **Month 3:** Decommission cloud services, celebrate savings!

---

## Summary

### Key Takeaways

✅ **Feasible:** Migrating to Unraid is absolutely doable
✅ **Time:** 8-16 hours for initial setup
✅ **Cost:** 50-80% savings ($500-900/year)
✅ **Risk:** Low (keep cloud running during migration)
✅ **Maintenance:** ~1-2 hours/week ongoing

### Your Commitment

As the system administrator, you'll be responsible for:
- Daily health checks (5 minutes)
- Weekly backups (15 minutes)
- Monthly updates (1 hour)
- Disaster recovery planning
- Security monitoring

### When to Consider Alternative

**Don't self-host if:**
- You expect >10,000 users (scaling complexity)
- You need 99.99% uptime SLA (production business)
- You have < 2 hours/month for maintenance
- Your internet is unreliable (remote access needs stability)

**Do self-host if:**
- You value data privacy and control
- You enjoy learning and tinkering
- You want cost savings
- You have reliable Unraid setup
- You're comfortable with Linux/Docker

---

## Support Resources

**Official Documentation:**
- Supabase Self-Hosting: https://supabase.com/docs/guides/self-hosting
- Docker Compose: https://docs.docker.com/compose/
- Unraid Forums: https://forums.unraid.net/

**Community:**
- Supabase Discord: https://discord.supabase.com/
- Unraid Discord: https://discord.com/invite/unraid
- r/unraid: https://reddit.com/r/unraid

**Need Help?**
- Review Supabase logs first
- Check Unraid forums for similar issues
- Ask in Discord communities
- Create GitHub issue for Supabase bugs

---

## Conclusion

Migrating Audit Proof to your Unraid server is a **strategic decision** that offers:
- Significant cost savings
- Complete data control
- Learning opportunities
- Scalability for your needs

The recommended approach (self-hosted Supabase) provides the best balance of:
- Migration simplicity
- Feature completeness
- Maintenance effort
- Long-term flexibility

**You're fully capable of managing this system** with the commitment of 1-2 hours per week for routine maintenance.

**Ready to start?** Begin with Phase 1: Backup Current System.

---

**Document Prepared By:** Audit Proof Development Team
**For Questions:** Review troubleshooting section or community resources
**Good Luck!** 🚀
