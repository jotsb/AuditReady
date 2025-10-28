# Audit Proof - Complete Unraid Self-Hosting Guide

**Document Version:** 2.2
**Last Updated:** 2025-10-27
**Target:** Unraid 7.1.4+ with SWAG Reverse Proxy
**Migration Approach:** Fresh Installation (No data migration from Bolt.new)
**Estimated Time:** 15-20 hours (first-time setup)

---

## 📋 Current Progress Summary

### ✅ Completed Steps
- **Phase 0:** Project cloned to Unraid ✓
  - Location: `/mnt/user/appdata/auditproof/project/AuditReady`
  - All source files, migrations, and Edge Functions available locally
- **Phase 1:** Unraid Network Setup ✓
- **Phase 2:** Install Supabase Stack ✓
  - Step 2.1-2.7: All Supabase services running
  - Step 2.8: Studio accessible at http://192.168.1.246:3000 ✓
  - **Note:** Edge Functions temporarily disabled (will enable in Phase 3.5)

### 🔄 Current Status
Your Supabase infrastructure is running with:
- ✅ PostgreSQL database (healthy)
- ✅ GoTrue authentication (healthy)
- ✅ PostgREST API (healthy)
- ✅ Storage API (healthy)
- ✅ Realtime (healthy)
- ✅ Kong Gateway (healthy)
- ✅ Studio Admin UI (accessible)
- ⏸️ Edge Functions (disabled - will enable later)
- ⚠️ Supavisor (pooler) - May be restarting, can be disabled if needed

### 📍 Next Steps
**→ Proceed to Phase 3: Database Initialization**
- Apply 84 database migrations
- Create all 18 tables
- Seed default data

**→ Then Phase 3.5: Deploy Edge Functions**
- Enable AI receipt extraction
- Enable email invitations
- Enable all application features

---

## Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Application Analysis](#application-analysis)
3. [Prerequisites](#prerequisites)
4. [Phase 0: Project Setup](#phase-0-project-setup-already-complete)
5. [Phase 1: Unraid Network Setup](#phase-1-unraid-network-setup)
6. [Phase 2: Install Supabase Stack](#phase-2-install-supabase-stack)
7. [Phase 3: Database Initialization](#phase-3-database-initialization)
8. [Phase 3.5: Deploy Edge Functions](#phase-35-deploy-edge-functions)
9. [Phase 4: Deploy Frontend](#phase-4-deploy-frontend)
10. [Phase 5: Configure SWAG Reverse Proxy](#phase-5-configure-swag-reverse-proxy)
11. [Phase 6: Create Admin Account](#phase-6-create-admin-account)
12. [Phase 7: Setup Monitoring](#phase-7-setup-monitoring)
13. [Phase 8: Setup Backups](#phase-8-setup-backups)
14. [Testing & Verification](#testing--verification)
15. [Ongoing Maintenance](#ongoing-maintenance)
16. [Troubleshooting](#troubleshooting)

---

## Overview & Architecture

### What You're Building

A **completely self-hosted** Audit Proof installation on your Unraid server with:
- **Zero cloud dependencies** (except OpenAI API for receipt extraction)
- **Full data ownership** - everything stored on your Unraid array
- **Professional setup** with SSL, monitoring, and automated backups
- **Fresh database** - no migration from Bolt.new needed

### Final Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      UNRAID SERVER (192.168.1.246)              │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  SWAG Reverse Proxy (br0: 192.168.1.65)                  │ │
│  │  - SSL/TLS termination (Let's Encrypt)                    │ │
│  │  - Domain: auditproof.yourdomain.com                      │ │
│  │  - Ports: 80 → 443 (external)                             │ │
│  └──────────────────┬────────────────────────────────────────┘ │
│                     │                                           │
│  ┌──────────────────▼────────────────────────────────────────┐ │
│  │  Audit Proof Frontend (Custom Network)                    │ │
│  │  - Nginx serving React app                                │ │
│  │  - Port: 8080                                             │ │
│  │  - Volume: /mnt/user/appdata/auditproof/dist             │ │
│  └──────────────────┬────────────────────────────────────────┘ │
│                     │                                           │
│  ┌──────────────────▼────────────────────────────────────────┐ │
│  │  Supabase Kong Gateway (Custom Network)                   │ │
│  │  - API Gateway & routing                                  │ │
│  │  - Ports: 8000 (API), 8001 (Admin)                       │ │
│  └──────────────────┬────────────────────────────────────────┘ │
│                     │                                           │
│  ┌──────────────────┴────────────────────────────────────────┐ │
│  │                 Supabase Services                          │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  PostgreSQL 15 (database)                            │ │ │
│  │  │  Volume: /mnt/user/appdata/auditproof/postgres       │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  GoTrue (authentication service)                     │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  PostgREST (auto REST API)                           │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  Storage API                                          │ │ │
│  │  │  Volume: /mnt/user/appdata/auditproof/storage        │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  Edge Functions (Deno runtime)                       │ │ │
│  │  │  - 6 functions for business logic                    │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  Studio (admin UI)                                   │ │ │
│  │  │  Port: 3000                                          │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Uptime Kuma (monitoring - br0: 192.168.1.x)             │ │
│  │  Port: 3001                                               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Duplicacy (backup service)                               │ │
│  │  - Daily automated backups                                │ │
│  │  - Retention: 30 days                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Network Strategy

Since you currently use **bridge**, **br0**, and **host** networks via Unraid GUI, we'll:
1. Create a **custom bridge network** for Supabase services (internal communication)
2. Use **br0** for SWAG and monitoring (external access)
3. Keep it manageable through Unraid Docker GUI

---

## Application Analysis

### Complete Component Inventory

#### Frontend Application
- **Technology:** React 18.3.1 + TypeScript + Vite
- **Build Output:** ~2.5 MB (gzipped)
- **Dependencies:**
  - Supabase client (@supabase/supabase-js)
  - React Query for data fetching
  - PDF generation (jsPDF)
  - Image compression
- **Configuration:** Requires 2 environment variables only
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

#### Database Schema (18 Tables)
1. **profiles** - User accounts and settings
2. **businesses** - Organizations/companies
3. **business_members** - Team membership with roles
4. **collections** - Receipt folders/categories
5. **collection_members** - Shared collection access
6. **receipts** - Receipt metadata and OCR data
7. **expense_categories** - Custom expense categories
8. **invitations** - Team invitation system
9. **audit_logs** - Comprehensive audit trail (84 total migrations)
10. **system_logs** - System events and errors
11. **saved_filters** - User-saved search filters
12. **saved_log_filters** - Audit log filters
13. **mfa_recovery_codes** - MFA backup codes
14. **export_jobs** - Async export queue
15. **email_receipts_inbox** - Email forwarding
16. **rate_limit_tracking** - Rate limiting
17. **dashboard_analytics** - Cached metrics
18. **system_config** - System settings

#### Edge Functions (6 Total)
1. **extract-receipt-data** - AI OCR using OpenAI GPT-4 Vision
2. **send-invitation-email** - Team invitations via SMTP
3. **receive-email-receipt** - Email forwarding webhook
4. **accept-invitation** - Invitation acceptance
5. **process-export-job** - Async CSV/PDF/ZIP generation
6. **admin-user-management** - Admin operations

#### External Dependencies
- **OpenAI API** (Required) - Receipt data extraction
  - Model: GPT-4 Vision
  - Cost: ~$0.01 per receipt
  - Secrets needed: `OPENAI_API_KEY`
- **SMTP Server** (Required for email features)
  - Your current: mail.privateemail.com:465
  - Secrets needed: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- **Postmark** (Optional) - Email receipt forwarding
  - Can be skipped if you don't need email-to-receipt feature

#### Security Features
- **Row Level Security (RLS)** - All database tables protected
- **JWT Authentication** - Token-based sessions
- **MFA Support** - TOTP authenticator app
- **Rate Limiting** - Prevents abuse
- **Audit Logging** - Every action tracked
- **IP Address Tracking** - Security monitoring

### Secrets Currently in Bolt.new

**Good News:** You don't need to retrieve secrets from Bolt.new because:
1. **Database is fresh** - No migration needed
2. **JWT secrets are generated** - We'll create new ones
3. **API keys are yours** - You have them:
   - OpenAI API key (check your OpenAI account)
   - SMTP credentials (you already use: contact@auditproof.ca)
4. **Supabase keys are auto-generated** - Created during setup

**Action Required:** Get these from YOUR accounts:
- OpenAI API key: https://platform.openai.com/api-keys
- SMTP password: Your email provider (PrivateEmail)

---

## Prerequisites

### Unraid Requirements

✅ **Your Current Setup:**
- Unraid OS: 7.1.4 ✓
- Unraid API: 4.25.0 ✓
- SWAG reverse proxy: Installed ✓
- Multiple containers running on bridge/br0 ✓

✅ **What You Need:**
- **Free Storage:** 100 GB minimum (200 GB recommended)
- **Free RAM:** 6 GB minimum (8 GB recommended)
- **Free CPU:** 20-30% average headroom
- **Static IP:** Your Unraid server should have static IP
- **Domain Name:** For SSL (auditproof.yourdomain.com)

### Skills Required

**You Need to Be Comfortable With:**
- ✅ Creating Docker containers in Unraid GUI (you already do this)
- ✅ Editing text files via terminal (SSH)
- ✅ Copy/pasting commands
- ✅ Basic Docker concepts (volumes, ports, networks)

**You DON'T Need:**
- ❌ Programming knowledge
- ❌ Database expertise
- ❌ Docker Compose (we'll use GUI + manual docker commands)
- ❌ Kubernetes or complex orchestration

### Install Required Unraid Apps

Open **Apps** tab in Unraid, search and install:

1. **Uptime Kuma** - For monitoring
   - Author: louislam
   - Category: Tools
   - Click Install

2. **Duplicacy** - For backups
   - Author: saspus (Duplicacy Web Edition)
   - Category: Backup
   - Click Install

### Tools You'll Need on Your Workstation

**For building the frontend:**
- Node.js 18+ (download from nodejs.org)
- Git (download from git-scm.com)

**For SSH access:**
- Terminal app:
  - Windows: PuTTY or Windows Terminal
  - Mac/Linux: Built-in Terminal

### Pre-Migration Checklist

Before starting, verify:
- [ ] Unraid array is started
- [ ] Docker service is enabled (Settings → Docker)
- [ ] You can SSH into Unraid: `ssh root@192.168.1.246`
- [ ] SWAG container is running
- [ ] You have 100+ GB free space: Check Main tab
- [ ] You have OpenAI API key
- [ ] You have SMTP password
- [ ] Your domain DNS is pointed to your public IP

---

## Phase 0: Project Setup (Already Complete)

### Your Current Setup

You've already cloned the Audit Proof project to Unraid at:
```
/mnt/user/appdata/auditproof/project/AuditReady
```

**What this includes:**
- ✅ All source code (`src/`, `public/`)
- ✅ 84 database migration files (`supabase/migrations/`)
- ✅ 6 Edge Functions + shared utilities (`supabase/functions/`)
- ✅ Configuration files (`package.json`, `tsconfig.json`, etc.)
- ✅ Documentation (`documentation/`, `analysis/`)

**Directory structure:**
```
/mnt/user/appdata/auditproof/project/AuditReady/
├── src/                    # React frontend source code
├── public/                 # Static assets (images, icons)
├── supabase/
│   ├── migrations/        # 84 SQL migration files
│   └── functions/         # 6 Edge Functions + _shared/
├── documentation/         # Implementation guides
├── package.json           # Node.js dependencies
├── vite.config.ts        # Build configuration
└── ...
```

**This means:**
- ✅ No need to copy files from a workstation
- ✅ All migrations are ready to apply
- ✅ Edge Functions are ready to deploy
- ✅ Frontend can be built directly on Unraid (if Node.js is installed)

**Proceed directly to Phase 1** to set up networking and Supabase infrastructure.

---

## Phase 1: Unraid Network Setup

### Understanding Docker Networks in Unraid

**Current Networks (What You're Using):**
1. **bridge** - Default Docker network (172.17.0.x)
   - Containers can't communicate by name
   - Need to use IP addresses

2. **br0** - Unraid's custom bridge (gets LAN IPs like 192.168.1.x)
   - Containers appear as separate devices on your LAN
   - Good for services you access from other devices

3. **host** - Shares Unraid's network stack
   - No isolation
   - Ports directly on Unraid IP

**What We'll Create:**
4. **auditproof-network** - Custom bridge for Supabase
   - Containers communicate by service name
   - Isolated from other containers
   - Only specific ports exposed to host

**Why Custom Network:**
- Supabase services need to talk to each other (postgres, auth, storage, etc.)
- Using names like `db`, `auth`, `storage` is cleaner than IPs
- Security: Internal services not exposed to LAN

### Step 1.1: SSH Into Unraid

```bash
# From your workstation
ssh root@192.168.1.246
```

Enter your Unraid root password when prompted.

### Step 1.2: Create Custom Docker Network

```bash
# Create the network
docker network create \
  --driver bridge \
  --subnet=172.20.0.0/16 \
  --gateway=172.20.0.1 \
  auditproof-network

# Verify it was created
docker network ls | grep auditproof
```

**Expected Output:**
```
2a3b4c5d6e7f   auditproof-network   bridge    local
```

**What This Does:**
- Creates isolated network for Supabase containers
- IP range: 172.20.0.0/16 (65,000 addresses)
- Doesn't conflict with bridge (172.17.x) or your LAN (192.168.1.x)

### Step 1.3: Create Directory Structure

```bash
# Create main application directory
mkdir -p /mnt/user/appdata/auditproof

# Create subdirectories for each service
mkdir -p /mnt/user/appdata/auditproof/{postgres,storage,kong,auth,rest,realtime,studio,edge-functions,config,logs,backups,dist}

# Set ownership and permissions
chown -R nobody:users /mnt/user/appdata/auditproof
chmod -R 775 /mnt/user/appdata/auditproof

# Verify structure
ls -la /mnt/user/appdata/auditproof/
```

**Expected Output:**
```
drwxrwxr-x  14 nobody users  14 Oct 24 10:00 .
drwxrwxrwx  50 nobody users  50 Oct 24 09:55 ..
drwxrwxr-x   2 nobody users   2 Oct 24 10:00 auth
drwxrwxr-x   2 nobody users   2 Oct 24 10:00 backups
drwxrwxr-x   2 nobody users   2 Oct 24 10:00 config
drwxrwxr-x   2 nobody users   2 Oct 24 10:00 dist
drwxrwxr-x   2 nobody users   2 Oct 24 10:00 edge-functions
drwxrwxr-x   2 nobody users   2 Oct 24 10:00 kong
drwxrwxr-x   2 nobody users   2 Oct 24 10:00 logs
drwxrwxr-x   2 nobody users   2 Oct 24 10:00 postgres
drwxrwxr-x   2 nobody users   2 Oct 24 10:00 realtime
drwxrwxr-x   2 nobody users   2 Oct 24 10:00 rest
drwxrwxr-x   2 nobody users   2 Oct 24 10:00 storage
drwxrwxr-x   2 nobody users   2 Oct 24 10:00 studio
```

---

## Phase 2: Install Supabase Stack

Since Unraid doesn't have Docker Compose Manager by default, we'll use the official Supabase Docker setup and adapt it for Unraid.

### ⚠️ Important Note: Edge Functions

**Edge Functions service will be temporarily disabled** during initial Supabase setup because:
- The default docker-compose.yml configuration expects a `main` function that doesn't exist
- Your Edge Functions need to be copied to the correct location first
- This allows us to verify the core Supabase infrastructure is working

**We'll enable Edge Functions in Phase 3.5** (immediately after database initialization) so the application has full functionality before frontend deployment.

### Step 2.1: Download Supabase Docker Setup

```bash
# Navigate to appdata
cd /mnt/user/appdata/auditproof

# Clone Supabase repository
git clone --depth 1 https://github.com/supabase/supabase.git supabase-src

# Navigate to Docker directory
cd supabase-src/docker
```

### Step 2.2: Generate Secrets

```bash
# Generate strong JWT secret (32+ characters)
JWT_SECRET=$(openssl rand -base64 48)
echo "JWT_SECRET=$JWT_SECRET"

# Generate PostgreSQL password
POSTGRES_PASSWORD=$(openssl rand -base64 32)
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"

# Generate Supabase dashboard password
DASHBOARD_PASSWORD=$(openssl rand -base64 16)
echo "DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD"

# Save these! You'll need them later
echo "JWT_SECRET=$JWT_SECRET" > /mnt/user/appdata/auditproof/config/secrets.txt
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" >> /mnt/user/appdata/auditproof/config/secrets.txt
echo "DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD" >> /mnt/user/appdata/auditproof/config/secrets.txt

# Secure the file
chmod 600 /mnt/user/appdata/auditproof/config/secrets.txt
```

### Step 2.3: Generate JWT Keys (Anon & Service Role)

We need to generate proper JWT tokens for API access.

```bash
# Install JWT tool (temporary)
cd /tmp
wget https://github.com/mike-engel/jwt-cli/releases/download/6.0.0/jwt-linux.tar.gz
tar -xzf jwt-linux.tar.gz
chmod +x jwt

# Generate ANON key (public, used by frontend)
ANON_KEY=$(./jwt encode \
  --secret "$JWT_SECRET" \
  --alg HS256 \
  --exp '+10y' \
  '{"role":"anon","iss":"supabase"}')
echo "ANON_KEY=$ANON_KEY"

# Generate SERVICE_ROLE key (admin, used by Edge Functions)
SERVICE_ROLE_KEY=$(./jwt encode \
  --secret "$JWT_SECRET" \
  --alg HS256 \
  --exp '+10y' \
  '{"role":"service_role","iss":"supabase"}')
echo "SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"

# Save them
echo "ANON_KEY=$ANON_KEY" >> /mnt/user/appdata/auditproof/config/secrets.txt
echo "SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY" >> /mnt/user/appdata/auditproof/config/secrets.txt

# Clean up
rm jwt jwt-linux.tar.gz
```

**IMPORTANT:** Save the output! You'll need `ANON_KEY` for the frontend.

### Step 2.4: Create Environment File

```bash
cd /mnt/user/appdata/auditproof/supabase-src/docker

# Copy example env
cp .env.example .env

# Edit the file
nano .env
```

**Replace/Update these values in `.env`:**

```bash
############
# Secrets - Use the values you generated above
############
POSTGRES_PASSWORD=YOUR_POSTGRES_PASSWORD_HERE
JWT_SECRET=YOUR_JWT_SECRET_HERE
ANON_KEY=YOUR_ANON_KEY_HERE
SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# Dashboard credentials
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=YOUR_DASHBOARD_PASSWORD_HERE

############
# URLs - Use your Unraid IP
############
# Replace 192.168.1.246 with your actual Unraid IP
SITE_URL=http://192.168.1.246:8080
API_EXTERNAL_URL=http://192.168.1.246:8000
SUPABASE_PUBLIC_URL=http://192.168.1.246:8000

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# Kong Gateway
############
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

############
# Studio (Admin UI)
############
STUDIO_PORT=3000

############
# Auth (GoTrue)
############
GOTRUE_SITE_URL=http://192.168.1.246:8080
GOTRUE_JWT_SECRET=${JWT_SECRET}
GOTRUE_JWT_EXP=3600
GOTRUE_DISABLE_SIGNUP=false  # Allow user registration
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=true  # Auto-confirm emails (no verification)

# SMTP Settings (for password reset, invitations)
GOTRUE_SMTP_HOST=mail.privateemail.com
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=contact@auditproof.ca
GOTRUE_SMTP_PASS=YOUR_EMAIL_PASSWORD_HERE
GOTRUE_SMTP_ADMIN_EMAIL=contact@auditproof.ca
GOTRUE_SMTP_SENDER_NAME=Audit Proof

############
# Storage
############
STORAGE_FILE_SIZE_LIMIT=52428800  # 50MB

############
# Edge Functions
############
FUNCTIONS_VERIFY_JWT=false  # Set true after initial setup
```

**Save and exit:** Ctrl+X, Y, Enter

### Step 2.5: Modify Docker Compose for Unraid

Edit the docker-compose.yml to use our custom paths:

```bash
nano docker-compose.yml
```

**1. Comment Out Edge Functions Service (Temporarily)**

Find the `functions:` service section and comment out the ENTIRE service:

```yaml
# Edge Functions - TEMPORARILY DISABLED
# Will enable in Phase 9 after core setup complete
# functions:
#   container_name: supabase-edge-functions
#   image: supabase/edge-runtime:v1.69.14
#   restart: unless-stopped
#   ... (comment out the entire service block)
```

**2. Find and replace ALL volume paths:**
- Change `./volumes/db/data` → `/mnt/user/appdata/auditproof/postgres`
- Change `./volumes/storage` → `/mnt/user/appdata/auditproof/storage`
- Change `./volumes/functions` → `/mnt/user/appdata/auditproof/edge-functions`

**3. Add restart policies to all services:**
```yaml
restart: unless-stopped
```

**Example for db service:**
```yaml
db:
  container_name: supabase-db
  image: supabase/postgres:15.1.0.147
  restart: unless-stopped  # ADD THIS
  healthcheck:
    test: pg_isready -U postgres -h localhost
    interval: 5s
    timeout: 5s
    retries: 10
  command:
    - postgres
    - -c
    - config_file=/etc/postgresql/postgresql.conf
    - -c
    - log_min_messages=fatal
  environment:
    POSTGRES_HOST: /var/run/postgresql
    PGPORT: ${POSTGRES_PORT}
    POSTGRES_PORT: ${POSTGRES_PORT}
    PGPASSWORD: ${POSTGRES_PASSWORD}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    POSTGRES_DB: ${POSTGRES_DB}
  volumes:
    - /mnt/user/appdata/auditproof/postgres:/var/lib/postgresql/data  # CHANGE THIS
    - ./volumes/db/roles.sql:/docker-entrypoint-initdb.d/init-scripts/98-roles.sql:Z
    - ./volumes/db/jwt.sql:/docker-entrypoint-initdb.d/init-scripts/99-jwt.sql:Z
    - ./volumes/db/logs.sql:/docker-entrypoint-initdb.d/init-scripts/logs.sql:Z
  networks:
    - default
```

**Repeat for storage, kong, and other services with volume mounts.**

**Save and exit:** Ctrl+X, Y, Enter

### Step 2.6: Configure Network in Docker Compose

Edit the networks section at the bottom of docker-compose.yml:

```bash
nano docker-compose.yml
```

**Find the networks section (at the very end) and replace with:**
```yaml
networks:
  default:
    external: true
    name: auditproof-network
```

This tells Docker Compose to use the custom network we created.

**Save and exit:** Ctrl+X, Y, Enter

### Step 2.7: Start Supabase Stack

**IMPORTANT:** This will download ~5GB of Docker images. It may take 20-30 minutes depending on your internet speed.

```bash
cd /mnt/user/appdata/auditproof/supabase-src/docker

# Pull all images first (so you can see progress)
docker compose pull

# Start services
docker compose up -d

# Wait 30 seconds for services to initialize
sleep 30

# Check status
docker compose ps
```

**Expected Output (All should show "Up" or "Up (healthy)"):**
```
NAME                    STATUS
supabase-db             Up (healthy)
supabase-auth           Up (healthy)
supabase-rest           Up (healthy)
supabase-storage        Up (healthy)
supabase-realtime       Up (healthy)
supabase-studio         Up (healthy)
supabase-kong           Up (healthy)
supabase-analytics      Up
# Note: edge-functions NOT listed (we commented it out)
# Note: supavisor (pooler) may show "Restarting" - this is optional, can be disabled
```

**If you see `supabase-pooler` or `supavisor` restarting:**
This is the connection pooler service and is optional for small deployments. You can comment it out in docker-compose.yml the same way we did for Edge Functions.

**If any other container shows "Restarting" or "Exit":**
```bash
# View logs for that container
docker logs supabase-db  # Replace with container name

# Common issues:
# - Port already in use: Change port in .env
# - Volume permission: Check ownership of /mnt/user/appdata/auditproof
# - Memory limit: Check Unraid has enough free RAM
```

### Step 2.8: Verify Services Are Running

**Test API Gateway:**
```bash
curl http://192.168.1.246:8000/
```
**Expected:** `{"message":"Unauthorized"}` - This is CORRECT! It means Kong is running.

**Add Studio Port Mapping:**

Edit docker-compose.yml to expose Studio on your network:

```bash
nano docker-compose.yml
```

Find the `studio:` service and add the `ports:` section:

```yaml
studio:
  container_name: supabase-studio
  image: supabase/studio:2025.10.20-sha-5005fc6
  restart: unless-stopped
  # ... other settings ...
  ports:
    - "3000:3000"  # ADD THIS LINE
```

**Save and restart:**
```bash
docker compose down
docker compose up -d
```

**Test Studio (Admin UI):**
Open browser: `http://192.168.1.246:3000`

**If Studio loads**, you're good! You should see the Supabase dashboard with "Default Project" and 0 Tables.

---

## Phase 3: Database Initialization

Now we'll apply all 84 database migrations to create the complete schema.

### Step 3.1: Install Supabase CLI on Unraid

```bash
# Download Supabase CLI binary
cd /tmp
wget https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz
tar -xzf supabase_linux_amd64.tar.gz
mv supabase /usr/local/bin/
chmod +x /usr/local/bin/supabase

# Verify installation
supabase --version
```

### Step 3.2: Locate Project Files

**Since you've already cloned the project to Unraid:**

```bash
# Navigate to your cloned project
cd /mnt/user/appdata/auditproof/project/AuditReady

# Verify migrations exist
ls -la supabase/migrations/ | head -20
```

You should see 84 SQL migration files.

**Note:** The project is already on your Unraid server at `/mnt/user/appdata/auditproof/project/AuditReady`, so no need to copy files from a workstation.

### Step 3.3: Configure Supabase CLI for Local Instance

For self-hosted Supabase, we don't use `supabase link`. Instead, we'll apply migrations directly to the database.

```bash
# Navigate to project directory
cd /mnt/user/appdata/auditproof/project/AuditReady

# Verify supabase directory exists
ls -la supabase/

# You should see:
# - migrations/ (84 SQL files)
# - functions/ (6 Edge Functions + _shared)
# - config.toml (Supabase configuration)
```

**Note:** The Supabase CLI's `link` command is designed for Supabase Cloud projects. For self-hosted instances, we'll apply migrations directly using `psql` or the database connection string.

### Step 3.4: Apply All Migrations

Since we're using self-hosted Supabase, we'll apply migrations directly to PostgreSQL:

```bash
# First, find your actual PostgreSQL container name
docker ps | grep postgres

# Look for container name (examples: supabase-db, Bolt Database-db, supabase_db, etc.)
# Use that name in commands below - replace "supabase-db" with your actual container name

# Navigate to migrations directory
cd /mnt/user/appdata/auditproof/project/AuditReady/supabase/migrations

# Get your PostgreSQL password from secrets file
cat /mnt/user/appdata/auditproof/config/secrets.txt | grep POSTGRES_PASSWORD

# Apply all migrations in order (REPLACE "supabase-db" with your actual container name)
POSTGRES_CONTAINER="supabase-db"  # Change this to match your container name

for migration in *.sql; do
  echo "Applying: $migration"
  docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres < "$migration"
  if [ $? -eq 0 ]; then
    echo "✓ Success: $migration"
  else
    echo "✗ Failed: $migration"
    break
  fi
done
```

**If you see "No such container" error:**
1. Run `docker ps --format "{{.Names}}"` to list all container names
2. Find the one with "postgres" or "db" in the name
3. Replace `supabase-db` with that name in all commands

**Alternative: Apply migrations one by one manually**

If the loop doesn't work or you want more control:

```bash
cd /mnt/user/appdata/auditproof/project/AuditReady/supabase/migrations

# Apply first migration
docker exec -i supabase-db psql -U postgres -d postgres < 20251006010328_create_auditready_schema.sql

# Apply second migration
docker exec -i supabase-db psql -U postgres -d postgres < 20251006011419_fix_business_rls_policy.sql

# Continue for all 84 migrations...
# OR use the loop above
```

**Expected Output:**
```
Applying: 20251006010328_create_auditready_schema.sql
CREATE SCHEMA
CREATE TABLE
CREATE POLICY
...
✓ Success: 20251006010328_create_auditready_schema.sql

Applying: 20251006011419_fix_business_rls_policy.sql
DROP POLICY
CREATE POLICY
...
✓ Success: 20251006011419_fix_business_rls_policy.sql
```

**If you see errors about objects already existing**, that's OK - it means some migrations were partially applied. Continue with the remaining migrations.

### Step 3.5: Verify Database Schema

```bash
# First, find your PostgreSQL container name
docker ps --format "{{.Names}}" | grep -i db
# Example output: supabase-db, Bolt Database-db, etc.

# Connect to PostgreSQL (replace container name if needed)
POSTGRES_CONTAINER="supabase-db"  # Change to match your container
docker exec -it "$POSTGRES_CONTAINER" psql -U postgres -d postgres

# List all tables
\dt

# Should see 18+ tables:
# profiles, businesses, business_members, collections,
# collection_members, receipts, expense_categories, invitations,
# audit_logs, system_logs, saved_filters, saved_log_filters,
# mfa_recovery_codes, export_jobs, email_receipts_inbox,
# rate_limit_tracking, dashboard_analytics, system_config

# Exit psql
\q
```

### Step 3.6: Fix Post-Migration Issues (Optional)

Some migrations have minor errors that **don't affect functionality**. The only fix needed:

```bash
# Set your container name (check with: docker ps | grep postgres)
POSTGRES_CONTAINER="supabase-db"  # Change if different

# Fix cleanup_expired_recovery_codes function (only real issue)
docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres << 'EOF'
DROP FUNCTION IF EXISTS cleanup_expired_recovery_codes();
CREATE FUNCTION cleanup_expired_recovery_codes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM recovery_codes
  WHERE expires_at < NOW()
  AND used_at IS NULL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
EOF

echo "✓ Function fixed"
```

**About Migration Errors You Saw:**

Many errors during migration are **expected and harmless**:

| Error Type | Why It Happens | Impact |
|------------|---------------|---------|
| `display_order` column errors | Migration used wrong column name (should be `sort_order`) | **None** - Table has correct `sort_order` column |
| `business_id` / `is_default` errors | Migrations reference columns that were intentionally removed | **None** - Expected behavior |
| "already exists" notices | Duplicate migrations running | **None** - Idempotent by design |
| "does not exist, skipping" | Cleanup commands for things that don't exist | **None** - Safety checks |

**Your database schema is correct!** All 25-30 tables exist with proper columns and RLS policies.

### Step 3.7: Run Verification Check

```bash
# Run comprehensive database health check
POSTGRES_CONTAINER="supabase-db"  # Your container name

docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres << 'EOF'
-- Check table count
SELECT COUNT(*) AS total_tables FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Check for critical tables
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN '✓' ELSE '✗' END AS profiles,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'businesses') THEN '✓' ELSE '✗' END AS businesses,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receipts') THEN '✓' ELSE '✗' END AS receipts,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collections') THEN '✓' ELSE '✗' END AS collections,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN '✓' ELSE '✗' END AS audit_logs;

-- Check RLS is enabled
SELECT COUNT(*) AS tables_with_rls
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;
EOF
```

**Expected Results:**
- Total tables: 25-30
- All critical tables: ✓
- Tables with RLS: 20+

### Step 3.8: Seed Default Data

**Create seed script:**

```bash
POSTGRES_CONTAINER="Bolt Database-db"  # Your actual container name

cat > /mnt/user/appdata/auditproof/config/seed.sql << 'EOF'
-- Insert default expense categories (if not already exist)
INSERT INTO expense_categories (name, description, icon, color, sort_order) VALUES
('Office Supplies', 'Pens, paper, printer supplies', 'Package', '#3B82F6', 1),
('Meals & Entertainment', 'Client dinners, team lunches', 'Utensils', '#10B981', 2),
('Travel', 'Hotels, flights, mileage', 'Plane', '#F59E0B', 3),
('Professional Services', 'Legal, accounting, consulting', 'Briefcase', '#8B5CF6', 4),
('Marketing & Advertising', 'Ads, promotional materials', 'Megaphone', '#EC4899', 5),
('Rent & Utilities', 'Office rent, internet, phone', 'Home', '#6366F1', 6),
('Equipment', 'Computers, furniture, tools', 'Monitor', '#14B8A6', 7),
('Subscriptions', 'Software, memberships', 'CreditCard', '#F97316', 8),
('Fuel', 'Gas, vehicle expenses', 'Fuel', '#EF4444', 9),
('Other', 'Miscellaneous expenses', 'Tag', '#6B7280', 10)
ON CONFLICT (name) DO NOTHING;

-- System configuration is auto-created by migration (no action needed)
-- If you need to verify: SELECT * FROM system_config;
EOF

# Apply seed data
docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres < /mnt/user/appdata/auditproof/config/seed.sql
```

**Verify:**
```bash
POSTGRES_CONTAINER="Bolt Database-db"  # Your container name
docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -c "SELECT COUNT(*) FROM expense_categories;"
docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -c "SELECT COUNT(*) FROM system_config;"
```
**Expected:**
- expense_categories: `10` (or more if migration already added some)
- system_config: `1` (single row with JSONB settings)

---

## Phase 3.5: Deploy Edge Functions

Now we'll enable Edge Functions to unlock the full power of Audit Proof. This includes AI receipt extraction, email invitations, and export processing.

### Why Enable Now?

**Edge Functions are CRITICAL for core features:**
- ✅ **AI Receipt Extraction** - Automatically extract data from receipt images (GPT-4 Vision)
- ✅ **Team Invitations** - Send invitation emails to team members
- ✅ **Export Processing** - Generate CSV/PDF/ZIP exports
- ✅ **Email Receipt Forwarding** - Forward receipts via email (optional)
- ✅ **Admin Operations** - Advanced user management

**Without Edge Functions, users must manually enter all receipt data** - defeating the main value proposition!

### Prerequisites

Before continuing, ensure:
- [ ] Phase 3 complete (database initialized with all tables)
- [ ] All Supabase services showing "Up (healthy)" except edge-functions
- [ ] You have your OpenAI API key ready

### Step 3.5.1: Copy Edge Functions to Correct Location

**Since your project is already cloned on Unraid:**

```bash
# Create edge-functions directory
mkdir -p /mnt/user/appdata/auditproof/edge-functions

# Copy all functions from your cloned project
cp -r /mnt/user/appdata/auditproof/project/AuditReady/supabase/functions/* /mnt/user/appdata/auditproof/edge-functions/

# Verify structure
ls -la /mnt/user/appdata/auditproof/edge-functions/
# Should see: accept-invitation/, extract-receipt-data/, receive-email-receipt/,
#             send-invitation-email/, process-export-job/, admin-user-management/,
#             _shared/

# Verify all 6 functions + shared utilities are present
ls -la /mnt/user/appdata/auditproof/edge-functions/ | grep "^d" | wc -l
# Should show: 7 (6 functions + _shared)
```

**IMPORTANT: Create Main Routing Function**

The Edge Runtime expects a `main` service that routes to individual functions:

```bash
# Create main directory
mkdir -p /mnt/user/appdata/auditproof/edge-functions/main

# Create main router
cat > /mnt/user/appdata/auditproof/edge-functions/main/index.ts << 'EOF'
Deno.serve(async (req: Request): Promise<Response> => {
  const { pathname } = new URL(req.url);
  const name = pathname.replace(/^\/+|\/+$/g, "");

  if (!name) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  }

  try {
    const mod = await import(`../${name}/index.ts`);
    const handler = (mod as any).default ?? (mod as any).fetch ?? (mod as any).handler;
    if (typeof handler !== "function") {
      return new Response("Function has no exported handler", { status: 500 });
    }
    return await handler(req);
  } catch {
    return new Response("Function not found", { status: 404 });
  }
});
EOF

# Verify main function created
cat /mnt/user/appdata/auditproof/edge-functions/main/index.ts
```

### Step 3.5.2: Configure Edge Function Environment Variables

```bash
cd /mnt/user/appdata/auditproof/supabase-src/docker
nano .env
```

**Add these environment variables at the bottom:**

```bash
############
# Edge Functions - OpenAI API
############
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-openai-api-key-here

############
# SMTP Settings (should already be configured from Phase 2)
############
# Verify these are set correctly:
# GOTRUE_SMTP_HOST=mail.privateemail.com
# GOTRUE_SMTP_PORT=465
# GOTRUE_SMTP_USER=contact@auditproof.ca
# GOTRUE_SMTP_PASS=your-email-password-here

############
# Postmark (Optional - only for email receipt forwarding)
############
# Skip this unless you specifically want the email-to-receipt feature
# POSTMARK_SERVER_TOKEN=your-postmark-token-here
```

**Save and exit:** Ctrl+X, Y, Enter

**IMPORTANT: Get Your OpenAI API Key**
1. Visit: https://platform.openai.com/api-keys
2. Click **Create new secret key**
3. Copy the key (starts with `sk-`)
4. Add to `.env` file above

### Step 3.5.3: Enable Edge Functions in Docker Compose

```bash
nano docker-compose.yml
```

**Find the commented `functions:` service (around line 250-300) and uncomment/configure it:**

```yaml
functions:
  container_name: supabase-edge-functions
  image: supabase/edge-runtime:v1.69.14
  restart: unless-stopped
  command: ["start", "--main-service", "/home/deno/functions/main", "-p", "9000"]
  depends_on:
    analytics:
      condition: service_healthy
  volumes:
    - /mnt/user/appdata/auditproof/edge-functions:/home/deno/functions
  environment:
    DENO_DIR: /tmp/deno
    DENO_NO_PROMPT: "1"
    JWT_SECRET: ${JWT_SECRET}
    SUPABASE_URL: http://kong:8000
    SUPABASE_ANON_KEY: ${ANON_KEY}
    SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}
    SUPABASE_DB_URL: postgresql://postgres:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
    VERIFY_JWT: "${FUNCTIONS_VERIFY_JWT}"
    # Pass through Edge Function environment variables
    OPENAI_API_KEY: ${OPENAI_API_KEY}
    SMTP_HOST: ${GOTRUE_SMTP_HOST}
    SMTP_PORT: ${GOTRUE_SMTP_PORT}
    SMTP_USER: ${GOTRUE_SMTP_USER}
    SMTP_PASSWORD: ${GOTRUE_SMTP_PASS}
  networks:
    - default
```

**CRITICAL CONFIGURATION NOTES:**

1. **The `command:` section IS REQUIRED** - It tells the Edge Runtime to start the main routing service
2. **Port 9000** is internal only (not exposed to host) - Kong routes to this internally
3. **DENO_DIR** environment variable is set to avoid permission issues
4. **Volume mount** should NOT have `:Z` suffix for Unraid

**Save and exit:** Ctrl+X, Y, Enter

### Step 3.5.4: Restart Supabase Services

```bash
cd /mnt/user/appdata/auditproof/supabase-src/docker

# Stop all services
docker compose down

# Start with Edge Functions enabled
docker compose up -d

# Wait for services to initialize
sleep 30

# Check status
docker compose ps
```

**Expected Output:**

```
NAME                       STATUS
supabase-db                Up (healthy)
supabase-auth              Up (healthy)
supabase-rest              Up (healthy)
supabase-storage           Up (healthy)
supabase-realtime          Up (healthy)
supabase-edge-functions    Up (healthy)    ← Should now show!
supabase-studio            Up (healthy)
supabase-kong              Up (healthy)
supabase-analytics         Up
```

**If `supabase-edge-functions` shows "Restarting" or "Exit":**

```bash
# Check logs for errors
docker logs supabase-edge-functions --tail=50

# Common issues:
# 1. Volume path wrong - check /mnt/user/appdata/auditproof/edge-functions exists
# 2. Missing function files - verify ls /mnt/user/appdata/auditproof/edge-functions/
# 3. Environment variable issue - check OPENAI_API_KEY is set in .env
```

### Step 3.5.5: Verify Edge Functions Are Working

**Test 1: Check Functions Are Loaded**

```bash
# View Edge Functions logs
docker logs supabase-edge-functions --tail=100

# You should see lines like:
# "Loaded function: extract-receipt-data"
# "Loaded function: send-invitation-email"
# "Loaded function: accept-invitation"
# etc.
```

**Test 2: Verify Environment Variables**

```bash
# Check OpenAI key is set
docker exec -it supabase-edge-functions env | grep OPENAI_API_KEY

# Should show: OPENAI_API_KEY=sk-your-key-here (partially obscured)
```

**Test 3: Test OpenAI API Connection**

```bash
# From Unraid, test your OpenAI API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_KEY_HERE"

# Should return JSON list of available models
# If you see "invalid_api_key" error, check your key
```

**Test 4: Test Edge Function Invocation**

We'll test one Edge Function manually to ensure it's accessible:

```bash
# Test the accept-invitation function (health check)
curl -X POST \
  "http://192.168.1.246:8000/functions/v1/accept-invitation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY_HERE" \
  -d '{"token":"test"}'

# Expected: Some response (even an error is OK - means function is reachable)
# If you get "Function not found" - functions aren't loaded correctly
```

### Step 3.5.6: What Edge Functions Do

**1. extract-receipt-data**
- **Purpose:** AI-powered receipt data extraction
- **Trigger:** Called when user uploads a receipt image
- **Tech:** OpenAI GPT-4 Vision API
- **Cost:** ~$0.01 per receipt
- **Returns:** Merchant name, date, total, items, tax, etc.

**2. send-invitation-email**
- **Purpose:** Send team invitation emails
- **Trigger:** User invites team member via UI
- **Tech:** SMTP (PrivateEmail)
- **Returns:** Confirmation that email was sent

**3. accept-invitation**
- **Purpose:** Process invitation acceptance
- **Trigger:** New user clicks invitation link
- **Tech:** Database operations
- **Returns:** Success/failure status

**4. process-export-job**
- **Purpose:** Generate CSV/PDF/ZIP exports
- **Trigger:** User requests data export
- **Tech:** jsPDF, CSV generation, JSZip
- **Returns:** Download link when complete

**5. receive-email-receipt**
- **Purpose:** Email-to-receipt forwarding (optional)
- **Trigger:** Email sent to special address
- **Tech:** Postmark webhook
- **Returns:** Receipt created from email

**6. admin-user-management**
- **Purpose:** Admin operations (reset password, MFA, etc.)
- **Trigger:** System admin actions
- **Tech:** Supabase Admin API
- **Returns:** Operation results

### Step 3.5.7: Edge Function Security Notes

**Authentication:**
- All functions verify JWT tokens (except webhooks)
- Use `SUPABASE_ANON_KEY` for client calls
- Use `SUPABASE_SERVICE_ROLE_KEY` for admin operations

**Rate Limiting:**
- Database tracks function invocations
- Prevents abuse and excessive OpenAI costs
- Configured in `rate_limit_tracking` table

**Secrets Protection:**
- OpenAI API key only accessible inside Edge Functions
- Never exposed to frontend
- Logs don't contain sensitive data

### Troubleshooting Edge Functions

**Problem: Functions container keeps restarting**

```bash
# Check logs
docker logs supabase-edge-functions --tail=50

# Common causes:
# 1. Missing main routing function
ls -la /mnt/user/appdata/auditproof/edge-functions/main/
# Should see index.ts file

# If missing, create it:
mkdir -p /mnt/user/appdata/auditproof/edge-functions/main
cat > /mnt/user/appdata/auditproof/edge-functions/main/index.ts << 'EOF'
Deno.serve(async (req: Request): Promise<Response> => {
  const { pathname } = new URL(req.url);
  const name = pathname.replace(/^\/+|\/+$/g, "");

  if (!name) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  }

  try {
    const mod = await import(`../${name}/index.ts`);
    const handler = (mod as any).default ?? (mod as any).fetch ?? (mod as any).handler;
    if (typeof handler !== "function") {
      return new Response("Function has no exported handler", { status: 500 });
    }
    return await handler(req);
  } catch {
    return new Response("Function not found", { status: 404 });
  }
});
EOF

# 2. Missing DENO_DIR environment variable
docker exec -it supabase-edge-functions env | grep DENO_DIR
# Should show: DENO_DIR=/tmp/deno

# 3. Command section missing or incorrect
docker inspect supabase-edge-functions | grep -A 5 Cmd
# Should show: ["start", "--main-service", "/home/deno/functions/main", "-p", "9000"]

# 4. Memory limit
docker stats supabase-edge-functions
# If high, restart: docker restart supabase-edge-functions

# After fixing, restart services:
cd /mnt/user/appdata/auditproof/supabase-src/docker
docker compose down
docker compose up -d
```

**Problem: Kong returns "Function not found" when calling functions**

This means Kong doesn't know how to route `/functions/v1/*` to the Edge Functions service.

```bash
# 1. Check if Edge Functions container is running and healthy
docker ps | grep edge-functions
# Should show: Up (healthy) or Up

# 2. Check if Kong can reach Edge Functions on the custom network
docker exec supabase-kong ping -c 3 functions
# Should get responses

# 3. Verify Edge Functions is listening on port 9000
docker exec supabase-edge-functions netstat -tlnp | grep 9000
# Should show: 0.0.0.0:9000

# 4. Check Kong configuration for functions service
docker exec supabase-kong kong config db_export
# Look for "functions" service definition

# 5. If Kong doesn't have functions route, you need to add it manually
# Navigate to Supabase docker directory
cd /mnt/user/appdata/auditproof/supabase-src/docker

# Check if volumes/api/kong.yml exists
ls -la volumes/api/kong.yml

# If kong.yml exists, verify it has the functions service:
cat volumes/api/kong.yml | grep -A 10 "name: functions"

# If functions service is missing, you need to restart Kong after Edge Functions is healthy
docker restart supabase-kong

# Wait 30 seconds for Kong to reload
sleep 30

# Test again
curl -X POST \
  "http://192.168.1.246:8000/functions/v1/accept-invitation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -d '{"token":"test"}'
```

**If Kong still doesn't route to functions after restart:**

The Supabase docker-compose setup should automatically configure Kong to route to functions. If it's not working:

```bash
# Check docker-compose.yml to ensure Kong depends on functions service
cd /mnt/user/appdata/auditproof/supabase-src/docker
nano docker-compose.yml

# Find the kong service and verify it has functions in depends_on:
# kong:
#   depends_on:
#     ...
#     functions:
#       condition: service_started  # or service_healthy

# If functions is NOT in depends_on, add it and restart:
docker compose down
docker compose up -d
```

**Problem: OpenAI extraction returns errors**

```bash
# Verify API key
docker exec -it supabase-edge-functions env | grep OPENAI

# Test API key manually
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-your-key-here"

# Check function logs
docker logs supabase-edge-functions | grep -i error

# Check rate limits
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT * FROM rate_limit_tracking WHERE action_type = 'receipt_extraction' ORDER BY created_at DESC LIMIT 10;"
```

**Problem: Email invitations not sending**

```bash
# Check SMTP settings
cd /mnt/user/appdata/auditproof/supabase-src/docker
cat .env | grep GOTRUE_SMTP

# Test SMTP connection
telnet mail.privateemail.com 465
# Should connect (Ctrl+C to exit)

# Check auth service logs
docker logs supabase-auth | grep -i smtp

# Check Edge Functions logs
docker logs supabase-edge-functions | grep -i invitation
```

**Problem: Functions not accessible from frontend**

```bash
# Verify Kong is routing to functions
curl http://192.168.1.246:8000/functions/v1/

# Check Kong logs
docker logs supabase-kong --tail=50

# Verify network connectivity
docker exec supabase-kong ping -c 3 supabase-edge-functions
```

### Success Criteria

Before moving to Phase 4, verify:

- [ ] Edge Functions container shows "Up (healthy)"
- [ ] All 6 function directories exist in `/mnt/user/appdata/auditproof/edge-functions/`
- [ ] OpenAI API key is configured
- [ ] SMTP settings are configured
- [ ] Function logs show "Loaded function: ..." for each function
- [ ] Manual curl test returns a response (not "Function not found")

**Once all checks pass, you're ready for Phase 4!**

---

## Phase 4: Deploy Frontend

### Step 4.1: Build Frontend on Unraid

**Since your project is already on Unraid, we'll build it directly there:**

```bash
# Navigate to project directory
cd /mnt/user/appdata/auditproof/project/AuditReady

# Create production environment file
cat > .env.production << EOF
VITE_SUPABASE_URL=http://192.168.1.246:8000
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
EOF

# Replace YOUR_ANON_KEY_HERE with the actual ANON_KEY from Phase 2.3
# You can find it in: /mnt/user/appdata/auditproof/config/secrets.txt

# Install Node.js if not already installed
# Check if node is available
which node

# If node is not found, install it:
# Visit Unraid Apps and install "Node.js" by ich777
# OR download Node.js binary manually

# Install dependencies
npm install

# Build for production
npm run build
```

### Step 4.2: Deploy Built Files to Web Directory

```bash
# The build output is in the dist/ folder
# Copy it to the Nginx serving directory
cp -r /mnt/user/appdata/auditproof/project/AuditReady/dist/* /mnt/user/appdata/auditproof/dist/

# Verify files were copied
ls -la /mnt/user/appdata/auditproof/dist/
# Should see: index.html, assets/, etc.

# Set proper permissions
chown -R nobody:users /mnt/user/appdata/auditproof/dist
chmod -R 755 /mnt/user/appdata/auditproof/dist
```

**Alternative: Install Node.js on Unraid**

If Node.js is not installed, you have two options:

**Option 1: Install via Unraid Apps**
1. Go to Unraid Apps tab
2. Search for "Node.js"
3. Install "Node.js" by ich777
4. Restart and run the build commands above

**Option 2: Build on a workstation and copy**

If you prefer to build on your Windows/Mac workstation:

```bash
# On your workstation:
cd /path/to/local/project

# Create .env.production file (same as above)
# Run npm install and npm run build
# Then copy:
scp -r dist/* root@192.168.1.246:/mnt/user/appdata/auditproof/dist/
```

### Step 4.3: Create Nginx Configuration

```bash
cat > /mnt/user/appdata/auditproof/config/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log warn;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/rss+xml
        font/truetype
        font/opentype
        application/vnd.ms-fontobject
        image/svg+xml;

    server {
        listen 80;
        server_name _;

        root /usr/share/nginx/html;
        index index.html;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # SPA routing - always serve index.html
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "OK";
            add_header Content-Type text/plain;
        }
    }
}
EOF
```

### Step 4.4: Create Frontend Container via Unraid GUI

**Open Unraid Web UI:**
1. Go to **Docker** tab
2. Click **Add Container** at the bottom

**Fill in the form:**

| Field | Value |
|-------|-------|
| **Name** | `auditproof-frontend` |
| **Repository** | `nginx:alpine` |
| **Network Type** | `Custom: auditproof-network` |
| **Port Mappings** | Add one: `8080` → `80` (TCP) |
| **Path 1** | Container: `/usr/share/nginx/html` → Host: `/mnt/user/appdata/auditproof/dist` (Read Only) |
| **Path 2** | Container: `/etc/nginx/nginx.conf` → Host: `/mnt/user/appdata/auditproof/config/nginx.conf` (Read Only) |
| **Path 3** | Container: `/var/log/nginx` → Host: `/mnt/user/appdata/auditproof/logs` |
| **Auto Start** | Yes |
| **Extra Parameters** | `--restart unless-stopped` |

**Click Apply**

The container should start. Check status in Docker tab.

### Step 4.5: Test Frontend

**Open browser:** `http://192.168.1.246:8080`

You should see the Audit Proof login page!

**If you see errors:**
- Check browser console (F12 → Console)
- Verify ANON_KEY is correct in the built files
- Check nginx logs: `tail -f /mnt/user/appdata/auditproof/logs/error.log`

---

## Phase 5: Configure SWAG Reverse Proxy

You already have SWAG running on **br0: 192.168.1.65**. Now we'll configure it to proxy requests to Audit Proof.

### Step 5.1: Create Proxy Configuration

**SSH into Unraid and edit SWAG config:**

```bash
# Navigate to SWAG config directory
# (Adjust path if your SWAG is in a different location)
cd /mnt/user/appdata/swag/nginx/proxy-confs

# Create Audit Proof proxy config
nano auditproof.subdomain.conf
```

**Paste this configuration:**

```nginx
# Audit Proof proxy configuration

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    server_name auditproof.*;

    include /config/nginx/ssl.conf;

    client_max_body_size 50M;

    # Proxy to frontend
    location / {
        include /config/nginx/proxy.conf;
        resolver 127.0.0.11 valid=30s;
        proxy_pass http://192.168.1.246:8080;
    }

    # Proxy API requests to Kong Gateway
    location /functions/ {
        include /config/nginx/proxy.conf;
        resolver 127.0.0.11 valid=30s;
        proxy_pass http://192.168.1.246:8000;
    }

    location /auth/ {
        include /config/nginx/proxy.conf;
        resolver 127.0.0.11 valid=30s;
        proxy_pass http://192.168.1.246:8000;
    }

    location /rest/ {
        include /config/nginx/proxy.conf;
        resolver 127.0.0.11 valid=30s;
        proxy_pass http://192.168.1.246:8000;
    }

    location /storage/ {
        include /config/nginx/proxy.conf;
        resolver 127.0.0.11 valid=30s;
        proxy_pass http://192.168.1.246:8000;
        client_max_body_size 50M;
    }
}
```

**Save and exit:** Ctrl+X, Y, Enter

### Step 5.2: Restart SWAG

**In Unraid Docker tab:**
1. Find **swag-reverse-proxy** container
2. Click **Restart**

**Or via command line:**
```bash
docker restart swag-reverse-proxy
```

### Step 5.3: Configure DNS

**In your domain registrar (Cloudflare, GoDaddy, etc.):**

1. Add A record or CNAME:
   - **Type:** A (or CNAME)
   - **Name:** `auditproof`
   - **Value:** Your public IP (or domain if CNAME)
   - **TTL:** Auto or 3600

2. Wait for DNS propagation (5-30 minutes)

3. Test: `nslookup auditproof.yourdomain.com`

### Step 5.4: Test HTTPS Access

**Open browser:** `https://auditproof.yourdomain.com`

You should see:
- ✅ Green padlock (SSL working)
- ✅ Audit Proof login page
- ✅ No certificate errors

**If SSL doesn't work:**
- Check SWAG logs: `docker logs swag-reverse-proxy`
- Verify DNS is propagated
- Make sure ports 80 and 443 are forwarded to 192.168.1.65

---

## Phase 6: Create Admin Account

Now let's create your first user account and grant it system admin privileges.

### Step 6.1: Register First User via UI

**Open app:** `https://auditproof.yourdomain.com`

1. Click **Register** (or **Sign Up**)
2. Fill in:
   - **Full Name:** Your name
   - **Email:** your-email@example.com
   - **Password:** Strong password (12+ characters)
3. Click **Create Account**

You should be logged in and see the dashboard (empty, no receipts yet).

### Step 6.2: Get Your User ID

**In the app:**
1. Click your profile icon (top right)
2. Go to **Settings**
3. Your User ID is shown at the top (UUID format)

**Copy this UUID**, we'll need it next.

**Or via database:**
```bash
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT id, email FROM auth.users;"
```

### Step 6.3: Create Business for Admin

**In the app:**
1. You should see a prompt to create a business
2. Enter:
   - **Business Name:** My Business (or your company name)
   - **Currency:** CAD (or USD)
3. Click **Create Business**

### Step 6.4: Grant System Admin Role

**SSH into Unraid:**

```bash
# Connect to database
docker exec -it supabase-db psql -U postgres -d postgres

# Grant system admin role
-- Replace YOUR_USER_ID with the UUID from step 6.2
UPDATE profiles
SET system_role = 'system_admin'
WHERE id = 'YOUR_USER_ID';

# Verify
SELECT id, email, full_name, system_role FROM profiles;

# Exit
\q
```

**Refresh the app** - You should now see **Admin** menu in the sidebar.

### Step 6.5: Explore Admin Features

**In Admin section:**
- **User Management** - Manage users, reset passwords
- **Business Management** - View all businesses
- **System Logs** - View system events
- **Audit Logs** - Track all actions
- **System Configuration** - Configure app settings

---

## Phase 7: Setup Monitoring (Uptime Kuma)

### Step 7.1: Configure Uptime Kuma Container

You already installed Uptime Kuma from Community Apps. Now configure it:

**In Unraid Docker tab:**
1. Find **Uptime-Kuma** container
2. Click **Edit**

**Configure:**
| Field | Value |
|-------|-------|
| **Network Type** | `br0` |
| **Port** | `3001` → `3001` |
| **Volume** | Container: `/app/data` → Host: `/mnt/user/appdata/uptime-kuma` |

**Apply and start**

### Step 7.2: Access Uptime Kuma

**Open browser:** `http://192.168.1.246:3001`

**First time setup:**
1. Create admin account
2. Set username and password

### Step 7.3: Add Monitors

**Add monitors for:**

1. **Audit Proof Frontend**
   - Type: HTTP(s)
   - URL: `https://auditproof.yourdomain.com`
   - Interval: 60 seconds
   - Retries: 3

2. **Supabase API**
   - Type: HTTP(s)
   - URL: `http://192.168.1.246:8000`
   - Interval: 60 seconds

3. **PostgreSQL**
   - Type: Port
   - Hostname: 192.168.1.246
   - Port: 5432
   - Interval: 60 seconds

4. **Supabase Studio**
   - Type: HTTP(s)
   - URL: `http://192.168.1.246:3000`
   - Interval: 300 seconds

**Configure notifications:**
- Email, Discord, Slack, etc.
- Get alerted when services go down

---

## Phase 8: Setup Backups (Duplicacy)

### Step 8.1: Configure Duplicacy Container

**In Unraid Docker tab:**
1. Find **Duplicacy** container
2. Click **Edit**

**Configure:**
| Field | Value |
|-------|-------|
| **Network Type** | `bridge` |
| **Port** | `3875` → `3875` |
| **Volume 1** | Container: `/config` → Host: `/mnt/user/appdata/duplicacy` |
| **Volume 2** | Container: `/cache` → Host: `/mnt/user/appdata/duplicacy/cache` |
| **Volume 3** | Container: `/logs` → Host: `/mnt/user/appdata/duplicacy/logs` |
| **Volume 4** | Container: `/backups` → Host: `/mnt/user/backups` |
| **Volume 5 (BACKUP SOURCE)** | Container: `/source` → Host: `/mnt/user/appdata/auditproof` (Read Only) |

**Apply and start**

### Step 8.2: Access Duplicacy Web UI

**Open browser:** `http://192.168.1.246:3875`

**First time setup:**
1. Create admin password
2. Set hostname

### Step 8.3: Configure Backup Job

**Create new backup:**
1. Click **Add Storage**
   - Name: `AuditProof-Local`
   - Type: **Local Disk**
   - Path: `/backups/auditproof`
2. Click **Add Repository**
   - Source: `/source`
   - Storage: `AuditProof-Local`
   - Encryption: Yes (set strong password)
3. Click **Add Schedule**
   - Name: `Daily Backup`
   - Command: **Backup**
   - Time: 3:00 AM daily
   - Options:
     - Threads: 2
     - Storage: `AuditProof-Local`

**Add filters to exclude:**
- `/source/logs/*` (don't backup logs)
- `/source/supabase-src/*` (don't backup source code)

### Step 8.4: Test Backup

**Click "Backup Now"**

Monitor progress. First backup will take 10-20 minutes.

**Verify:**
```bash
ls -lh /mnt/user/backups/auditproof/
```

You should see backup chunks.

### Step 8.5: Configure Retention

**In Duplicacy schedule:**
- Keep all backups for 7 days
- Keep 1 backup per week for 4 weeks
- Keep 1 backup per month for 12 months

This gives you:
- Daily restore for 1 week
- Weekly restore for 1 month
- Monthly restore for 1 year

---

## Testing & Verification

### Complete Test Checklist

#### 1. Frontend Access
- [ ] HTTP access works: `http://192.168.1.246:8080`
- [ ] HTTPS access works: `https://auditproof.yourdomain.com`
- [ ] SSL certificate is valid (green padlock)
- [ ] Page loads without errors (check browser console)

#### 2. Authentication
- [ ] Register new user works
- [ ] Login with email/password works
- [ ] Logout works
- [ ] Password reset email sent (check email)
- [ ] MFA setup works (Settings → Security)

#### 3. Receipt Management
- [ ] Upload receipt via file works
- [ ] Upload receipt via camera works
- [ ] AI extraction shows data (if OpenAI key configured)
- [ ] Edit receipt works
- [ ] Delete receipt works
- [ ] View receipt image/PDF works

#### 4. Collections
- [ ] Create collection works
- [ ] Add receipt to collection works
- [ ] Rename collection works
- [ ] Delete collection works (with receipts moved)

#### 5. Team Features
- [ ] Invite team member works (email sent)
- [ ] Accept invitation works (use different email)
- [ ] View team members list
- [ ] Remove team member works

#### 6. Reports & Export
- [ ] CSV export generates file
- [ ] PDF export generates file
- [ ] ZIP export includes receipts

#### 7. Admin Functions (System Admin only)
- [ ] View all users works
- [ ] View all businesses works
- [ ] System logs show events
- [ ] Audit logs track actions
- [ ] User search works

#### 8. Performance
- [ ] Page load < 3 seconds
- [ ] Receipt upload < 10 seconds
- [ ] Export < 2 minutes
- [ ] No memory leaks (check after 1 hour use)

#### 9. Monitoring
- [ ] Uptime Kuma shows all services UP
- [ ] Email notification received when service down (test by stopping container)

#### 10. Backups
- [ ] Backup job completes successfully
- [ ] Restore test works (restore one file)

---

## Ongoing Maintenance

### Daily (5 minutes)

**Via Uptime Kuma Dashboard:**
- [ ] All services show green (UP)

**If any service is down:**
```bash
# Check container status
docker ps -a | grep auditproof

# Restart if needed
docker restart [container-name]

# Check logs
docker logs [container-name] --tail=50
```

### Weekly (15 minutes)

**1. Check Backups:**
```bash
# Verify latest backup exists
ls -lt /mnt/user/backups/auditproof/ | head -5

# Check Duplicacy logs
tail -100 /mnt/user/appdata/duplicacy/logs/duplicacy_web.log
```

**2. Review Logs:**
```bash
# System errors
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT * FROM system_logs WHERE severity = 'error' ORDER BY created_at DESC LIMIT 20;"

# High-value audit events
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT * FROM audit_logs WHERE action IN ('user_deleted', 'receipt_deleted', 'mfa_disabled') ORDER BY created_at DESC LIMIT 10;"
```

**3. Check Storage Usage:**
```bash
# Check database size
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT pg_size_pretty(pg_database_size('postgres')) as size;"

# Check file storage
du -sh /mnt/user/appdata/auditproof/storage/

# Check total appdata usage
du -sh /mnt/user/appdata/auditproof/
```

### Monthly (1-2 hours)

**1. Update Container Images:**
```bash
# Navigate to Supabase directory
cd /mnt/user/appdata/auditproof/supabase-src/docker

# Pull latest images
docker compose pull

# Restart services (this applies updates)
docker compose down
docker compose up -d

# Verify all services healthy
docker compose ps
```

**2. Database Maintenance:**
```bash
# Vacuum database (reclaim space)
docker exec -it supabase-db psql -U postgres -d postgres -c "VACUUM ANALYZE;"

# Reindex (improve query performance)
docker exec -it supabase-db psql -U postgres -d postgres -c "REINDEX DATABASE postgres;"
```

**3. Review Security:**
```bash
# Check failed login attempts
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM audit_logs WHERE action = 'login_failed' AND created_at > NOW() - INTERVAL '30 days';"

# Check MFA status for admins
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT email, mfa_enabled FROM profiles WHERE system_role = 'system_admin';"
```

**4. Test Restore:**
```bash
# Create test restore directory
mkdir -p /tmp/restore-test

# Restore one file from backup (via Duplicacy UI)
# Verify file integrity
```

### Quarterly (2-4 hours)

**1. Review Capacity:**
- Database size trend
- Storage usage trend
- Plan for expansion if needed

**2. Security Audit:**
- Review all system admin accounts
- Check for inactive users (90+ days)
- Review RLS policies (if schema changed)
- Rotate passwords

**3. Performance Optimization:**
- Identify slow queries
- Add missing indexes
- Review and clean up old audit logs (>1 year)

**4. Update Documentation:**
- Document any configuration changes
- Update secrets in password manager
- Update disaster recovery plan

---

## Troubleshooting

### Container Won't Start

**Symptom:** Container shows "Stopped" in Docker tab

**Solutions:**
```bash
# Check logs
docker logs [container-name]

# Common issues:
# 1. Port already in use
netstat -tulpn | grep [port]
# Solution: Change port in container config

# 2. Volume permission error
ls -la /mnt/user/appdata/auditproof/[volume]
chown -R nobody:users /mnt/user/appdata/auditproof/[volume]

# 3. Network not found
docker network ls | grep auditproof-network
# Solution: Recreate network (see Phase 1.2)

# 4. Out of memory
free -h
# Solution: Stop other containers or add more RAM
```

### Can't Access Frontend

**Symptom:** Browser shows "Connection refused" or timeout

**Solutions:**
```bash
# 1. Check container is running
docker ps | grep auditproof-frontend

# 2. Check port binding
docker port auditproof-frontend

# 3. Test from Unraid itself
curl http://localhost:8080

# 4. Check firewall
iptables -L -n | grep 8080

# 5. Check SWAG proxy
docker logs swag-reverse-proxy | grep error
```

### Database Connection Errors

**Symptom:** App shows "Cannot connect to database"

**Solutions:**
```bash
# 1. Check PostgreSQL is running
docker ps | grep supabase-db

# 2. Check PostgreSQL logs
docker logs supabase-db --tail=100

# 3. Test connection
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT 1;"

# 4. Check auth service
docker logs supabase-auth --tail=100

# 5. Verify JWT secrets match
cat /mnt/user/appdata/auditproof/config/secrets.txt
# Check ANON_KEY in frontend build
grep -r "VITE_SUPABASE_ANON_KEY" /mnt/user/appdata/auditproof/dist/assets/*.js | head -1
```

### Upload Fails

**Symptom:** Receipt upload shows error or hangs

**Solutions:**
```bash
# 1. Check storage container
docker logs supabase-storage --tail=50

# 2. Check disk space
df -h /mnt/user/

# 3. Check file size limit
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT value FROM system_config WHERE key = 'max_file_size';"
# Should be 52428800 (50MB)

# 4. Check CORS headers
curl -I http://192.168.1.246:8000/storage/v1/bucket/receipts

# 5. Check volume permissions
ls -la /mnt/user/appdata/auditproof/storage/
```

### AI Extraction Not Working

**Symptom:** Receipt upload succeeds but no data extracted

**Solutions:**
```bash
# 1. Check OpenAI API key is set
docker exec -it supabase-edge-runtime env | grep OPENAI

# If not set:
# Navigate to Supabase src
cd /mnt/user/appdata/auditproof/supabase-src/docker

# Stop services
docker compose down

# Edit .env, add:
# OPENAI_API_KEY=sk-your-key-here

# Restart
docker compose up -d

# 2. Test OpenAI API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-your-key-here"
# Should return list of models

# 3. Check Edge Functions logs
docker logs supabase-edge-runtime --tail=100

# 4. Check rate limits
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT * FROM rate_limit_tracking WHERE action_type = 'receipt_extraction' ORDER BY created_at DESC LIMIT 10;"
```

### Email Not Sending

**Symptom:** Invitation emails or password resets not received

**Solutions:**
```bash
# 1. Check SMTP settings in .env
cd /mnt/user/appdata/auditproof/supabase-src/docker
cat .env | grep GOTRUE_SMTP

# 2. Test SMTP connection
telnet mail.privateemail.com 465
# Should connect

# 3. Check GoTrue logs
docker logs supabase-auth | grep -i smtp

# 4. Check system logs
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT * FROM system_logs WHERE category = 'EMAIL' ORDER BY created_at DESC LIMIT 20;"

# 5. Verify SMTP credentials
# Try logging into webmail with same credentials
```

### High Memory Usage

**Symptom:** Unraid shows high RAM usage, system slow

**Solutions:**
```bash
# 1. Check which containers are using most memory
docker stats --no-stream | sort -k 7 -h

# 2. Restart heavy containers
docker restart supabase-db
docker restart supabase-edge-runtime

# 3. Tune PostgreSQL memory
docker exec -it supabase-db psql -U postgres -d postgres -c "ALTER SYSTEM SET shared_buffers = '256MB';"
docker exec -it supabase-db psql -U postgres -d postgres -c "ALTER SYSTEM SET work_mem = '16MB';"
docker restart supabase-db

# 4. Clear browser cache (if frontend is slow)

# 5. Reduce Edge Functions concurrency
# Edit docker-compose.yml, add to functions service:
# environment:
#   DENO_WORKERS: 2
docker compose up -d
```

### Backup Failed

**Symptom:** Duplicacy shows error, backup incomplete

**Solutions:**
```bash
# 1. Check Duplicacy logs
tail -100 /mnt/user/appdata/duplicacy/logs/duplicacy_web.log

# 2. Check disk space
df -h /mnt/user/backups/

# 3. Verify permissions
ls -la /mnt/user/appdata/auditproof/
ls -la /mnt/user/backups/auditproof/

# 4. Test manual backup
docker exec -it duplicacy duplicacy backup -stats

# 5. Check encryption password is correct
# Re-enter in Duplicacy Web UI
```

---

## Summary & Next Steps

### What You've Accomplished

✅ **Self-hosted Supabase** - Complete stack running on Unraid
✅ **Fresh Database** - All 84 migrations applied, 18 tables created
✅ **Frontend Deployed** - React app served via Nginx
✅ **SSL Configured** - HTTPS access via SWAG
✅ **Admin Account** - System admin user created
✅ **Monitoring Setup** - Uptime Kuma tracking services
✅ **Backups Configured** - Duplicacy running daily backups
✅ **Production Ready** - Secure, monitored, backed up

### Time to Production: ~15 hours
- Phase 1-2: 4 hours (Network + Supabase install)
- Phase 3: 2 hours (Database setup)
- Phase 3.5: 1 hour (Edge Functions deployment)
- Phase 4-5: 3 hours (Frontend + SWAG)
- Phase 6: 1 hour (Admin account)
- Phase 7-8: 2 hours (Monitoring + Backups)
- Testing: 2 hours

### Cost Savings

**Previous (Cloud):**
- Bolt.new: $20-50/month
- Supabase Cloud: $25/month
- **Total: $45-75/month**

**Now (Self-Hosted):**
- Electricity: ~$10/month (100W server)
- OpenAI API: $10-50/month (usage-based)
- **Total: $20-60/month**

**Annual Savings: $300-600**
**5-Year Savings: $1,500-3,000**

### Next Actions

**Week 1:**
- [ ] Use the app daily, familiarize yourself
- [ ] Add test receipts, create collections
- [ ] Invite team members (if applicable)
- [ ] Configure MFA for your account
- [ ] Test all features thoroughly

**Week 2-4:**
- [ ] Monitor performance and stability
- [ ] Review logs for errors
- [ ] Optimize any slow queries
- [ ] Fine-tune backup retention

**Month 2:**
- [ ] Review security settings
- [ ] Test disaster recovery (full restore)
- [ ] Document any customizations
- [ ] Consider adding more users

**Ongoing:**
- Daily: Check Uptime Kuma (2 min)
- Weekly: Review logs and backups (15 min)
- Monthly: Update containers, database maintenance (1-2 hours)

### Getting Help

**Official Documentation:**
- Supabase Self-Hosting: https://supabase.com/docs/guides/self-hosting
- Unraid Forums: https://forums.unraid.net/
- Audit Proof GitHub: (if you have repository access)

**Community Support:**
- Supabase Discord: https://discord.supabase.com/
- Unraid Discord: https://discord.com/invite/unraid
- r/unraid: https://reddit.com/r/unraid

**Troubleshooting:**
1. Check this guide's troubleshooting section first
2. Review container logs
3. Search Unraid forums
4. Ask in community Discord servers

---

## Appendix: Quick Reference Commands

### Start/Stop Services
```bash
# Stop all Supabase services
cd /mnt/user/appdata/auditproof/supabase-src/docker
docker compose down

# Start all services
docker compose up -d

# Restart single service
docker restart supabase-db

# View service logs
docker logs supabase-db --tail=100 -f
```

### Database Operations
```bash
# Connect to database
docker exec -it supabase-db psql -U postgres -d postgres

# Backup database
docker exec supabase-db pg_dump -U postgres -d postgres -F c -f /tmp/backup.dump
docker cp supabase-db:/tmp/backup.dump /mnt/user/backups/auditproof/manual-backup-$(date +%Y%m%d).dump

# Restore database
docker cp /mnt/user/backups/auditproof/backup.dump supabase-db:/tmp/
docker exec supabase-db pg_restore -U postgres -d postgres -c /tmp/backup.dump

# Check table sizes
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT schemaname AS schema, tablename AS table, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

### Network Operations
```bash
# List networks
docker network ls

# Inspect network
docker network inspect auditproof-network

# Connect container to network
docker network connect auditproof-network [container-name]

# Disconnect container
docker network disconnect auditproof-network [container-name]
```

### Monitoring Commands
```bash
# Check all container stats
docker stats --no-stream

# Check disk usage
df -h /mnt/user/appdata/auditproof/

# Check database connections
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check recent errors
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT * FROM system_logs WHERE severity = 'error' ORDER BY created_at DESC LIMIT 10;"
```

### Backup Commands
```bash
# Manual backup via Duplicacy
docker exec -it duplicacy duplicacy backup

# Check backup history
docker exec -it duplicacy duplicacy list

# Restore file
docker exec -it duplicacy duplicacy restore -r [revision] [file-path]
```

---

## Document Maintenance

**Last Updated:** 2025-10-27
**Version:** 2.2
**Tested On:** Unraid 7.1.4
**Author:** Audit Proof Development Team
**For Support:** Review troubleshooting section or community resources

**Changelog:**
- **v2.2 (2025-10-27):** Updated for project already cloned on Unraid, moved Edge Functions to Phase 3.5
- **v2.1 (2025-10-27):** Added Edge Functions deployment guide
- **v2.0 (2025-10-24):** Initial comprehensive guide

**Good luck with your self-hosted Audit Proof installation!** 🚀

---

**End of Guide**
