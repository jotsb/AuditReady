# Audit Proof

A comprehensive receipt management, expense tracking, and audit compliance platform built with React, TypeScript, and Supabase. Audit Proof helps businesses organize receipts, track expenses, manage teams, and generate professional reports for audit and tax purposes.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS |
| **Icons** | Lucide React |
| **Database** | Supabase (PostgreSQL) with Row-Level Security |
| **Storage** | Supabase Storage (receipt images, PDFs, exports) |
| **Authentication** | Supabase Auth (email/password + TOTP MFA) |
| **Server Functions** | Supabase Edge Functions (Deno) |
| **AI Processing** | OpenAI GPT-4 Vision (receipt data extraction) |
| **PDF Generation** | jsPDF + jspdf-autotable |
| **PDF Rendering** | PDF.js (multi-page receipt conversion) |
| **ZIP Archives** | JSZip (business data exports) |
| **Error Tracking** | Sentry |
| **XSS Prevention** | isomorphic-dompurify |
| **QR Codes** | qrcode (MFA enrollment) |
| **State Management** | React Query (@tanstack/react-query) |

---

## Features

### Receipt Management
- **Multi-Source Capture:** Upload images (JPG, PNG, WebP), PDFs, take photos with mobile camera, or forward receipts via email
- **AI-Powered Extraction:** Automatic vendor name, address, date, amounts (subtotal/GST/PST/total), payment method, and category extraction using OpenAI Vision
- **Multi-Page Receipts:** Upload multi-page PDFs or capture multiple photos as a single receipt with parent-child page relationships
- **Verification Flow:** Review and verify extracted data before saving with side-by-side comparison
- **Manual Entry:** Full manual receipt entry form for when physical receipts are unavailable
- **Soft Delete with Recovery:** Deleted receipts can be restored by admins or business owners
- **Bulk Operations:** Multi-select for bulk delete, categorize, move between collections, and export (CSV/PDF)
- **Advanced Search and Filtering:** Search by vendor, filter by date range, amount range, payment method, multiple categories; save and load filter presets

### Organization
- **Multi-Business Support:** Manage receipts across multiple businesses from a single account
- **Collections:** Organize receipts into collections (e.g., "Q1 2024", "Travel Expenses") within each business
- **Expense Categories:** 64+ pre-populated categories with custom category creation, color coding, and display ordering
- **Business-Scoped Data:** All data is isolated per business using Row-Level Security

### Team Collaboration
- **Role-Based Access Control:** Owner, Manager, and Member roles with distinct permissions
- **Email Invitations:** Invite team members by email with role assignment and 7-day expiration
- **Invitation Management:** Resend, cancel, copy link; accept via dedicated invitation page
- **Team Page:** View all members, change roles, remove members with pagination

### Reporting and Export
- **Dashboard Analytics:** Real-time expense totals, receipt counts, monthly spending, and tax breakdowns with category charts
- **CSV Export:** 14-field comprehensive export compatible with Excel/Google Sheets
- **PDF Reports:** Professional landscape-layout reports with receipt details, tax summaries, and optional receipt images
- **Tax Summary:** GST/PST breakdown for tax filing
- **Year-End Summary:** Comprehensive annual expense breakdown by category
- **Async Business Export:** Full business data export as ZIP archive (JSON data + receipt images + CSV per collection) with background processing

### Authentication and Security
- **Email/Password Authentication:** Registration, login, password reset, email verification
- **Multi-Factor Authentication (MFA):** TOTP authenticator app support with QR code enrollment, 10 recovery codes, admin emergency reset
- **Session Management:** Automatic session handling, force logout capability, logout on suspension/deletion
- **Row-Level Security:** 100% of tables protected with RLS policies; data isolation enforced at database level
- **Input Validation:** Comprehensive server-side and client-side validation (UUID, email, password, string, amount, date, file)
- **XSS Prevention:** DOMPurify integration with 13 sanitization functions
- **CSRF Protection:** Token-based CSRF protection with timing-safe comparison
- **Rate Limiting:** IP-based rate limiting with sliding window algorithm across all edge functions and login attempts
- **Account Lockout:** Automatic lockout after failed login/MFA attempts with progressive duration
- **PII Masking:** Email, phone, and IP address masking in log views with auto-unmask for admins
- **File Security:** Server-side file validation (size, MIME type, magic bytes), EXIF metadata stripping, signed URLs with expiration
- **Security Headers:** X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy

### System Administration (Admin Panel)
The admin panel provides 16+ sections for complete platform management:

**Overview and Analytics:**
- System-wide statistics dashboard (businesses, users, receipts, storage, admin counts)
- Analytics with 7/30-day trends and top categories

**User Management:**
- Search, filter, and view all users with detailed profiles
- Suspend/unsuspend with reasons, soft/hard delete with audit trail
- Force password reset, admin password change, force logout from all devices
- MFA status visibility and emergency MFA reset
- Restore deleted users

**Business Management:**
- Browse all businesses with member/collection/receipt counts and storage usage
- Suspend/unsuspend businesses (enforced via database RLS)
- Soft delete with data export before deletion
- Per-business storage quota tracking and recalculation

**Data Operations:**
- Deleted receipt management (restore or permanently delete)
- Data cleanup operations (orphaned files, failed extractions, old soft-deleted receipts)
- Duplicate receipt detection with confidence scoring and merge capability
- Bulk operations monitoring

**Monitoring:**
- System-wide audit logs with advanced filtering, saved presets, and CSV export
- System logs with level/category filtering, IP tracking, and session reconstruction
- Enhanced error log viewer
- System health monitoring with database, user, receipt, storage, and error metrics

**Configuration:**
- Log level configuration per category (DEBUG through CRITICAL)
- System configuration (storage limits, email settings, feature flags, rate limits, app settings)
- Rate limit management

**Database Management Hub:**
- **Table Explorer:** Browse all tables with structure (columns, types, defaults), paginated data view, and index information
- **Schema Viewer:** Foreign key relationships and RLS policy details with USING/WITH CHECK clauses
- **Database Statistics:** Size, row counts, connection metrics, cache/index hit ratios, largest tables visualization, PostgreSQL version
- **SQL Query Browser:** Read-only query execution (SELECT/EXPLAIN/SHOW) with history, timing, and audit logging
- **Backup Manager:** Create manual backups with table selection, real-time progress tracking, download, restore from backup or file upload

### Dark Mode
- Full dark/light/system theme support across all pages and components
- Persistent preference stored in localStorage

### Performance Optimizations
- **Lazy Loading:** All 9 pages load on-demand via React.lazy + Suspense
- **Bundle Splitting:** 6 vendor chunks for optimal browser caching
- **Database Indexes:** 10+ strategic indexes on high-traffic tables (40-90% faster queries)
- **Request Batching:** Batched API calls and thumbnail queries (80% fewer requests)
- **Debounced Search:** 300ms debounce on all search/filter operations
- **React.memo:** 7+ memoized components to reduce re-renders
- **Progressive Images:** Shimmer skeleton loading for receipt thumbnails
- **Thumbnail System:** WebP thumbnails generated on upload for list views

---

## Project Structure

```
src/
├── components/
│   ├── admin/              # Admin panel components
│   │   └── database/       # Database management hub (TableExplorer, SchemaViewer, etc.)
│   ├── audit/              # Audit log components and filtering
│   ├── auth/               # Login, register, MFA verification, password reset
│   ├── dashboard/          # Dashboard widgets (StatCard, CategoryChart, RecentReceipts)
│   ├── layout/             # Header, Sidebar, MainLayout, SectionLayout
│   ├── onboarding/         # New user onboarding wizard
│   ├── receipts/           # Receipt upload, capture, filtering, bulk operations
│   ├── reports/            # CSV, PDF, tax, and year-end report generation
│   ├── settings/           # Profile, MFA, business, category, theme management
│   └── shared/             # Reusable components (Modal, ErrorBoundary, LoadingSpinner, etc.)
├── contexts/
│   ├── AlertContext.tsx     # Global notification system
│   ├── AuthContext.tsx      # Authentication + business state management
│   └── ThemeContext.tsx     # Dark mode theme management
├── hooks/                  # Custom React hooks (useReceipts, useMFA, usePageTracking, etc.)
├── lib/                    # Services and utilities
│   ├── supabase.ts         # Supabase client singleton
│   ├── adminService.ts     # Admin operations (user/business management)
│   ├── dbManagementService.ts  # Database inspection, stats, backups
│   ├── logger.ts           # Structured logging system
│   ├── sanitizer.ts        # XSS prevention (13 functions)
│   ├── csrfProtection.ts   # CSRF token management
│   ├── passwordUtils.ts    # Password strength validation
│   ├── imageOptimizer.ts   # Image compression and thumbnails
│   ├── pdfConverter.ts     # PDF-to-image conversion
│   ├── requestBatcher.ts   # API request batching
│   └── ...                 # Additional utilities
├── pages/                  # Route-level page components (10 pages)
├── services/
│   └── receiptService.ts   # Receipt CRUD operations
└── App.tsx                 # Main app with routing and error boundaries

supabase/
├── functions/
│   ├── _shared/            # Shared utilities (validation, rate limiting, image compression)
│   ├── accept-invitation/  # Invitation acceptance handler
│   ├── admin-user-management/  # Admin user operations (password, delete, suspend)
│   ├── database-backup/    # Async database backup creation
│   ├── extract-receipt-data/   # AI receipt data extraction (OpenAI Vision)
│   ├── process-export-job/ # Async business data ZIP export
│   ├── receive-email-receipt/  # Email receipt webhook (Postmark)
│   ├── reevaluate-categories/  # AI category re-evaluation
│   └── send-invitation-email/  # Team invitation email sending
└── migrations/             # 75+ database migration files
```

