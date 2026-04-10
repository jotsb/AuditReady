# Audit Proof - Implementation Status & Roadmap

**Last Updated:** 2026-04-10
**Current Version:** 1.3.0

---

## Overall Progress

```
████████████████████████░░░░░░░░ 76%
```

| Status | Count | Percentage |
|--------|-------|------------|
| Completed | **152** | **76%** |
| Partially Complete | **14** | **7%** |
| Pending | **34** | **17%** |
| **Total** | **200** | **100%** |

---

## Production Readiness

| Area | Status | Details |
|------|--------|---------|
| Core Features | COMPLETE | Auth, receipts, business, teams, collections, reports |
| Security | COMPLETE | MFA, RLS, rate limiting, sanitization, CSRF, XSS protection |
| Logging & Audit | COMPLETE | System logs, audit logs, edge function logs, structured logging |
| Performance | COMPLETE | Lazy loading, bundle splitting, DB indexes, thumbnails |
| Database Admin | COMPLETE | Full management hub with backup/restore, query browser, schema viewer |
| Testing | NOT STARTED | No automated tests |
| User Documentation | NOT STARTED | Technical docs exist, user-facing guides missing |

---

## Feature Status by Area

### 1. Authentication & User Management -- COMPLETE

All authentication features are fully implemented using Supabase email/password auth.

| Feature | Status | Description |
|---------|--------|-------------|
| User registration | DONE | Email/password signup with full name capture |
| User login | DONE | Email/password login with session management |
| User logout | DONE | Clean session termination |
| Session management | DONE | Supabase-managed sessions with auto-refresh |
| Password reset | DONE | Email-based "Forgot Password" flow with reset link |
| Profile management | DONE | Update name, email, phone, password in Settings |
| Email verification | DONE | Confirmation email on signup, resend option, clear messaging for unverified users |
| Password strength | DONE | Real-time strength indicator, 30+ common passwords blocked |
| Multi-Factor Auth (MFA) | DONE | TOTP authenticator app support with QR enrollment, 10 recovery codes, login verification, admin emergency reset |
| MFA rate limiting | DONE | Progressive lockout after failed attempts (3/5/10 = 5/15/60 min) |
| Custom email templates | PENDING | Still using default Supabase templates; branded designs not yet created |
| Terms of Service | PENDING | No ToS acceptance, privacy policy, or cookie consent yet |
| SMS-based 2FA | PENDING | Only TOTP supported; SMS not implemented |

**Key files:** `src/contexts/AuthContext.tsx`, `src/components/auth/`, `src/components/settings/MFAManagement.tsx`, `src/hooks/useMFA.ts`

---

### 2. Business Management -- COMPLETE

Businesses are the top-level organizational entity. Users create businesses, then collections within them, then receipts within collections.

| Feature | Status | Description |
|---------|--------|-------------|
| Create business | DONE | Name, tax ID, currency fields; owner auto-assigned |
| View/edit business | DONE | Edit name, tax ID, currency from Settings |
| Delete business | DONE | Soft delete with reason tracking, admin restore |
| Business switcher | DONE | Switch between businesses in the header dropdown |
| Business suspension | DONE | Admin can suspend businesses; RESTRICTIVE RLS blocks all member access at database level |
| Expandable card UI | DONE | Card-based layout showing nested collections, metrics, owner info |
| Storage tracking | DONE | Per-business storage_used_bytes and storage_limit_bytes with admin management |
| Data export | DONE | Async ZIP export via edge function with receipts, images, CSVs |
| Ownership transfer | PENDING | Cannot transfer business ownership to another user |
| Multi-business dashboard | PENDING | No aggregated view across all businesses |

**Key files:** `src/components/settings/BusinessManagement.tsx`, `src/components/settings/BusinessCollectionManagement.tsx`, `src/components/admin/BusinessAdminActions.tsx`

---

### 3. Collection Management -- COMPLETE (core)

Collections organize receipts within a business, typically by tax year or project.

