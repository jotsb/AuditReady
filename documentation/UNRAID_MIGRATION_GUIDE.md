# Audit Proof - Complete Unraid Self-Hosting Guide

**Document Version:** 2.1
**Last Updated:** 2025-10-27
**Target:** Unraid 7.1.4+ with SWAG Reverse Proxy
**Migration Approach:** Fresh Installation (No data migration from Bolt.new)
**Estimated Time:** 12-20 hours (first-time setup)

---

## 📋 Current Progress Summary

### ✅ Completed Steps
- **Phase 1:** Unraid Network Setup ✓
- **Phase 2:** Install Supabase Stack ✓
  - Step 2.1-2.7: All Supabase services running
  - Step 2.8: Studio accessible at http://192.168.1.246:3000 ✓
  - **Note:** Edge Functions temporarily disabled (will enable in Phase 9)

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

---

## Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Application Analysis](#application-analysis)
3. [Prerequisites](#prerequisites)
4. [Phase 1: Unraid Network Setup](#phase-1-unraid-network-setup)
5. [Phase 2: Install Supabase Stack](#phase-2-install-supabase-stack)
6. [Phase 3: Database Initialization](#phase-3-database-initialization)
7. [Phase 4: Deploy Frontend](#phase-4-deploy-frontend)
8. [Phase 5: Configure SWAG Reverse Proxy](#phase-5-configure-swag-reverse-proxy)
9. [Phase 6: Create Admin Account](#phase-6-create-admin-account)
10. [Phase 7: Setup Monitoring](#phase-7-setup-monitoring)
11. [Phase 8: Setup Backups](#phase-8-setup-backups)
12. [Phase 9: Enable Edge Functions (Optional)](#phase-9-enable-edge-functions-optional)
13. [Testing & Verification](#testing--verification)
14. [Ongoing Maintenance](#ongoing-maintenance)
15. [Troubleshooting](#troubleshooting)

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

**Edge Functions service will be temporarily disabled** during initial setup because:
- The default docker-compose.yml configuration expects a `main` function that doesn't exist
- Your Edge Functions need to be copied to the correct location
- The core application works without Edge Functions initially

**What this means:**
- ✅ Authentication, database, storage, and frontend will work perfectly
- ❌ AI receipt extraction won't work (you can manually enter receipts)
- ❌ Email invitations won't send (use direct signup)
- ❌ Email receipt forwarding won't work (optional feature)

**We'll enable Edge Functions in Phase 9** after the core system is stable.

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

### Step 3.2: Copy Migrations from Project

**On your workstation (not Unraid):**

```bash
# Navigate to your project
cd /path/to/auditproof

# Create tar of migrations
tar -czf migrations.tar.gz supabase/migrations/

# Copy to Unraid
scp migrations.tar.gz root@192.168.1.246:/mnt/user/appdata/auditproof/
```

**Back on Unraid SSH:**

```bash
cd /mnt/user/appdata/auditproof

# Extract migrations
tar -xzf migrations.tar.gz

# Verify
ls -la supabase/migrations/ | head -20
```

You should see 84 SQL migration files.

### Step 3.3: Initialize Supabase Project Link

```bash
cd /mnt/user/appdata/auditproof

# Initialize Supabase config
supabase init

# Link to local instance
supabase link --project-ref http://192.168.1.246:8000

# When prompted for password, enter your POSTGRES_PASSWORD
```

### Step 3.4: Apply All Migrations

```bash
# Apply migrations to database
supabase db push

# This will:
# 1. Read all files in supabase/migrations/
# 2. Apply them in order to PostgreSQL
# 3. Create all 18 tables with RLS policies
# 4. Set up functions and triggers
```

**Expected Output:**
```
Applying migration 20251006010328_create_auditready_schema.sql...
Applying migration 20251006011419_fix_business_rls_policy.sql...
Applying migration 20251006011649_fix_all_circular_rls_policies.sql...
...
Applying migration 20251022141212_add_missing_performance_indexes.sql...

Finished supabase db push
```

### Step 3.5: Verify Database Schema

```bash
# Connect to PostgreSQL
docker exec -it supabase-db psql -U postgres -d postgres

# List all tables
\dt

# Should see 18 tables:
# profiles, businesses, business_members, collections,
# collection_members, receipts, expense_categories, invitations,
# audit_logs, system_logs, saved_filters, saved_log_filters,
# mfa_recovery_codes, export_jobs, email_receipts_inbox,
# rate_limit_tracking, dashboard_analytics, system_config

# Exit psql
\q
```

### Step 3.6: Seed Default Data

**Create seed script:**

```bash
cat > /mnt/user/appdata/auditproof/config/seed.sql << 'EOF'
-- Insert default expense categories
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
ON CONFLICT DO NOTHING;

-- Insert system configuration
INSERT INTO system_config (key, value, description) VALUES
('app_name', 'Audit Proof', 'Application name'),
('app_version', '1.0.0', 'Current version'),
('max_file_size', '52428800', 'Max upload size in bytes (50MB)'),
('retention_days', '2555', 'Data retention period (7 years)'),
('enable_email_receipts', 'false', 'Email forwarding feature'),
('enable_ai_extraction', 'true', 'OpenAI receipt extraction')
ON CONFLICT (key) DO NOTHING;
EOF

# Apply seed data
docker exec -i supabase-db psql -U postgres -d postgres < /mnt/user/appdata/auditproof/config/seed.sql
```

**Verify:**
```bash
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM expense_categories;"
```
**Expected:** `10`

---

## Phase 4: Deploy Frontend

### Step 4.1: Build Frontend on Your Workstation

**On your workstation (Windows/Mac):**

```bash
# Navigate to project
cd /path/to/auditproof

# Create production environment file
cat > .env.production << EOF
VITE_SUPABASE_URL=http://192.168.1.246:8000
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
EOF

# Replace YOUR_ANON_KEY_HERE with the actual ANON_KEY from Phase 2.3

# Install dependencies (if not already done)
npm install

# Build for production
npm run build

# Package build output
cd dist
tar -czf audit-proof-frontend.tar.gz *
cd ..
```

### Step 4.2: Deploy to Unraid

```bash
# Copy to Unraid
scp dist/audit-proof-frontend.tar.gz root@192.168.1.246:/mnt/user/appdata/auditproof/
```

**On Unraid SSH:**

```bash
cd /mnt/user/appdata/auditproof/dist

# Extract frontend files
tar -xzf ../audit-proof-frontend.tar.gz

# Verify files exist
ls -la
# Should see: index.html, assets/, etc.

# Set permissions
chown -R nobody:users /mnt/user/appdata/auditproof/dist
chmod -R 755 /mnt/user/appdata/auditproof/dist
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

## Phase 9: Enable Edge Functions (Optional)

**Prerequisites:** Complete Phases 1-8 and verify core system is stable.

### Step 9.1: Copy Edge Functions to Correct Location

```bash
# Copy functions from project to appdata directory
mkdir -p /mnt/user/appdata/auditproof/edge-functions

# If you have the project files on Unraid:
cp -r /tmp/cc-agent/58096699/project/supabase/functions/* /mnt/user/appdata/auditproof/edge-functions/

# Or copy from your workstation:
# cd /path/to/auditproof
# tar -czf edge-functions.tar.gz supabase/functions/
# scp edge-functions.tar.gz root@192.168.1.246:/mnt/user/appdata/auditproof/
# Then on Unraid:
# cd /mnt/user/appdata/auditproof
# tar -xzf edge-functions.tar.gz --strip-components=2

# Verify files copied
ls -la /mnt/user/appdata/auditproof/edge-functions/
# Should see: accept-invitation/, extract-receipt-data/, receive-email-receipt/,
#             send-invitation-email/, process-export-job/, admin-user-management/
```

### Step 9.2: Configure Environment Variables

```bash
cd /mnt/user/appdata/auditproof/supabase-src/docker
nano .env
```

Add these environment variables:

```bash
# OpenAI API (Required for receipt extraction)
OPENAI_API_KEY=sk-your-openai-api-key-here

# SMTP Settings (Already configured in Phase 2, verify they're correct)
GOTRUE_SMTP_HOST=mail.privateemail.com
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=contact@auditproof.ca
GOTRUE_SMTP_PASS=your-email-password-here

# Postmark (Optional - only if you want email receipt forwarding)
POSTMARK_SERVER_TOKEN=your-postmark-token-here
```

**Save and exit:** Ctrl+X, Y, Enter

### Step 9.3: Uncomment Edge Functions Service

```bash
nano docker-compose.yml
```

Find the commented out `functions:` service and uncomment it. Also **remove or comment out** the `command:` section:

```yaml
functions:
  container_name: supabase-edge-functions
  image: supabase/edge-runtime:v1.69.14
  restart: unless-stopped
  volumes:
    - /mnt/user/appdata/auditproof/edge-functions:/home/deno/functions:Z
  depends_on:
    analytics:
      condition: service_healthy
  environment:
    JWT_SECRET: ${JWT_SECRET}
    SUPABASE_URL: http://kong:8000
    SUPABASE_ANON_KEY: ${ANON_KEY}
    SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}
    SUPABASE_DB_URL: postgresql://postgres:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
    VERIFY_JWT: "${FUNCTIONS_VERIFY_JWT}"
    OPENAI_API_KEY: ${OPENAI_API_KEY}
    SMTP_HOST: ${GOTRUE_SMTP_HOST}
    SMTP_PORT: ${GOTRUE_SMTP_PORT}
    SMTP_USER: ${GOTRUE_SMTP_USER}
    SMTP_PASSWORD: ${GOTRUE_SMTP_PASS}
  # REMOVE THE COMMAND SECTION - Let it use default startup
  # command:
  #   [
  #     "start",
  #     "--main-service",
  #     "/home/deno/functions/main"
  #   ]
```

**Save and exit:** Ctrl+X, Y, Enter

### Step 9.4: Restart Services

```bash
cd /mnt/user/appdata/auditproof/supabase-src/docker

# Restart to apply changes
docker compose down
docker compose up -d

# Wait for services to start
sleep 30

# Check status
docker compose ps
```

**Expected:** You should now see `supabase-edge-functions` with status "Up (healthy)"

### Step 9.5: Verify Edge Functions Work

**Test receipt extraction:**
1. Open Audit Proof: `https://auditproof.yourdomain.com`
2. Upload a receipt image
3. Wait 5-10 seconds
4. Receipt data should be extracted automatically

**Check Edge Functions logs:**
```bash
docker logs supabase-edge-functions --tail=50 -f
```

You should see function invocations and responses.

**If extraction doesn't work:**
```bash
# Check OpenAI API key
docker exec -it supabase-edge-functions env | grep OPENAI

# Test OpenAI API manually
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-your-key-here"

# Check function logs for errors
docker logs supabase-edge-functions | grep -i error
```

### Step 9.6: Test Email Features (Optional)

**Test invitation emails:**
1. Go to Team Management in Audit Proof
2. Invite a team member
3. Check that invitation email is sent

**Test password reset:**
1. Log out
2. Click "Forgot Password"
3. Enter email
4. Check that reset email is sent

**Check email logs:**
```bash
docker logs supabase-auth | grep -i smtp
```

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

### Time to Production: ~14 hours
- Phase 1-2: 4 hours (Network + Supabase install)
- Phase 3: 2 hours (Database setup)
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

**Last Updated:** 2025-10-24
**Version:** 2.0
**Tested On:** Unraid 7.1.4
**Author:** Audit Proof Development Team
**For Support:** Review troubleshooting section or community resources

**Good luck with your self-hosted Audit Proof installation!** 🚀

---

**End of Guide**
