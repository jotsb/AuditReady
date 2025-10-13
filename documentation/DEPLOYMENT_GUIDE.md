# Audit Proof - Complete Deployment & Environment Management Guide

**Last Updated:** 2025-10-11
**Version:** 1.0
**Target Audience:** DevOps Engineers, Full-Stack Developers, Project Managers

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Environment Strategy](#environment-strategy)
4. [Supabase Environment Setup](#supabase-environment-setup)
5. [Frontend Deployment with Netlify](#frontend-deployment-with-netlify)
6. [CI/CD Pipeline with GitHub Actions](#cicd-pipeline-with-github-actions)
7. [Migration Workflow](#migration-workflow)
8. [Environment Variables Management](#environment-variables-management)
9. [Testing Strategy](#testing-strategy)
10. [Monitoring & Rollback](#monitoring--rollback)
11. [Cost Analysis](#cost-analysis)
12. [Troubleshooting Guide](#troubleshooting-guide)

---

## Executive Summary

### What This Guide Covers

This comprehensive guide provides step-by-step instructions for setting up a professional development, staging, and production environment for Audit Proof using:

- **Frontend Hosting:** Netlify (with branch deploys)
- **Backend/Database:** Supabase (with branching)
- **CI/CD:** GitHub Actions
- **Version Control:** Git/GitHub

### Why This Architecture?

**Bolt.new Limitations:**
- Bolt.new is excellent for prototyping but **not suitable for production deployment**
- No built-in staging environments
- Limited control over deployment pipeline
- Token consumption becomes expensive for larger projects
- Beta status with active bugs

**Our Solution:**
- Move from Bolt.new to a professional Git-based workflow
- Use industry-standard tools (Netlify + Supabase + GitHub Actions)
- Full control over environments and deployment
- Cost-effective and scalable
- Production-ready with monitoring and rollback capabilities

### Prerequisites

- GitHub account with repository access
- Netlify account (Free or Pro tier)
- Supabase account with Pro Plan ($25/month - **required for branching**)
- Supabase CLI installed locally
- Node.js 18+ and npm installed
- Git installed and configured
- Basic understanding of:
  - Git workflows (branches, pull requests)
  - Environment variables
  - Command-line operations
  - Database migrations

---

## Architecture Overview

### Environment Structure

```
┌─────────────────────────────────────────────────────────────┐
│                        PRODUCTION                            │
│  ┌────────────────┐              ┌──────────────────┐      │
│  │  Netlify Prod  │◄────────────►│  Supabase Prod   │      │
│  │  main branch   │              │  Main Project    │      │
│  │  example.com   │              │  prod-abc123     │      │
│  └────────────────┘              └──────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ (merge after staging approval)
                              │
┌─────────────────────────────────────────────────────────────┐
│                         STAGING                              │
│  ┌────────────────┐              ┌──────────────────┐      │
│  │ Netlify Staging│◄────────────►│Supabase Staging  │      │
│  │ staging branch │              │ Persistent Branch│      │
│  │ staging.ex.com │              │ staging-xyz456   │      │
│  └────────────────┘              └──────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ (merge after dev testing)
                              │
┌─────────────────────────────────────────────────────────────┐
│                       DEVELOPMENT                            │
│  ┌────────────────┐              ┌──────────────────┐      │
│  │ Netlify Preview│◄────────────►│  Supabase Local  │      │
│  │ feature-*      │              │  Docker Container│      │
│  │ PR previews    │              │  localhost:54321 │      │
│  └────────────────┘              └──────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Developer** → commits to feature branch → creates PR
2. **GitHub Actions** → runs tests and linting
3. **Netlify** → creates deploy preview for PR
4. **Developer** → tests feature in preview environment
5. **Merge to Staging** → Netlify deploys to staging site
6. **Supabase** → migrations applied to staging branch
7. **QA/UAT** → testing on staging environment
8. **Merge to Main** → Netlify deploys to production
9. **Supabase** → migrations applied to production project
10. **Monitoring** → Track errors and performance

---

## Environment Strategy

### Three-Tier Architecture

#### 1. Development (Local)

**Purpose:** Individual developer feature work and testing

**Infrastructure:**
- **Frontend:** Vite dev server (`npm run dev`)
- **Database:** Supabase Local (Docker)
- **Storage:** Local Supabase storage
- **Edge Functions:** Local Supabase functions

**Characteristics:**
- Fastest iteration cycle
- Full developer control
- Isolated from other developers
- No cost for compute/storage
- Uses seed data for testing

**Access:**
- `http://localhost:5173` (Vite)
- `http://localhost:54321` (Supabase Studio)

---

#### 2. Staging (Pre-Production)

**Purpose:** QA, UAT, integration testing, client demos

**Infrastructure:**
- **Frontend:** Netlify branch deploy
- **Database:** Supabase Persistent Branch
- **Storage:** Supabase staging bucket
- **Edge Functions:** Supabase staging functions

**Characteristics:**
- Mirrors production configuration
- Uses production-like data (sanitized)
- Accessible by QA team and stakeholders
- Automated deployment from `staging` branch
- Can be reset/rebuilt as needed

**Access:**
- `https://staging.yourdomain.com` (custom domain)
- `https://staging-auditproof.netlify.app` (Netlify subdomain)

**Cost:** ~$25/month (Supabase Pro Plan)

---

#### 3. Production (Live)

**Purpose:** Live customer-facing application

**Infrastructure:**
- **Frontend:** Netlify production deploy
- **Database:** Supabase Main Project
- **Storage:** Supabase production bucket
- **Edge Functions:** Supabase production functions

**Characteristics:**
- High availability (99.9% uptime SLA)
- Automated backups (Point-in-Time Recovery)
- Monitoring and alerting enabled
- CDN for global performance
- Only deployable from `main` branch
- Requires approval gates

**Access:**
- `https://app.yourdomain.com` (custom domain)

**Cost:** $25/month (Supabase Pro) + Netlify costs (varies)

---

## Supabase Environment Setup

### Step 1: Install Supabase CLI

**macOS:**
```bash
brew install supabase/tap/supabase
```

**Windows (PowerShell):**
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Linux:**
```bash
curl -fsSL https://cli.supabase.com/install.sh | sh
```

**Verify Installation:**
```bash
supabase --version
# Expected output: supabase 1.x.x
```

---

### Step 2: Login to Supabase

```bash
supabase login
```

This opens a browser window for authentication. After login, you'll receive an access token stored locally.

---

### Step 3: Create Supabase Projects

You need **three separate Supabase projects**:

#### 3.1 Production Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New project"
3. **Settings:**
   - Name: `auditproof-production`
   - Database Password: Use strong password (save to password manager)
   - Region: Choose closest to your users (e.g., `us-east-1`)
   - Pricing plan: **Pro Plan** ($25/month - required for branching)

4. Wait ~2 minutes for project provisioning
5. **Save credentials:**
   - Project URL: `https://abc123.supabase.co`
   - Anon Public Key: `eyJhbG...`
   - Service Role Key: `eyJhbG...` (⚠️ keep secret)
   - Project ID: `abc123xyz`

#### 3.2 Staging Project

Repeat the above process:
- Name: `auditproof-staging`
- Use same region as production
- Pro Plan required

**Alternative:** Use Supabase Branching (recommended)
- Instead of separate project, create a **Persistent Branch** from production
- This shares the same billing and makes migrations easier
- We'll configure this in Step 5

#### 3.3 Local Development

No project creation needed - runs in Docker containers locally.

---

### Step 4: Initialize Local Supabase

**In your project directory:**

```bash
# Initialize Supabase (creates supabase/ folder if it doesn't exist)
supabase init

# Link to your production project
supabase link --project-ref abc123xyz
# Enter your database password when prompted

# Pull existing schema and migrations
supabase db pull
```

**What this does:**
- Creates `supabase/config.toml` with project settings
- Creates `supabase/migrations/` folder
- Downloads your current database schema as a migration file
- Sets up local environment configuration

---

### Step 5: Configure Supabase Branching (Staging)

**⚠️ Requires Supabase Pro Plan ($25/month)**

#### Option A: Using GitHub Integration (Recommended)

1. **In Supabase Dashboard:**
   - Go to your production project
   - Navigate to: Integrations → GitHub
   - Click "Connect to GitHub"
   - Authorize Supabase to access your repository
   - Select your `auditproof` repository

2. **Configure Branch Settings:**
   - Production branch: `main`
   - Enable branching: ✅
   - Persistent branches: `staging`

3. **GitHub Action Created Automatically:**
   Supabase creates `.github/workflows/supabase.yml` in your repository

**What happens now:**
- Push to `staging` branch → creates/updates staging branch in Supabase
- Push to `main` branch → deploys to production Supabase project
- PRs → can create preview branches (optional)

#### Option B: Using Dashboard Only

1. **In Supabase Dashboard:**
   - Go to your production project
   - Navigate to: Branching → Branches
   - Click "Create branch"
   - Name: `staging`
   - Type: **Persistent**
   - Click "Create"

2. **Manual Deploy Workflow:**
   You'll need to manually deploy migrations to staging:
   ```bash
   # Deploy to staging branch
   supabase db push --project-ref staging-xyz456
   ```

**Recommendation:** Use GitHub integration for automated workflows.

---

### Step 6: Set Up Local Development Environment

```bash
# Start local Supabase (Docker containers)
supabase start
```

**First run will:**
- Download Docker images (~500MB)
- Start PostgreSQL, PostgREST, GoTrue, Storage, Kong
- Initialize database with migrations
- Take ~2-3 minutes

**Output will show:**
```
Started supabase local development setup.

API URL: http://localhost:54321
GraphQL URL: http://localhost:54321/graphql/v1
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
Inbucket URL: http://localhost:54324
JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
anon key: eyJhbG...
service_role key: eyJhbG...
```

**Save these credentials** - you'll need them for `.env.local`

---

### Step 7: Create `.env` Files

#### `.env.local` (Local Development)

```bash
# Local Supabase (from `supabase start` output)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbG... # your local anon key

# Resend API (use test key for local)
RESEND_API_KEY=re_test_123

# OpenAI (optional - use test mode or mock)
OPENAI_API_KEY=sk-test-123
```

#### `.env.staging` (Staging Environment)

```bash
# Staging Supabase Branch
VITE_SUPABASE_URL=https://staging-xyz456.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG... # staging anon key

# Resend API (use development domain)
RESEND_API_KEY=re_dev_456

# OpenAI (use production key with rate limits)
OPENAI_API_KEY=sk-prod-789
```

#### `.env.production` (Production Environment)

```bash
# Production Supabase
VITE_SUPABASE_URL=https://abc123.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG... # production anon key

# Resend API (use production key with custom domain)
RESEND_API_KEY=re_prod_xyz

# OpenAI (production key with monitoring)
OPENAI_API_KEY=sk-prod-abc
```

**⚠️ Security Notes:**
- **NEVER commit these files to Git**
- Add to `.gitignore`:
  ```
  .env*
  !.env.example
  ```
- Store production keys in Netlify dashboard (encrypted)
- Store service role keys in GitHub Secrets (for CI/CD)

---

### Step 8: Test Local Setup

```bash
# In terminal 1: Start Supabase
supabase start

# In terminal 2: Start frontend
npm run dev

# Visit http://localhost:5173
# Should connect to local Supabase successfully
```

**Verify Connection:**
1. Try to register a new user
2. Check Supabase Studio: http://localhost:54323
3. Navigate to Authentication → Users
4. Your new user should appear

**If connection fails:**
- Check `.env.local` values match `supabase start` output
- Verify Docker is running
- Check ports 54321-54324 are not in use

---

## Frontend Deployment with Netlify

### Step 1: Prepare Repository

#### 1.1 Create GitHub Repository

```bash
# Initialize git (if not already done)
git init

# Create main branch
git branch -M main

# Add remote
git remote add origin https://github.com/yourusername/auditproof.git

# Initial commit
git add .
git commit -m "Initial commit: Audit Proof application"
git push -u origin main
```

#### 1.2 Create Branch Structure

```bash
# Create staging branch
git checkout -b staging
git push -u origin staging

# Back to main
git checkout main

# Create develop branch (optional)
git checkout -b develop
git push -u origin develop
```

**Branch Strategy:**
- `main` → Production (protected)
- `staging` → Staging environment (protected)
- `develop` → Integration branch
- `feature/*` → Feature branches (deleted after merge)
- `hotfix/*` → Emergency fixes

---

### Step 2: Configure Build Settings

#### 2.1 Add `netlify.toml`

Create `netlify.toml` in project root:

```toml
# Production build settings
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

# Production context
[context.production]
  command = "npm run build"

[context.production.environment]
  # Environment variables set in Netlify UI

# Staging context
[context.staging]
  command = "npm run build"

[context.staging.environment]
  # Environment variables set in Netlify UI

# Branch deploy context (for feature branches)
[context.branch-deploy]
  command = "npm run build"

# Deploy preview context (for PRs)
[context.deploy-preview]
  command = "npm run build"

# Redirect rules for SPA
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# Security headers
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
```

**Commit and push:**
```bash
git add netlify.toml
git commit -m "Add Netlify configuration"
git push
```

---

### Step 3: Connect Netlify

#### 3.1 Create Netlify Site

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Click "Add new site" → "Import an existing project"
3. Choose "GitHub" (authorize if needed)
4. Select your `auditproof` repository
5. **Configure build:**
   - Branch to deploy: `main`
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Click "Deploy site"

**First deployment will fail** - we need to add environment variables.

#### 3.2 Configure Environment Variables

In Netlify dashboard:
1. Go to: Site settings → Environment variables
2. Click "Add a variable"
3. For each variable, set context:

**Production Variables (Scoped to `production` branch):**

| Key | Value | Context |
|-----|-------|---------|
| `VITE_SUPABASE_URL` | `https://abc123.supabase.co` | Production |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` | Production |

**Staging Variables (Scoped to `staging` branch):**

| Key | Value | Context |
|-----|-------|---------|
| `VITE_SUPABASE_URL` | `https://staging-xyz.supabase.co` | Branch: staging |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` | Branch: staging |

**How to set scoped variables:**
1. Click "Add a variable"
2. Enter key name (e.g., `VITE_SUPABASE_URL`)
3. Click "Select scopes"
4. Choose "Production" or "Branches" → select `staging`
5. Enter value
6. Click "Create variable"

---

### Step 4: Configure Branch Deploys

#### 4.1 Enable Branch Deploys

In Netlify dashboard:
1. Go to: Site settings → Build & deploy → Continuous deployment
2. Scroll to "Branch deploys"
3. Select "Let me choose which branches to deploy"
4. Add branch: `staging`
5. Save

**What this does:**
- Every push to `staging` creates a deploy at: `staging--auditproof.netlify.app`
- Every push to `main` deploys to: `auditproof.netlify.app` (production)

#### 4.2 Enable Deploy Previews

In same section:
1. Scroll to "Deploy previews"
2. Select "Any pull request against your production branch"
3. Save

**What this does:**
- Every PR to `main` or `staging` gets a preview: `deploy-preview-123--auditproof.netlify.app`

---

### Step 5: Add Custom Domains

#### 5.1 Production Domain

1. Go to: Site settings → Domain management
2. Click "Add custom domain"
3. Enter: `app.yourdomain.com`
4. Netlify provides DNS records:
   ```
   Type: CNAME
   Name: app
   Value: auditproof.netlify.app
   ```
5. Add these records in your DNS provider (Cloudflare, Route53, etc.)
6. Wait for DNS propagation (~5-30 minutes)
7. Netlify automatically provisions SSL certificate (Let's Encrypt)

#### 5.2 Staging Subdomain

1. Click "Add custom domain" again
2. Enter: `staging.yourdomain.com`
3. Add CNAME record:
   ```
   Type: CNAME
   Name: staging
   Value: staging--auditproof.netlify.app
   ```

**Final URLs:**
- Production: `https://app.yourdomain.com`
- Staging: `https://staging.yourdomain.com`
- PR Preview: `https://deploy-preview-123--auditproof.netlify.app`

---

### Step 6: Configure Deploy Notifications

#### 6.1 Slack Integration (Optional but Recommended)

1. Go to: Site settings → Build & deploy → Deploy notifications
2. Click "Add notification" → "Slack integration"
3. Authorize Slack workspace
4. Select channel (e.g., `#deployments`)
5. Choose events:
   - ✅ Deploy started
   - ✅ Deploy succeeded
   - ✅ Deploy failed

#### 6.2 Email Notifications

1. Add notification → "Email"
2. Enter team emails
3. Choose events:
   - ✅ Deploy failed
   - ✅ Deploy locked/unlocked

---

## CI/CD Pipeline with GitHub Actions

### Step 1: Create GitHub Secrets

In GitHub repository:
1. Go to: Settings → Secrets and variables → Actions
2. Click "New repository secret"

**Required Secrets:**

| Secret Name | Value | Purpose |
|-------------|-------|---------|
| `SUPABASE_ACCESS_TOKEN` | (from `supabase login`) | Deploy migrations |
| `SUPABASE_DB_PASSWORD` | (production DB password) | Database access |
| `SUPABASE_PROJECT_ID_PROD` | `abc123xyz` | Production project |
| `SUPABASE_PROJECT_ID_STAGING` | `staging-xyz456` | Staging project |
| `NETLIFY_AUTH_TOKEN` | (from Netlify settings) | Deploy to Netlify |
| `NETLIFY_SITE_ID` | (from Site settings → General) | Target site |

**How to get Supabase Access Token:**
```bash
supabase login
# Token is stored in ~/.supabase/access-token
cat ~/.supabase/access-token
```

**How to get Netlify tokens:**
1. Netlify dashboard → User settings → Applications
2. Create new access token → copy and save
3. For Site ID: Site settings → General → Site details

---

### Step 2: Create CI/CD Workflows

#### 2.1 Test and Lint on PR

Create `.github/workflows/test.yml`:

```yaml
name: Test and Lint

on:
  pull_request:
    branches: [main, staging, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL_STAGING }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY_STAGING }}

  database-tests:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase local
        run: supabase db start

      - name: Run database tests
        run: supabase test db
```

---

#### 2.2 Deploy to Staging

Create `.github/workflows/deploy-staging.yml`:

```yaml
name: Deploy to Staging

on:
  push:
    branches: [staging]

jobs:
  deploy-database:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy database migrations to staging
        run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID_STAGING }}
          supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}

      - name: Deploy Edge Functions to staging
        run: supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_ID_STAGING }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  deploy-frontend:
    needs: deploy-database
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL_STAGING }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY_STAGING }}

      - name: Deploy to Netlify (Staging)
        uses: nwtgck/actions-netlify@v2
        with:
          publish-dir: './dist'
          production-deploy: false
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: "Deploy from GitHub Actions - Staging"
          alias: staging
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

---

#### 2.3 Deploy to Production

Create `.github/workflows/deploy-production.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-database:
    runs-on: ubuntu-latest
    environment:
      name: production

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy database migrations to production
        run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID_PROD }}
          supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}

      - name: Deploy Edge Functions to production
        run: supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_ID_PROD }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  deploy-frontend:
    needs: deploy-database
    runs-on: ubuntu-latest
    environment:
      name: production

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL_PROD }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY_PROD }}

      - name: Deploy to Netlify (Production)
        uses: nwtgck/actions-netlify@v2
        with:
          publish-dir: './dist'
          production-deploy: true
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: "Deploy from GitHub Actions - Production"
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

      - name: Notify deployment success
        if: success()
        run: |
          echo "✅ Production deployment successful!"
          echo "URL: https://app.yourdomain.com"
```

---

### Step 3: Configure GitHub Environments

**Enable manual approvals for production:**

1. Go to: Repository → Settings → Environments
2. Click "New environment" → name: `production`
3. Check "Required reviewers"
4. Add reviewers (e.g., tech lead, DevOps engineer)
5. Save

**What this does:**
- Production deploys require manual approval
- Approvers get notification when deployment is triggered
- Deployment pauses until approved

---

### Step 4: Configure Branch Protection

#### 4.1 Protect `main` Branch

1. Go to: Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Check:
   - ✅ Require a pull request before merging
   - ✅ Require approvals (1-2 reviewers)
   - ✅ Require status checks to pass
     - Select: `test`, `database-tests`
   - ✅ Require branches to be up to date
   - ✅ Do not allow bypassing the above settings

#### 4.2 Protect `staging` Branch

Same as above but:
- Fewer required approvals (0-1)
- Less strict review requirements

---

## Migration Workflow

### Understanding Supabase Migrations

**What are migrations?**
- SQL files that describe database schema changes
- Versioned with timestamps (e.g., `20251011123456_add_export_jobs.sql`)
- Applied sequentially in order
- Tracked in `supabase_migrations.schema_migrations` table

**Migration file structure:**
```sql
-- Migration name: add_export_jobs
-- Description: Add export_jobs table for async exports

CREATE TABLE export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) NOT NULL,
  status text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exports"
  ON export_jobs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM business_members
    WHERE business_id = export_jobs.business_id
    AND user_id = auth.uid()
  ));
```

---

### Creating Migrations

#### Method 1: Manual SQL (Recommended)

**When to use:**
- Complex schema changes
- Data migrations
- Performance-critical changes
- You know exactly what SQL to write

**Steps:**

```bash
# Create new migration file
supabase migration new add_feature_name

# Opens: supabase/migrations/20251011123456_add_feature_name.sql
# Write your SQL in this file
```

**Example migration:**
```sql
-- Add user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  theme text DEFAULT 'light',
  notifications_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON user_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_user_preferences_user_id
  ON user_preferences(user_id);
```

**Apply locally:**
```bash
supabase db reset
# This drops the local DB and re-applies all migrations
```

---

#### Method 2: Auto Schema Diff

**When to use:**
- Quick prototyping
- Simple table additions
- Learning/exploring
- You made changes in Supabase Studio UI

**Steps:**

```bash
# 1. Make changes in Supabase Studio (http://localhost:54323)
#    - Add tables, columns, policies via UI

# 2. Generate migration from diff
supabase db diff -f add_feature_name

# 3. Review generated SQL
cat supabase/migrations/20251011123456_add_feature_name.sql

# 4. Edit if needed (AI sometimes misses things)

# 5. Apply to confirm it works
supabase db reset
```

**⚠️ Limitations:**
- May miss complex constraints
- Can generate suboptimal SQL
- Doesn't capture data migrations
- Review carefully before committing

---

### Deploying Migrations

#### Local → Staging → Production Flow

**1. Develop Locally:**

```bash
# Create migration
supabase migration new add_export_feature

# Edit SQL file
# Test locally
supabase db reset

# Commit
git add supabase/migrations/
git commit -m "Add export feature migration"
```

**2. Deploy to Staging:**

```bash
# Push to staging branch
git checkout staging
git merge develop
git push origin staging

# GitHub Actions automatically:
# - Runs tests
# - Deploys migrations to Supabase staging
# - Deploys frontend to Netlify staging
```

**Manual deployment (if not using CI/CD):**
```bash
supabase link --project-ref staging-xyz456
supabase db push
```

**3. Test on Staging:**
- QA team tests new feature
- Verify migrations applied correctly
- Check data integrity
- Test rollback if needed

**4. Deploy to Production:**

```bash
# Merge to main
git checkout main
git merge staging
git push origin main

# GitHub Actions:
# - Waits for approval (if configured)
# - Deploys migrations to production
# - Deploys frontend to production
```

---

### Rollback Strategy

#### Database Rollback

**⚠️ Important:** Supabase doesn't support automatic rollback. You need to manually create "down" migrations.

**Best Practice:** Always create a rollback migration before deploying.

**Example:**

**Up migration:** `20251011120000_add_export_jobs.sql`
```sql
CREATE TABLE export_jobs (...);
```

**Down migration:** `20251011120001_rollback_export_jobs.sql`
```sql
DROP TABLE IF EXISTS export_jobs;
```

**To rollback:**
```bash
# Create and apply rollback migration
supabase migration new rollback_export_jobs
# Write DROP statements
supabase db push --project-ref production-id
```

#### Frontend Rollback

**Netlify provides instant rollback:**

1. Go to: Deploys → Production deploys
2. Click on previous successful deploy
3. Click "Publish deploy"
4. ✅ Site instantly reverts to previous version

**Or use CLI:**
```bash
netlify deploy --prod --restore <deploy-id>
```

---

### Migration Best Practices

#### ✅ DO:
1. **Always use `IF EXISTS` / `IF NOT EXISTS`:**
   ```sql
   CREATE TABLE IF NOT EXISTS users (...);
   ALTER TABLE users DROP COLUMN IF EXISTS old_column;
   ```

2. **Add detailed comments:**
   ```sql
   /*
     Migration: Add export jobs system

     Changes:
     - New table: export_jobs
     - RLS policies for data access
     - Indexes for performance

     Rollback: See 20251011120001_rollback_export_jobs.sql
   */
   ```

3. **Test migrations locally first:**
   ```bash
   supabase db reset  # drops and recreates
   ```

4. **Use transactions for multi-step migrations:**
   ```sql
   BEGIN;

   ALTER TABLE users ADD COLUMN new_field text;
   UPDATE users SET new_field = 'default';
   ALTER TABLE users ALTER COLUMN new_field SET NOT NULL;

   COMMIT;
   ```

5. **Create indexes for foreign keys:**
   ```sql
   CREATE INDEX idx_export_jobs_business_id
     ON export_jobs(business_id);
   ```

#### ❌ DON'T:

1. **Don't drop columns with data** (risk of data loss):
   ```sql
   -- BAD: Data is lost forever
   ALTER TABLE users DROP COLUMN old_field;

   -- GOOD: Soft delete with migration plan
   -- Step 1: Stop using column in code
   -- Step 2: Wait 1 week
   -- Step 3: Drop column
   ```

2. **Don't modify existing migrations:**
   - Once applied, migrations are immutable
   - Create new migration to fix issues

3. **Don't use `CASCADE` lightly:**
   ```sql
   -- DANGEROUS: Can delete related data unexpectedly
   DROP TABLE users CASCADE;
   ```

4. **Don't forget RLS policies:**
   ```sql
   -- Every new table needs RLS
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Access policy"
     ON new_table FOR ALL
     USING (auth.uid() = user_id);
   ```

---

## Environment Variables Management

### Local Development (`.env.local`)

```bash
# Supabase Local
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API Keys (test mode)
RESEND_API_KEY=re_test_123
OPENAI_API_KEY=sk-test-456
```

**When to use:**
- Running `npm run dev` locally
- Testing features before commit
- Debugging in isolation

**Security:**
- ✅ Safe to use real Supabase local keys
- ⚠️ Use test API keys only (not production)
- ✅ Can commit `.env.example` (without values)

---

### Staging Environment

**Stored in:** Netlify dashboard (encrypted)

**Variables:**
```bash
# Supabase Staging Branch
VITE_SUPABASE_URL=https://staging-xyz456.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG... (staging anon key)

# API Keys (development/testing mode)
RESEND_API_KEY=re_development_789
OPENAI_API_KEY=sk-dev-abc

# Feature Flags
VITE_ENABLE_BETA_FEATURES=true
VITE_DEBUG_MODE=true
```

**When to use:**
- QA testing
- Client demos
- Integration testing
- Load testing

**Security:**
- ✅ Use separate API keys from production
- ✅ Lower rate limits acceptable
- ✅ Can use development domains (Resend)
- ⚠️ Don't use real user data (sanitize)

---

### Production Environment

**Stored in:** Netlify dashboard + GitHub Secrets (encrypted)

**Variables:**
```bash
# Supabase Production
VITE_SUPABASE_URL=https://abc123.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG... (production anon key)

# API Keys (production with monitoring)
RESEND_API_KEY=re_production_xyz
OPENAI_API_KEY=sk-prod-456

# Feature Flags
VITE_ENABLE_BETA_FEATURES=false
VITE_DEBUG_MODE=false

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
```

**When to use:**
- Live customer-facing application
- Real transactions and data

**Security:**
- 🔒 Production keys with high rate limits
- 🔒 Monitoring and alerting enabled
- 🔒 Custom domain configured (Resend)
- 🔒 Service role keys NEVER exposed to frontend
- 🔒 Regular key rotation (90 days)

---

### Managing Secrets

#### GitHub Secrets (for CI/CD)

**Used by:** GitHub Actions workflows

**To add:**
1. Repository → Settings → Secrets and variables → Actions
2. "New repository secret"

**Required secrets:**

| Secret | Purpose | Value Location |
|--------|---------|----------------|
| `SUPABASE_ACCESS_TOKEN` | Deploy migrations | `~/.supabase/access-token` |
| `SUPABASE_DB_PASSWORD` | Database access | Supabase project settings |
| `SUPABASE_PROJECT_ID_PROD` | Target production | Supabase dashboard |
| `SUPABASE_PROJECT_ID_STAGING` | Target staging | Supabase dashboard |
| `NETLIFY_AUTH_TOKEN` | Deploy to Netlify | Netlify user settings |
| `NETLIFY_SITE_ID` | Target site | Netlify site settings |

---

#### Netlify Environment Variables

**Used by:** Frontend build process

**To add:**
1. Netlify site → Site settings → Environment variables
2. "Add a variable"
3. Select scope: Production / Branch / All

**Recommended scopes:**

| Variable | Production Scope | Staging Scope | Preview Scope |
|----------|------------------|---------------|---------------|
| `VITE_SUPABASE_URL` | Prod URL | Staging URL | Staging URL |
| `VITE_SUPABASE_ANON_KEY` | Prod key | Staging key | Staging key |
| `RESEND_API_KEY` | ❌ Not used in frontend | ❌ Not used in frontend | ❌ Not used in frontend |

**⚠️ Important:**
- Frontend (Vite) variables must start with `VITE_`
- Never expose service role keys in frontend
- API keys should only be in Edge Functions

---

#### Supabase Edge Function Secrets

**Used by:** Edge Functions only (server-side)

**To add:**

```bash
# Set secret for all functions
supabase secrets set RESEND_API_KEY=re_prod_xyz --project-ref abc123

# Set secret for specific function
supabase secrets set OPENAI_API_KEY=sk-prod-456 \
  --project-ref abc123 \
  --env-file supabase/functions/extract-receipt-data/.env
```

**Required secrets:**

| Secret | Functions Using It | Purpose |
|--------|-------------------|---------|
| `RESEND_API_KEY` | send-invitation-email, process-export-job | Email delivery |
| `OPENAI_API_KEY` | extract-receipt-data | OCR/AI extraction |
| `SUPABASE_SERVICE_ROLE_KEY` | admin-user-management | Admin operations |

**To list secrets:**
```bash
supabase secrets list --project-ref abc123
```

---

### Secret Rotation Policy

**Recommended schedule:**

| Secret Type | Rotation Frequency | Priority |
|-------------|-------------------|----------|
| Supabase Service Role Key | 90 days | 🔴 High |
| API Keys (Resend, OpenAI) | 90 days | 🔴 High |
| Supabase Anon Key | 180 days | 🟡 Medium |
| Access Tokens | 30 days | 🔴 High |
| Database Passwords | 180 days | 🔴 High |

**Rotation process:**

1. **Generate new secret:**
   - Supabase: Settings → API → Regenerate key
   - API providers: Dashboard → Create new key

2. **Update all locations:**
   - Netlify environment variables
   - GitHub Actions secrets
   - Supabase Edge Function secrets
   - Local developer `.env` files (communicate to team)

3. **Test in staging first:**
   - Deploy to staging with new secrets
   - Verify all functionality works
   - Check logs for auth errors

4. **Deploy to production:**
   - Update production secrets
   - Monitor logs for 24 hours
   - Keep old secrets for 7 days (emergency rollback)

5. **Revoke old secrets:**
   - Delete old API keys
   - Remove from password manager
   - Document rotation in changelog

---

## Testing Strategy

### Local Testing

**Before committing:**

```bash
# 1. Type checking
npm run typecheck

# 2. Linting
npm run lint

# 3. Build test
npm run build

# 4. Database tests (if applicable)
supabase test db

# 5. Manual testing
npm run dev
# Test changed features manually
```

---

### Staging Testing

**QA Checklist:**

#### Functional Testing
- [ ] User registration and login
- [ ] MFA setup and verification
- [ ] Receipt upload and extraction
- [ ] Export functionality (CSV, PDF, ZIP)
- [ ] Team invitations
- [ ] Admin operations
- [ ] Report generation

#### Database Testing
- [ ] Migrations applied successfully
- [ ] No missing tables or columns
- [ ] RLS policies working (try to access other users' data)
- [ ] Foreign keys intact
- [ ] Indexes present

#### Integration Testing
- [ ] Email delivery (Resend)
- [ ] File uploads (Supabase Storage)
- [ ] Edge Functions responding
- [ ] Authentication flow
- [ ] Payment processing (if applicable)

#### Performance Testing
- [ ] Page load time < 3 seconds
- [ ] Receipt upload < 5 seconds
- [ ] Export generation < 2 minutes
- [ ] Database queries < 1 second

---

### Production Smoke Tests

**After each deployment:**

```bash
# Automated smoke test script
curl https://app.yourdomain.com/health
# Expected: {"status": "ok", "version": "0.6.1"}

# Manual verification
# 1. Login as test user
# 2. Upload one receipt
# 3. Generate one report
# 4. Verify email notification
```

---

## Monitoring & Rollback

### Monitoring Setup

#### 1. Supabase Monitoring

**Built-in dashboard:**
- Database: Query performance, connections, storage
- Auth: Sign-ups, logins, MFA attempts
- Storage: Upload success rate, file sizes
- Edge Functions: Invocations, errors, latency

**Access:** Supabase Dashboard → Project → Observability

**Alerts to configure:**
- Database CPU > 80%
- Connection pool exhausted
- Failed auth attempts spike
- Edge Function errors > 5%

---

#### 2. Netlify Monitoring

**Built-in analytics:**
- Deploy success rate
- Build time trends
- Bandwidth usage
- 404 errors

**Access:** Netlify Dashboard → Site → Analytics

**Alerts to configure:**
- Deploy failures
- Build time > 10 minutes
- Traffic spike (potential DDoS)

---

#### 3. Sentry for Error Tracking (Recommended)

**Install:**
```bash
npm install @sentry/react
```

**Configure `src/main.tsx`:**
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE, // 'production' or 'staging'
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 0.1, // 10% of requests
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0, // 100% of errors
});
```

**Benefits:**
- Real-time error alerts
- Stack traces with source maps
- User session replay
- Performance monitoring
- Release tracking

---

### Rollback Procedures

#### Frontend Rollback (Instant)

**Via Netlify Dashboard:**
1. Go to: Deploys
2. Find last good deploy
3. Click "Publish deploy"
4. ✅ Instant rollback (~10 seconds)

**Via CLI:**
```bash
# List deploys
netlify deploys:list

# Rollback to specific deploy
netlify deploy --prod --restore <deploy-id>
```

**Expected time:** < 1 minute

---

#### Database Rollback (Manual)

**⚠️ Requires pre-planned rollback migration**

**Step 1: Create rollback migration (before deploying change)**

```bash
supabase migration new rollback_feature_name
```

**Write inverse operations:**
```sql
-- If original migration added a table:
DROP TABLE IF EXISTS new_table;

-- If original migration added a column:
ALTER TABLE users DROP COLUMN IF EXISTS new_column;

-- If original migration changed data:
UPDATE users SET status = 'old_status' WHERE status = 'new_status';
```

**Step 2: Deploy rollback**

```bash
# Apply rollback migration
supabase db push --project-ref production-id

# Or via GitHub Actions:
git add supabase/migrations/
git commit -m "Rollback: feature_name"
git push
```

**Expected time:** 2-5 minutes

---

#### Complete System Rollback

**Scenario:** Both frontend and database need rollback

**Steps:**

1. **Rollback frontend immediately:**
   ```bash
   netlify deploy --prod --restore <previous-deploy-id>
   ```
   ✅ Users see old frontend (working state)

2. **Assess database state:**
   - If new migration broke something, rollback database
   - If old frontend can work with new schema, leave database as-is

3. **Rollback database if needed:**
   ```bash
   supabase db push --project-ref production-id
   ```

4. **Verify system health:**
   - Run smoke tests
   - Check error logs
   - Monitor for 1 hour

5. **Post-mortem:**
   - Document what went wrong
   - Update runbooks
   - Improve testing

**Expected time:** 5-15 minutes

---

## Cost Analysis

### Monthly Cost Breakdown

#### Supabase Costs

**Development:**
- Local development: **FREE** (Docker)

**Staging:**
- Supabase Pro Plan: **$25/month**
- Includes:
  - 8 GB database
  - 100 GB bandwidth
  - 100 GB storage
  - Branching feature
  - Daily backups

**Production:**
- Supabase Pro Plan: **$25/month**
- May need to upgrade if:
  - > 8 GB database size → Custom pricing
  - > 100 GB bandwidth → $0.09/GB overage
  - > 100 GB storage → $0.021/GB overage

**Estimated Production Costs (Year 1):**
- 1,000 users: $25/month
- 10,000 users: $50-100/month (with overages)
- 100,000 users: Custom pricing (contact sales)

---

#### Netlify Costs

**Free Tier Includes:**
- 100 GB bandwidth/month
- 300 build minutes/month
- Unlimited sites and deploys
- Automatic HTTPS
- Deploy previews

**Paid Tiers (if needed):**

| Tier | Price | Bandwidth | Build Minutes | Use Case |
|------|-------|-----------|---------------|----------|
| Free | $0 | 100 GB | 300 min | Small projects |
| Pro | $19/month | 400 GB | 25,000 min | Growing apps |
| Business | $99/month | 1 TB | 1,000,000 min | High traffic |

**Estimated Costs (Year 1):**
- < 5,000 users: **FREE**
- 5,000-20,000 users: **$19/month**
- 20,000+ users: **$99/month**

---

#### API Costs

**OpenAI (Receipt Extraction):**
- GPT-4 Vision: $0.01 per image
- 1,000 receipts/month = $10
- 10,000 receipts/month = $100
- Can reduce costs:
  - Switch to GPT-4o mini: $0.002 per image (5x cheaper)
  - Use smaller image sizes
  - Cache extraction results

**Resend (Email):**
- Free tier: 3,000 emails/month
- Paid: $20/month for 50,000 emails
- Emails sent:
  - Invitation emails
  - Export notifications
  - Password resets
  - System alerts

**Estimated (1,000 users):**
- 500 receipts/month: $5 (OpenAI)
- 1,000 emails/month: $0 (Resend free tier)
- **Total:** $5/month

---

#### Total Monthly Costs

| Users | Supabase | Netlify | APIs | Total |
|-------|----------|---------|------|-------|
| 0-1,000 | $50 | $0 | $5-10 | **$55-60** |
| 1,000-10,000 | $75 | $19 | $50-100 | **$144-194** |
| 10,000-50,000 | $150 | $99 | $200-500 | **$449-749** |
| 50,000+ | Custom | $99+ | $500+ | **$1,000+** |

**Notes:**
- Staging + Production Supabase = $50/month minimum
- Costs scale with usage (bandwidth, storage, API calls)
- Monitor monthly bills and optimize (compression, caching)

---

## Troubleshooting Guide

### Common Issues

#### 1. "Migration already applied" Error

**Symptom:**
```
Error: Migration 20251011120000_add_export_jobs already applied
```

**Cause:** Migration was applied to remote but not in version control

**Solution:**
```bash
# Pull remote migrations
supabase db pull

# Commit them
git add supabase/migrations/
git commit -m "Sync migrations from production"
```

---

#### 2. Build Fails with "Module not found"

**Symptom:**
```
Error: Cannot find module '@supabase/supabase-js'
```

**Cause:** Dependencies not installed or out of sync

**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Or if in CI/CD:
# Make sure GitHub Actions uses `npm ci` not `npm install`
```

---

#### 3. Environment Variables Not Working

**Symptom:**
```
Error: supabaseUrl is required
```

**Cause:** Environment variables not loaded correctly

**Solution:**

**In local dev:**
```bash
# Check .env.local exists and has correct values
cat .env.local

# Restart dev server
npm run dev
```

**In Netlify:**
1. Check Site settings → Environment variables
2. Verify correct scope (Production vs Branch)
3. Trigger new deploy: Deploys → Trigger deploy → "Clear cache and deploy site"

---

#### 4. RLS Policy Blocking Access

**Symptom:**
```
Error: new row violates row-level security policy
```

**Cause:** User doesn't have permission according to RLS policy

**Solution:**

```sql
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- Temporarily disable RLS for debugging (NEVER in production!)
ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;

-- Fix the policy
CREATE POLICY "Allow access"
  ON your_table
  FOR ALL
  USING (auth.uid() = user_id);

-- Re-enable RLS
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
```

---

#### 5. Deploy Stuck on Netlify

**Symptom:** Build has been running for 20+ minutes

**Cause:** Infinite loop, build timeout, or network issue

**Solution:**

1. Cancel deploy: Deploys → Click deploy → "Cancel deploy"
2. Check build logs for errors
3. Try again with cache cleared:
   - Deploys → Trigger deploy → "Clear cache and deploy site"
4. If still failing, check:
   - Build command is correct
   - Dependencies install successfully
   - No infinite loops in code

---

#### 6. Supabase CLI Not Linking

**Symptom:**
```
Error: invalid project ref
```

**Cause:** Wrong project ID or not authenticated

**Solution:**

```bash
# Re-login
supabase login

# List your projects
supabase projects list

# Link with correct ID
supabase link --project-ref abc123xyz

# If prompted, enter database password
```

---

## Next Steps

### Immediate Actions (Week 1)

1. **Export from Bolt.new:**
   ```bash
   # Download all code from Bolt.new
   # Create GitHub repository
   # Push code to repository
   ```

2. **Set up Supabase:**
   - [ ] Create production project (Pro Plan)
   - [ ] Create staging branch
   - [ ] Install Supabase CLI locally
   - [ ] Test local development

3. **Configure Netlify:**
   - [ ] Connect GitHub repository
   - [ ] Configure environment variables
   - [ ] Set up branch deploys
   - [ ] Add custom domains

4. **Create CI/CD Pipeline:**
   - [ ] Add GitHub Actions workflows
   - [ ] Configure secrets
   - [ ] Test deployment to staging
   - [ ] Test deployment to production

---

### Short-term Improvements (Month 1)

1. **Testing Infrastructure:**
   - [ ] Set up Vitest for unit tests
   - [ ] Add database test suite
   - [ ] Configure Playwright for E2E tests
   - [ ] Add tests to CI/CD pipeline

2. **Monitoring:**
   - [ ] Set up Sentry for error tracking
   - [ ] Configure Supabase alerts
   - [ ] Set up uptime monitoring (Pingdom, UptimeRobot)
   - [ ] Create monitoring dashboard

3. **Documentation:**
   - [ ] Document deployment process for team
   - [ ] Create runbooks for common issues
   - [ ] Write onboarding guide for new developers
   - [ ] Document rollback procedures

---

### Long-term Enhancements (Quarter 1)

1. **Performance:**
   - [ ] Implement CDN for static assets
   - [ ] Add Redis caching layer
   - [ ] Optimize database queries
   - [ ] Implement code splitting

2. **Security:**
   - [ ] Set up Web Application Firewall (Cloudflare)
   - [ ] Implement rate limiting
   - [ ] Add DDoS protection
   - [ ] Regular security audits

3. **Scaling:**
   - [ ] Database read replicas
   - [ ] Edge Functions optimization
   - [ ] Implement queueing system (if needed)
   - [ ] Multi-region deployment

---

## Appendix

### Useful Commands Reference

#### Supabase CLI

```bash
# Start local dev
supabase start

# Stop local dev
supabase stop

# Create migration
supabase migration new migration_name

# Apply migrations locally
supabase db reset

# Deploy to remote
supabase db push --project-ref <id>

# Deploy Edge Functions
supabase functions deploy --project-ref <id>

# View logs
supabase functions logs <function-name> --project-ref <id>

# Set secrets
supabase secrets set KEY=value --project-ref <id>

# List secrets
supabase secrets list --project-ref <id>
```

---

#### Netlify CLI

```bash
# Login
netlify login

# Link site
netlify link

# Deploy to production
netlify deploy --prod

# Deploy preview
netlify deploy

# View logs
netlify logs

# List deploys
netlify deploys:list

# Rollback
netlify deploy --prod --restore <deploy-id>
```

---

#### Git Workflow

```bash
# Create feature branch
git checkout -b feature/export-system

# Make changes, commit
git add .
git commit -m "Add export system"

# Push to remote
git push origin feature/export-system

# Create PR on GitHub
# After approval, merge to staging
git checkout staging
git merge feature/export-system
git push origin staging

# Test on staging
# After QA approval, merge to main
git checkout main
git merge staging
git push origin main
```

---

### Resources

**Official Documentation:**
- [Supabase Docs](https://supabase.com/docs)
- [Netlify Docs](https://docs.netlify.com/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Vite Guide](https://vitejs.dev/guide/)

**Community:**
- [Supabase Discord](https://discord.supabase.com/)
- [Netlify Community](https://answers.netlify.com/)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/supabase)

**Monitoring:**
- [Sentry](https://sentry.io/)
- [LogRocket](https://logrocket.com/)
- [Datadog](https://www.datadoghq.com/)

---

## Conclusion

This guide provides a **production-ready deployment strategy** that:

✅ Separates development, staging, and production environments
✅ Automates deployment with CI/CD
✅ Ensures database migrations are safe and trackable
✅ Provides rollback capabilities
✅ Scales with your application
✅ Stays cost-effective

**Total Setup Time:**
- Initial: 4-8 hours (one-time)
- Ongoing: < 1 hour/week (monitoring, updates)

**Questions?** Refer to the troubleshooting section or official documentation.

**Ready to deploy? Start with [Step 1: Install Supabase CLI](#step-1-install-supabase-cli)**

---

**Document Version:** 1.0
**Last Updated:** 2025-10-11
**Maintained By:** DevOps Team