| Feature | Status | Description |
|---------|--------|-------------|
| Create/edit/delete collections | DONE | Full CRUD with year, name, description |
| Collection members | DONE | Role-based access (admin, submitter, viewer) per collection |
| Nested under businesses | DONE | Visual hierarchy in expandable business cards |
| Collection templates | PENDING | No ability to create collections from templates |
| Duplicate collection | PENDING | No clone/copy functionality |
| Auto-create yearly | PENDING | No automatic collection creation for new years |
| Collection archival | PENDING | No archive state separate from deletion |

**Key files:** `src/hooks/useCollections.ts`, `src/components/settings/CollectionManagement.tsx`, `src/pages/CollectionsPage.tsx`

---

### 4. Receipt Management -- COMPLETE

Full receipt lifecycle from upload through AI extraction to export.

| Feature | Status | Description |
|---------|--------|-------------|
| Upload receipts | DONE | PDF, JPG, PNG, WebP; drag-and-drop; auto-thumbnail generation |
| Manual entry | DONE | Form for entering receipt data without a file |
| AI extraction (OCR) | DONE | OpenAI GPT-4 Vision extracts vendor, amounts, tax, date, category, payment method |
| View/edit receipts | DONE | Full detail view with image, edit modal for all fields |
| Delete receipts | DONE | Soft delete with restore capability; admin and owner management |
| Multi-page receipts | DONE | Upload multi-page PDFs; camera capture of multiple pages; parent-child receipt relationship |
| PDF conversion | DONE | PDF.js converts PDF pages to images; CSP-compliant worker bundling |
| Advanced search/filter | DONE | Date range, amount range, payment method, multi-category, vendor text search |
| Saved filters | DONE | Save/load/delete filter presets with default filter support |
| Bulk operations | DONE | Multi-select with bulk delete, categorize, move, CSV export, PDF export |
| Receipt verification | DONE | Modal to review and verify AI-extracted data before saving |
| Receipt learning | DONE | System learns vendor-to-category mappings from user corrections; improves future suggestions |
| Duplicate detection | DONE | Database function scans for duplicates by vendor+amount+date; admin dismiss/merge UI |
| Email forwarding | PARTIAL | Edge function and database ready; requires external Postmark account setup to receive emails |
| Bulk retry failed extractions | PENDING | No UI to retry all failed extractions at once |
| Receipt templates | PENDING | No recurring expense templates |
| Receipt splitting | PENDING | No ability to split receipt amounts between people/departments |
| Receipt attachments | PENDING | No supporting document attachments per receipt |
| Receipt comments | PENDING | No comment threads on receipts |

**Key files:** `src/pages/ReceiptsPage.tsx`, `src/pages/ReceiptDetailsPage.tsx`, `src/services/receiptService.ts`, `src/components/receipts/`, `supabase/functions/extract-receipt-data/`

---

### 5. Team Management -- COMPLETE

Full invitation-based team collaboration with role-based permissions.

| Feature | Status | Description |
|---------|--------|-------------|
| Invite by email | DONE | Send invitations with role selection (owner/manager/member) |
| Accept/reject invitations | DONE | Dedicated accept-invite page with login/signup flow |
| Manage roles | DONE | Change member roles; owner role protected from accidental downgrade |
| Remove members | DONE | Remove with confirmation dialog |
| Invitation lifecycle | DONE | View pending/accepted/rejected/expired; resend, cancel, copy link |
| Email notifications | DONE | Edge function sends invitation emails via SMTP with dynamic URL detection |
| Profile visibility | DONE | Team members can see each other's names and emails |

**Key files:** `src/pages/TeamPage.tsx`, `src/pages/AcceptInvitePage.tsx`, `supabase/functions/send-invitation-email/`, `supabase/functions/accept-invitation/`

---

### 6. Reports & Analytics -- COMPLETE (core)

Dashboard statistics, tax summaries, and export capabilities.