---

## Database Schema

### Core Tables (32 tables)

| Category | Tables |
|----------|--------|
| **Users** | `profiles`, `recovery_codes`, `failed_login_attempts`, `account_lockouts` |
| **Business** | `businesses`, `business_members`, `invitations`, `collections`, `collection_members` |
| **Receipts** | `receipts`, `receipt_approvals`, `email_receipts_inbox`, `potential_duplicates` |
| **Categories** | `expense_categories`, `category_mappings`, `category_suggestions`, `vendor_corrections` |
| **Audit** | `audit_logs`, `system_logs`, `log_level_config`, `system_health_metrics`, `database_queries_log` |
| **Export** | `export_jobs`, `cleanup_jobs`, `database_backups` |
| **System** | `system_roles`, `system_config`, `rate_limit_attempts`, `admin_impersonation_sessions` |
| **Filters** | `saved_filters`, `saved_audit_filters`, `saved_system_filters` |

### Edge Functions (8 deployed)

| Function | Purpose |
|----------|---------|
| `extract-receipt-data` | AI-powered receipt data extraction via OpenAI Vision |
| `process-export-job` | Async business data export (ZIP archive) |
| `send-invitation-email` | Team invitation email delivery |
| `accept-invitation` | Invitation token validation and member creation |
| `admin-user-management` | Admin user operations (password, delete, suspend) |
| `reevaluate-categories` | AI category re-evaluation for receipts |
| `database-backup` | Async database backup creation with compression |
| `receive-email-receipt` | Email receipt webhook processing (Postmark) |

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Supabase project (or self-hosted Supabase instance)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd project
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables

Create a `.env` file in the root directory:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Apply database migrations

The `supabase/migrations/` directory contains 75+ migration files that set up the complete schema including tables, RLS policies, functions, triggers, and indexes.

5. Deploy Edge Functions

Deploy all 8 edge functions from `supabase/functions/` to your Supabase project.

6. Build for production
```bash
npm run build
```

### Admin Scripts

| Script | Purpose |
|--------|---------|
| `npm run reset-password` | Reset admin password |
| `npm run grant-admin` | Grant system admin role to a user |
| `npm run list-users` | List all users in the system |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |

Edge functions automatically have access to `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DB_URL`.

---

## Architecture Highlights

### Multi-Tenant Data Isolation
All data access is controlled through PostgreSQL Row-Level Security. Each table has granular policies for SELECT, INSERT, UPDATE, and DELETE operations. Business suspension is enforced at the database level via restrictive RLS policies.

### Audit Trail
Every data modification is captured via database triggers into `audit_logs` with before/after snapshots. Application events are logged to `system_logs` with structured metadata. Admin queries are logged to `database_queries_log`. All log tables have immutability protections.

### Receipt Processing Flow
1. User uploads image/PDF or captures photo
2. File stored in Supabase Storage with RLS protection
3. Edge function sends image to OpenAI Vision API for extraction
4. User reviews and verifies extracted data
5. Receipt saved with full audit trail

### Security Layers
1. **Authentication:** Supabase Auth with MFA
2. **Authorization:** RBAC (owner/manager/member) + system admin roles
3. **Data Access:** Row-Level Security on every table
4. **Input:** Server-side validation + client-side sanitization
5. **Transport:** HTTPS + security headers + CSRF tokens
6. **Storage:** File validation + EXIF stripping + signed URLs
7. **Monitoring:** Rate limiting + account lockout + anomaly detection

---

## License

This project is private and proprietary.
