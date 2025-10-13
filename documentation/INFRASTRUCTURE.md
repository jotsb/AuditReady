# Audit Proof - Infrastructure Documentation

## Current Infrastructure Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                          │
│                  (React SPA - Vite Build)                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTPS
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      STATIC HOSTING                             │
│                  (Netlify / Vercel / etc.)                      │
│                                                                 │
│  - Serves built React application                              │
│  - index.html + bundled JS/CSS                                 │
│  - Environment variables (VITE_SUPABASE_URL, etc.)             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ API Calls
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    SUPABASE CLOUD PLATFORM                      │
│                  (https://supabase.co)                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              PostgreSQL Database                         │  │
│  │  - User profiles, businesses, collections               │  │
│  │  - Receipts metadata                                     │  │
│  │  - Audit logs                                            │  │
│  │  - RLS (Row Level Security) policies                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Supabase Authentication                        │  │
│  │  - Email/password authentication                         │  │
│  │  - JWT token management                                  │  │
│  │  - Session management                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Supabase Storage (S3-compatible)               │  │
│  │  - Receipt images (PNG, JPG, PDF)                        │  │
│  │  - Bucket: "receipts"                                    │  │
│  │  - RLS policies for access control                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Supabase Edge Functions (Deno)                   │  │
│  │  - Function: extract-receipt-data                        │  │
│  │  - Processes receipt images                              │  │
│  │  - Calls OpenAI GPT-4 Vision API                         │  │
│  └──────────────────────┬───────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          │ HTTPS API Call
                          │
┌─────────────────────────▼─────────────────────────────────────┐
│                     OPENAI API                                │
│                 (api.openai.com)                              │
│                                                               │
│  - GPT-4 Vision (gpt-4o model)                               │
│  - Receipt OCR and data extraction                           │
│  - Requires: OPENAI_API_KEY                                  │
└───────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Frontend Application

**Technology Stack:**
- React 18.3.1
- TypeScript 5.5.3
- Vite 5.4.2 (build tool)
- Tailwind CSS 3.4.1
- Lucide React (icons)

**Hosting:**
- Static files (HTML, JS, CSS)
- Can be hosted on any static hosting provider:
  - Netlify
  - Vercel
  - AWS S3 + CloudFront
  - Cloudflare Pages
  - GitHub Pages

**Build Output:**
- `dist/index.html` (0.46 KB)
- `dist/assets/index-DgfeP8y_.css` (21.62 KB)
- `dist/assets/index-B9tptPHr.js` (831.62 KB)

### 2. Supabase Backend (Cloud)

**Instance Details:**
- URL: `https://0ec90b57d6e95fcbda19832f.supabase.co`
- Type: Managed cloud service
- Location: Likely AWS region (depends on Supabase configuration)

**Services:**

#### PostgreSQL Database
- Version: 15.x (Supabase managed)
- Extensions: uuid-ossp
- Tables: 7 (profiles, businesses, collections, collection_members, receipts, audit_logs, expense_categories)
- RLS: Enabled on all tables

#### Authentication
- Provider: Supabase Auth (built on GoTrue)
- Method: Email/password
- JWT tokens with configurable expiry
- No MFA currently active (planned feature)

#### Storage
- Provider: Supabase Storage (S3-compatible)
- Bucket: `receipts`
- File types: Images (PNG, JPG, JPEG, GIF, WEBP), PDF
- Max size: 50MB (UI limit, not enforced server-side)

#### Edge Functions
- Runtime: Deno
- Function: `extract-receipt-data`
- Dependencies: @supabase/supabase-js, OpenAI client
- Environment variables:
  - `SUPABASE_URL` (auto-provided)
  - `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)
  - `OPENAI_API_KEY` (must be configured)

### 3. External Dependencies

#### OpenAI API
- Model: gpt-4o (GPT-4 with vision)
- Purpose: Receipt OCR and data extraction
- Cost: ~$0.01 per receipt (varies by image size)
- Requires: API key

## Data Flow

### Receipt Upload Flow

```
1. User uploads receipt image
   ↓
2. Frontend: Convert PDF to PNG if needed (client-side)
   ↓
3. Frontend: Upload file to Supabase Storage
   Path: {user_id}/{timestamp}.{ext}
   ↓
4. Frontend: Call Edge Function with file path
   ↓
5. Edge Function: Download file from Storage
   ↓
6. Edge Function: Convert to base64
   ↓
7. Edge Function: Call OpenAI GPT-4 Vision API
   ↓
8. OpenAI: Analyze image, extract data
   ↓
9. Edge Function: Parse JSON response
   ↓
10. Edge Function: Return extracted data
   ↓
11. Frontend: Show verification modal
   ↓
12. User: Review and confirm/edit data
   ↓
13. Frontend: Insert receipt record in database
   ↓
14. Database: RLS policies verify permissions
   ↓
15. Receipt appears in list
```

### Authentication Flow

```
1. User submits email/password
   ↓
2. Frontend: Call supabase.auth.signInWithPassword()
   ↓
3. Supabase Auth: Verify credentials
   ↓
4. Supabase Auth: Generate JWT access token
   ↓
5. Frontend: Store session in browser
   ↓
6. All API calls: Include JWT in Authorization header
   ↓
7. Database: RLS policies use auth.uid() from JWT
   ↓
8. Access granted/denied based on policies
```

## Environment Variables

### Frontend (.env)
```env
VITE_SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### Edge Functions (Auto-provided by Supabase)
```env
SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (admin key)
SUPABASE_DB_URL=postgresql://...
```

### Edge Functions (Must be configured manually)
```env
OPENAI_API_KEY=sk-... (must be set in Supabase dashboard)
```

## Cost Structure (Estimated)

### Supabase
- **Free Tier:**
  - 500MB database
  - 1GB storage
  - 2GB bandwidth
  - 500K edge function invocations
- **Pro Tier ($25/month):**
  - 8GB database
  - 100GB storage
  - 250GB bandwidth
  - 2M edge function invocations

### OpenAI
- **GPT-4 Vision API:**
  - ~$0.01 per receipt
  - 100 receipts/month = $1
  - 1000 receipts/month = $10

### Static Hosting
- **Netlify/Vercel Free Tier:**
  - 100GB bandwidth
  - Unlimited builds
  - Custom domain

**Total Monthly Cost (Light Usage):**
- 0-500 receipts/month: $0-5 (Supabase free + OpenAI)
- 1000 receipts/month: ~$35 (Supabase Pro + OpenAI)

---

## Migration Guide: Supabase → Self-Hosted Infrastructure

### Option 1: Unraid + Docker + MongoDB (Complete Rewrite)

This would require **significant refactoring** as the application is tightly integrated with Supabase.

#### What Needs to Change:

**1. Database Layer (PostgreSQL → MongoDB)**
```javascript
// Current (Supabase SDK)
const { data } = await supabase.from('receipts').select('*');

// New (MongoDB)
const data = await db.collection('receipts').find({}).toArray();
```

**Changes Required:**
- Rewrite all database queries (~30+ queries across the app)
- Convert PostgreSQL schema to MongoDB collections
- Rebuild RLS logic in application code
- Rewrite joins (MongoDB doesn't support complex joins)
- Change data types (MongoDB uses different types)

**2. Authentication (Supabase Auth → Custom)**
```javascript
// Current
const { user } = await supabase.auth.signInWithPassword({...});

// New (Options)
Option A: Passport.js + Express
Option B: Auth0
Option C: Custom JWT implementation
```

**Changes Required:**
- Implement JWT token generation/validation
- Build user registration/login endpoints
- Session management
- Password hashing (bcrypt)
- Email verification
- Password reset flow

**3. File Storage (Supabase Storage → Minio/S3)**
```javascript
// Current
await supabase.storage.from('receipts').upload(path, file);

// New
await minioClient.putObject('receipts', path, file);
```

**Changes Required:**
- Setup Minio Docker container
- Implement file upload endpoints
- Handle file access control
- Generate signed URLs for file access

**4. Edge Functions → Express/Fastify API**
```javascript
// Current (Deno Edge Function)
Deno.serve(async (req) => {...});

// New (Express)
app.post('/api/extract-receipt', async (req, res) => {...});
```

**Changes Required:**
- Convert Deno code to Node.js
- Setup Express/Fastify server
- Handle CORS manually
- Implement error handling

#### Docker Compose Example for Unraid:

```yaml
version: '3.8'

services:
  # MongoDB Database
  mongodb:
    image: mongo:7.0
    container_name: auditready-db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    volumes:
      - /mnt/user/appdata/auditready/mongo:/data/db
    ports:
      - "27017:27017"
    restart: unless-stopped

  # Minio Object Storage
  minio:
    image: minio/minio:latest
    container_name: auditready-storage
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes:
      - /mnt/user/appdata/auditready/minio:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    restart: unless-stopped

  # Backend API (Node.js)
  api:
    build: ./backend
    container_name: auditready-api
    environment:
      NODE_ENV: production
      MONGODB_URI: mongodb://admin:${MONGO_PASSWORD}@mongodb:27017
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_USER}
      MINIO_SECRET_KEY: ${MINIO_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - mongodb
      - minio
    restart: unless-stopped

  # Frontend (Nginx)
  frontend:
    image: nginx:alpine
    container_name: auditready-frontend
    volumes:
      - ./dist:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "8080:80"
    depends_on:
      - api
    restart: unless-stopped
```

#### Estimated Migration Effort:
- **Database refactoring:** 40-60 hours
- **Authentication system:** 20-30 hours
- **File storage:** 10-15 hours
- **API development:** 30-40 hours
- **Testing:** 20-30 hours
- **Total: 120-175 hours (~3-4 weeks full-time)**

#### Pros of Self-Hosted:
- Full control over infrastructure
- No vendor lock-in
- Predictable costs
- Data stays on your hardware
- No internet dependency (after initial setup)

#### Cons of Self-Hosted:
- Significant development time
- More complex maintenance
- Manual security updates
- No automatic scaling
- Need to handle backups manually
- More points of failure

---

### Option 2: Self-Hosted Supabase (Easiest Migration)

Supabase is open-source and can be self-hosted!

#### Docker Compose Setup:

```yaml
# Use Supabase's official self-hosted setup
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run
docker compose up -d
```

#### What You Get:
- PostgreSQL database
- GoTrue (authentication)
- PostgREST (auto-generated REST API)
- Storage API
- Realtime subscriptions
- Deno edge functions
- Studio (admin UI)

#### Changes Required:
- Update `VITE_SUPABASE_URL` to point to your Unraid IP
- Update API keys in `.env`
- Configure domain/SSL
- Setup backups
- **Estimated Time: 4-8 hours**

#### Docker Compose for Unraid (Simplified):

```yaml
version: '3.8'

services:
  postgres:
    image: supabase/postgres:15.1.0.117
    container_name: auditready-postgres
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - /mnt/user/appdata/auditready/postgres:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  supabase-auth:
    image: supabase/gotrue:v2.99.0
    container_name: auditready-auth
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/postgres
      JWT_SECRET: ${JWT_SECRET}
      GOTRUE_SITE_URL: http://your-unraid-ip:8080
    depends_on:
      - postgres
    restart: unless-stopped

  supabase-rest:
    image: postgrest/postgrest:v12.0.1
    container_name: auditready-rest
    environment:
      PGRST_DB_URI: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/postgres
      PGRST_JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
    ports:
      - "3000:3000"
    restart: unless-stopped

  supabase-storage:
    image: supabase/storage-api:v0.43.11
    container_name: auditready-storage
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/postgres
      FILE_STORAGE_BACKEND: file
    volumes:
      - /mnt/user/appdata/auditready/storage:/var/lib/storage
    depends_on:
      - postgres
    ports:
      - "5000:5000"
    restart: unless-stopped

  # Add kong (API gateway), studio, realtime as needed
```

#### Pros of Self-Hosted Supabase:
- Minimal code changes
- Keep all current functionality
- Full Supabase feature set
- Easier migration
- Active community support

#### Cons of Self-Hosted Supabase:
- More complex than MongoDB
- Requires multiple containers
- Higher resource usage
- Need to maintain Supabase updates

---

## Recommendations

### For Quick Self-Hosting: Option 2 (Self-Hosted Supabase)
**Best if you want to:**
- Keep current code mostly intact
- Get up and running quickly
- Maintain all features

### For Full Control: Option 1 (Custom Stack)
**Best if you want to:**
- Learn the full stack
- Have complete control
- Optimize for your specific needs
- Willing to invest significant time

### Hybrid Approach: Keep Supabase Cloud for Now
**Best if you want to:**
- Focus on building features first
- Optimize costs later
- Validate the product
- Migrate when usage justifies it

---

## Next Steps

1. **Evaluate Requirements:**
   - Expected number of users
   - Monthly receipt volume
   - Budget constraints
   - Available time for migration

2. **Proof of Concept:**
   - Test self-hosted Supabase on Unraid
   - Measure resource usage
   - Test backup/restore procedures

3. **Migration Plan:**
   - Document current data schema
   - Export existing data
   - Setup test environment
   - Migrate development environment first
   - Validate all functionality
   - Plan production cutover

4. **Monitoring & Backups:**
   - Setup automated backups
   - Configure monitoring (Uptime Kuma, Grafana)
   - Document recovery procedures

---

**Document Version:** 1.0
**Last Updated:** 2025-10-06
**Author:** AuditReady Infrastructure Team