| Feature | Status | Description |
|---------|--------|-------------|
| Dashboard | DONE | Total expenses, receipt count, monthly totals, tax totals with stat cards |
| Category breakdown chart | DONE | Pie/donut chart showing spending by category |
| Recent receipts | DONE | Latest receipts on dashboard with thumbnails and quick navigation |
| Tax summary report | DONE | GST/PST breakdown by period |
| Year-end summary | DONE | Annual expense summary with category totals |
| CSV export | DONE | 14 fields including all financial data, properly escaped |
| PDF export | DONE | Professional A4 landscape with 11 columns, auto-pagination, summary section |
| Export jobs | DONE | Async ZIP generation via edge function with progress tracking and download |
| Custom reports | PENDING | No custom date ranges, scheduled generation, or email delivery |
| Excel export | PENDING | No XLSX format with formatting |

**Key files:** `src/pages/DashboardPage.tsx`, `src/pages/ReportsPage.tsx`, `src/components/reports/`, `src/components/dashboard/`

---

### 7. Audit Logging -- COMPLETE

Comprehensive audit trail for compliance and security monitoring.

| Feature | Status | Description |
|---------|--------|-------------|
| Audit logs table | DONE | Records action, resource, user, before/after snapshots, IP, user agent, status |
| Database triggers | DONE | Auto-log on INSERT/UPDATE/DELETE for all critical tables |
| Immutability | DONE | Audit logs and system logs cannot be modified or deleted (enforced by triggers) |
| Business audit view | DONE | Business owners see audit trail for their business |
| System-wide audit view | DONE | System admins see all audit events across platform |
| Advanced filtering | DONE | Multi-select filters, IP/email search, quick presets, saved filters |
| Unified log component | DONE | Single reusable AuditLogsView with expand/collapse, before/after diff |
| CSV export | DONE | Export filtered audit logs |
| Retention policies | PENDING | No automatic cleanup of old audit logs |
| Compliance reports | PENDING | No SOC 2 / GDPR formatted reports |

**Key files:** `src/pages/AuditLogsPage.tsx`, `src/pages/EnhancedAuditLogsPage.tsx`, `src/components/audit/`

---

### 8. System Logging -- COMPLETE

Structured system event logging with full operational visibility.

| Feature | Status | Description |
|---------|--------|-------------|
| System logs infrastructure | DONE | Levels (DEBUG-CRITICAL), categories (AUTH, DATABASE, API, etc.), session tracking |
| Application-wide logging | DONE | All 76 console statements converted to structured logging across 24 files |
| Edge function logging | DONE | All 4 edge functions log to system_logs via RPC |
| Error boundaries | DONE | React ErrorBoundary at app/content/page levels catches all component errors |
| Performance monitoring | DONE | dbMonitor.ts detects slow queries (>1s warning, >3s alert) |
| IP address capture | DONE | Server-side auto-capture via inet_client_addr() in log functions |
| Log level configuration | DONE | Admin UI to adjust min level per category, enable/disable categories dynamically |
| System logs page | DONE | Filter/search/paginate with advanced filters, saved presets, CSV export |
| Log volume optimization | DONE | 58% reduction by removing excessive DEBUG logs while adding critical missing logs |

**Key files:** `src/lib/logger.ts`, `src/pages/SystemLogsPage.tsx`, `src/hooks/useLogger.ts`, `src/lib/pageLogger.ts`

---

### 9. System Administration -- COMPLETE

Full admin panel with user management, business oversight, database tools, and system health.

| Feature | Status | Description |
|---------|--------|-------------|
| Admin overview | DONE | Platform statistics: users, businesses, receipts, storage, recent activity |
| User management | DONE | Search, suspend/unsuspend, soft/hard delete, password reset, change email, force logout, MFA reset, view details |
| Business management | DONE | View all businesses, suspend/unsuspend, soft delete, export data, storage limits |
| Bulk operations monitor | DONE | Track all bulk operations across users with metrics |
| Deleted receipts | DONE | View/restore/permanently delete soft-deleted receipts |
| Storage management | DONE | Platform-wide stats, per-business usage with warnings, largest files, recalculate |
| Data cleanup | DONE | Scan and delete orphaned files, failed extractions, old soft-deleted receipts |
| Log level config | DONE | Adjust logging verbosity per category without redeployment |
| System configuration | DONE | Storage limits, email settings, app settings, feature flags with database persistence |
| Duplicate detection | DONE | Scan for duplicate receipts, confidence scoring, dismiss/merge actions |
| System health monitor | DONE | Database health, user metrics, receipt metrics, storage metrics via RPC |
| Error log viewer | DONE | Filtered view of ERROR/CRITICAL system logs with details |
| Database management hub | DONE | 5-tab hub: Table Explorer, Schema Viewer, Statistics, Query Browser, Backup Manager |
| Admin user management edge fn | DONE | Secure edge function for password changes, hard deletes, email updates, force logout, MFA reset |
| User impersonation | PENDING | Database table exists but no "login as user" UI implemented |
| Admin reports | PENDING | No dedicated admin analytics reports (user activity, growth, extraction accuracy) |

**Key files:** `src/pages/AdminPage.tsx`, `src/components/admin/`, `src/components/admin/database/`, `supabase/functions/admin-user-management/`

---

### 10. Database Management Hub -- COMPLETE

Full database administration suite for system admins, added in v1.3.0.

| Feature | Status | Description |
|---------|--------|-------------|
| Table Explorer | DONE | Browse all tables with row counts, sizes, RLS status; view columns, indexes; paginated data browsing |
| Schema Viewer | DONE | Foreign key relationships, RLS policies with USING/WITH CHECK clauses, filterable |
| Database Statistics | DONE | Database size, version, uptime, connections, cache/index hit ratios, largest tables |
| SQL Query Browser | DONE | Read-only queries (SELECT/EXPLAIN/SHOW), timing, history, example queries, audit logging |
| Backup Manager | DONE | Create manual backups, real-time progress with heartbeat, download, restore from backup/file, delete |
| Backup edge function | DONE | Async backup creation with table data export, compression, storage upload, progress reporting |
| System health snapshot | DONE | Comprehensive RPC returning database, user, receipt, storage, and error metrics |
| Saved query library | PENDING | No ability to save and reuse admin queries |
| Real-time activity monitor | PENDING | No live view of running queries and connections |
| Index advisor | PENDING | No analysis of sequential scans vs index usage |
| Growth trends | PENDING | No historical size/growth tracking |
| RLS policy tester | PENDING | No simulated queries as specific users |
| Migration history viewer | PENDING | No timeline UI for applied migrations |

**Key files:** `src/components/admin/database/DatabaseManagementHub.tsx`, `src/components/admin/database/TableExplorer.tsx`, `src/components/admin/database/SchemaViewer.tsx`, `src/components/admin/database/DatabaseStats.tsx`, `src/components/admin/database/BackupManager.tsx`, `src/lib/dbManagementService.ts`, `supabase/functions/database-backup/`

---

### 11. Category Management -- COMPLETE (core)

Expense category system for organizing receipts.

| Feature | Status | Description |
|---------|--------|-------------|
| Default categories | DONE | 12 pre-populated categories (Meals, Transportation, Office Supplies, etc.) |
| Custom categories | DONE | Create, edit, delete custom categories per user |
| Category display order | DONE | Sort order field for custom ordering |
| Category suggestions | DONE | AI learns vendor-to-category patterns from user behavior |
| Category icons/colors | PARTIAL | Color column exists in DB; icon support in schema but not fully used in UI |
| Category analytics | PENDING | No dedicated category spending analysis |
| Industry templates | PENDING | No pre-built category sets by industry |

**Key files:** `src/components/settings/CategoryManagement.tsx`, `src/components/settings/CategorySuggestions.tsx`, `src/hooks/useCategories.ts`

---

### 12. Approval Workflow -- PARTIAL

Database schema exists but no UI implementation.

| Feature | Status | Description |
|---------|--------|-------------|
| Approvals table | DONE | `receipt_approvals` table with status, reviewer, notes |
| Business workflow setting | DONE | `require_approval_workflow` flag on businesses |
| Submit for approval UI | PENDING | No form to submit receipts for approval |
| Approve/reject UI | PENDING | No interface for reviewers to approve or reject |
| Pending approvals view | PENDING | No list of receipts awaiting approval |
| Approval notifications | PENDING | No email or in-app notifications |

**Key files:** Database migration `20251006010328_create_auditready_schema.sql` (receipt_approvals table)

---

### 13. Security -- COMPLETE (core)

Enterprise-grade security across all layers.

| Feature | Status | Description |
|---------|--------|-------------|
| RLS on all tables | DONE | Every table has Row Level Security enabled with restrictive policies |
| Input validation | DONE | Shared validation library (20 functions) applied to all 4 edge functions |
| XSS protection | DONE | DOMPurify sanitization with 13 functions applied to all user inputs |
| CSRF protection | DONE | Token system with 256-bit entropy, timing-safe comparison, rotation |
| Security headers | DONE | X-Frame-Options, HSTS, nosniff, XSS-Protection, Referrer-Policy |
| Rate limiting (DB) | DONE | 3 tables (rate_limit_attempts, failed_login_attempts, account_lockouts), 5 functions |
| Rate limiting (edge fns) | DONE | All edge functions rate limited (uploads 10/hr, emails 3/hr, exports 5/hr) |
| Login protection | DONE | Account lockout after 5 failed attempts, 30-minute duration |
| Storage RLS | DONE | File access restricted by collection membership; path-based validation |
| File upload validation | DONE | Server-side size limits, MIME type/extension matching, magic byte detection |
| PII masking | DONE | Email, phone, IP masking in log views; auto-unmask for admins |
| Signed URLs | DONE | Time-based expiration (1hr default), access tracking, permission validation |
| EXIF stripping | DONE | Client-side GPS/camera metadata removal before upload |
| Suspicious activity detection | DONE | Database tables for anomaly detection and user behavior patterns |
| Log immutability | DONE | Triggers prevent modification/deletion of audit_logs and system_logs |
| GDPR compliance | PENDING | No user data export, right-to-be-forgotten, or privacy policy page |
| Virus scanning | PENDING | No malware scanning on file uploads |
| WAF | PENDING | No web application firewall |
| Penetration testing | PENDING | No third-party security assessment |

**Key files:** `src/lib/sanitizer.ts`, `src/lib/csrfProtection.ts`, `supabase/functions/_shared/validation.ts`, `supabase/functions/_shared/rateLimit.ts`

---

### 14. Performance Optimization -- COMPLETE (core)

Two-phase optimization achieving significant improvements.

| Feature | Status | Description |
|---------|--------|-------------|
| Pagination | DONE | Database-level pagination on all list views (receipts, logs, users, businesses, etc.) |
| Thumbnail system | DONE | 200x200 WebP thumbnails generated on upload; lazy loaded with IntersectionObserver |
| Database indexes | DONE | 55+ indexes on critical columns (receipts, logs, rate limits, etc.) |
| Debounced search | DONE | 300ms debounce on all search/filter inputs |
| React.memo | DONE | 7 components memoized (StatCard, CategoryChart, RecentReceipts, etc.) |
| Request batching | DONE | Dashboard queries batched with Promise.all; thumbnail batch loader |
| Lazy page loading | DONE | All pages use React.lazy + Suspense for on-demand loading |
| Bundle splitting | DONE | 6 vendor chunks (react, supabase, tanstack, pdf, pdfjs, utils) |
| Progressive images | DONE | Shimmer skeleton animation during image loading |
| React Query caching | PARTIAL | Used in useDashboard.ts; remaining hooks (useReceipts, useCategories, useCollections) not migrated |
| Service worker | PENDING | No offline support |

**Key files:** `src/lib/imageOptimizer.ts`, `src/lib/requestBatcher.ts`, `src/lib/thumbnailBatcher.ts`, `src/components/shared/ReceiptThumbnail.tsx`, `vite.config.ts`

---

### 15. User Experience -- PARTIAL

Core UX features are in place; some polish items remain.

| Feature | Status | Description |
|---------|--------|-------------|
| Dark mode | DONE | Full theme system with light/dark/system preference, persisted to localStorage |
| Error boundaries | DONE | Nested at app/content/page levels with user-friendly recovery UI |
| Loading states | DONE | LoadingSpinner, skeleton loading, disabled buttons during operations |
| Toast notifications | DONE | Color-coded inline alerts with auto-dismiss for all CRUD operations |
| Centered pagination | DONE | Clean pagination controls across all list views |
| Floating action button | DONE | Quick capture (photo/upload/manual) FAB on receipts page |
| Onboarding wizard | PARTIAL | Component exists (`OnboardingWizard.tsx`) but not wired into the main app flow |
| Mobile camera | DONE | Camera capture and multi-photo sessions working on mobile |
| Keyboard shortcuts | PENDING | No keyboard navigation shortcuts |
| Mobile responsive audit | PENDING | No systematic responsive design review |
| Accessibility (WCAG) | PENDING | No accessibility audit performed |
| Help documentation | PENDING | No in-app user guide or FAQ |

**Key files:** `src/contexts/ThemeContext.tsx`, `src/components/shared/ErrorBoundary.tsx`, `src/components/shared/LoadingSpinner.tsx`, `src/components/onboarding/OnboardingWizard.tsx`

---

### 16. Testing -- NOT STARTED

No automated tests exist in the project.

| Feature | Status | Description |
|---------|--------|-------------|
| Testing framework | PENDING | No Vitest/Jest setup |
| Component tests | PENDING | No tests for auth, receipt, settings components |
| Hook tests | PENDING | No tests for useAuth, useReceipts, useCollections hooks |
| Utility tests | PENDING | No tests for date formatters, validators, sanitizers |
| E2E tests | PENDING | No Playwright/Cypress flows |
| RLS policy tests | PENDING | No automated tests for database access control |
| CI/CD pipeline | PENDING | No automated test execution on commits |

---

### 17. Monitoring & DevOps -- PARTIAL

Some monitoring exists through the admin panel; formal DevOps tooling is missing.

| Feature | Status | Description |
|---------|--------|-------------|
| Sentry integration | PARTIAL | `src/lib/sentry.ts` exists but Sentry is not configured as a dependency |
| System health monitoring | DONE | Admin panel shows DB health, user metrics, error counts via get_system_health_snapshot() |
| Database backups | DONE | Manual backup/restore via admin panel and edge function |
| Performance monitoring | DONE | Slow query detection in dbMonitor.ts, execution times in logs |
| Automated backups | PENDING | No scheduled automatic backups |
| Uptime monitoring | PENDING | No external health check service |
| CDN for static assets | PENDING | No CDN configured |
| Staging environment | PENDING | No separate staging deployment |
| User analytics | PENDING | No product analytics or feature usage tracking |

---

### 18. Notifications -- PARTIAL

| Feature | Status | Description |
|---------|--------|-------------|
| Invitation emails | DONE | Team invitation emails sent via SMTP edge function |
| Export completion emails | DONE | Email notification when async export completes |
| In-app notifications | PENDING | No notification center or real-time notification system |
| Email notifications | PENDING | No notifications for receipt uploads, approvals, summaries |
| Push notifications | PENDING | No mobile push notification support |

---

### 19. API & Integrations -- NOT STARTED

| Feature | Status | Description |
|---------|--------|-------------|
| REST API | PENDING | No public API for third-party integrations |
| API documentation | PENDING | No OpenAPI/Swagger docs |
| QuickBooks integration | PENDING | No accounting software integration |
| Zapier integration | PENDING | No workflow automation connector |
| Mobile app | PENDING | No React Native app |
| Browser extension | PENDING | No browser extension for receipt capture |

---

### 20. Code Quality & Technical Debt -- PARTIAL

| Feature | Status | Description |
|---------|--------|-------------|
| File organization | DONE | Components split into logical directories (admin, auth, receipts, settings, etc.) |
| TypeScript | DONE | Full TypeScript across all source files |
| ESLint | DONE | ESLint configured with React hooks and refresh plugins |
| Large component splitting | PENDING | Some components over 300 lines (ReceiptsPage, AdminPage) |
| Shared form components | PENDING | Form patterns not fully abstracted |
| TypeScript strict mode | PENDING | Not enabled |
| Pre-commit hooks | PENDING | No git hooks for linting or formatting |

---

## Database Summary

### Tables: ~30 in public schema
### RPC Functions: ~45+
### Indexes: ~55+
### Triggers: ~20+
### Edge Functions: 8 deployed
- extract-receipt-data (OCR via OpenAI GPT-4 Vision)
- process-export-job (async ZIP export)
- send-invitation-email (team invitations via SMTP)
- accept-invitation (invitation acceptance)
- admin-user-management (admin user operations)
- database-backup (async backup creation)
- receive-email-receipt (email-to-receipt via Postmark webhook)
- reevaluate-categories (AI category re-evaluation for new categories)
### Shared edge function modules: 3 (validation.ts, rateLimit.ts, imageCompression.ts)

---

## Migrations Applied (chronological)

### 2025 Series (Initial Development through v1.0.2)
- 46 migrations covering: schema creation, RBAC, audit logging, thumbnail support, MFA, saved filters, rate limiting, security hardening, performance indexes, dashboard analytics, email receipts, data cleanup, system config, duplicate detection, and various bug fixes

### 2026 Series (v1.1.0 through v1.3.0)
| Migration | Version | Description |
|-----------|---------|-------------|
| `20260123234718` | v1.1.0 | Fix team member profile visibility RLS |
| `20260123234804` | v1.1.0 | Fix owner role management |
| `20260124041119` | v1.1.0 | Add rate limit delete policy |
| `20260124041538` | v1.1.0 | Add rate limit configuration |
| `20260126070158` | v1.2.0 | Receipt learning system (vendor corrections, category mappings, suggestions) |
| `20260407070138` | v1.3.0 | Database management tools (table/schema/query/backup RPC functions) |
| `20260407112207` | v1.3.0 | Restore tracking for backups |
| `20260409052507` | v1.3.0 | Completed_with_errors backup status |
| `20260409055345` | v1.3.0 | Backup heartbeat and progress tracking |
| `20260409073808` | v1.3.0 | System health snapshot function |
| `20260409102441` | v1.3.0 | Close log immutability gaps |
| `20260409110356` | v1.3.0 | Fix system health and duplicate detection functions |

---

## Architecture

- **Frontend:** React 18 + TypeScript + Tailwind CSS + Vite
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **AI/OCR:** OpenAI GPT-4 Vision via edge function
- **State:** React Query (partial), React Context for auth/theme/alerts
- **Icons:** Lucide React
- **PDF:** jsPDF + autoTable for exports, PDF.js for conversion
- **Security:** Row Level Security (RLS), DOMPurify, CSRF tokens, rate limiting at DB + edge function level

---

## Known Issues

1. Approval workflow has database tables but no UI (receipt_approvals table unused)
2. Onboarding wizard component exists but is not wired into the app flow
3. Sentry error tracking module exists but the SDK is not installed as a dependency
4. Email receipt forwarding requires external Postmark setup to function
5. React Query caching only used in dashboard; other data hooks use direct Supabase queries
6. Bundle size ~460KB gzipped (acceptable for full SaaS, but could be optimized further)
