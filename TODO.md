# AuditReady - TODO & Improvements

## 🚨 Critical (Must Fix Before Production)

### Security
- [ ] **Implement Multi-Factor Authentication (MFA)**
  - Setup wizard for authenticator apps
  - SMS-based 2FA option
  - Trusted device management
  - Recovery codes generation
  - Location: `src/pages/SettingsPage.tsx:30-37`

- [ ] **Password Reset Flow**
  - "Forgot Password" functionality
  - Email-based reset link
  - Password complexity requirements
  - Password strength indicator

- [ ] **Session Management**
  - Enforce session timeouts
  - Device tracking and management
  - "Logout all devices" feature
  - View active sessions

- [ ] **Rate Limiting**
  - Auth endpoint protection
  - Account lockout after failed attempts
  - API request throttling
  - Edge function rate limits

- [ ] **Input Validation**
  - Strengthen backend validation
  - File size enforcement (currently 50MB limit in UI only)
  - Malicious file type detection
  - Edge function input sanitization

### Performance
- [ ] **Implement Pagination**
  - Receipt list pagination (currently loads all)
  - Location: `src/pages/ReceiptsPage.tsx:68-83`
  - Dashboard recent receipts limit
  - Virtual scrolling for large lists

- [ ] **Reduce Bundle Size**
  - Code splitting by route
  - Lazy load components
  - Tree shake unused dependencies
  - Current size: 831KB uncompressed

---

## 🔴 High Priority

### Missing Core Features

#### Collections & Business Management
- [x] Create new collections interface
- [x] Edit/delete existing collections
- [x] Create new business entities
- [x] Edit business details (name, tax ID, currency)
- [x] Manage business ownership transfer
- [x] Location: `src/components/settings/BusinessManagement.tsx` & `src/components/settings/CollectionManagement.tsx`

#### Receipt Management
- [x] **Edit Receipt Functionality**
  - [x] Edit form for existing receipts
  - [x] Update all fields (vendor, date, amount, category)
  - [x] Track edit history in audit log
  - [x] Mark receipts as edited
  - [x] Location: `src/components/receipts/EditReceiptModal.tsx`

- [ ] **Bulk Operations**
  - Multi-select checkboxes
  - Bulk delete
  - Bulk export (CSV/PDF)
  - Bulk categorization
  - Bulk collection assignment

#### User Profile
- [ ] Update full name
- [ ] Change email address
- [ ] Update phone number
- [ ] Change password
- [ ] Profile picture upload
- [ ] Location: `src/pages/SettingsPage.tsx:10-23`

### Security Enhancements

#### File Storage
- [ ] Virus/malware scanning on upload
- [ ] Verify encryption-at-rest for receipt files
- [ ] Enforce file size limits server-side
- [ ] Add file type whitelist
- [ ] Implement file quarantine for suspicious uploads

#### Data Protection
- [ ] GDPR compliance features
  - User data export
  - Right to be forgotten (complete data deletion)
  - Data portability
- [ ] User-accessible audit logs
- [ ] PII masking in logs
- [ ] Automated backup system
- [ ] Data retention policies

#### Storage RLS Policies
- [ ] Verify and strengthen storage bucket policies
- [ ] Restrict file access by collection membership
- [ ] Add policies for failed extraction attempts
- [ ] Database-level rate limiting

---

## 🟡 Medium Priority

### Search & Filtering
- [ ] **Advanced Search**
  - Date range filter
  - Amount range filter (min/max)
  - Payment method filter
  - Multiple category selection
  - Full-text search across all fields
  - Location: `src/pages/ReceiptsPage.tsx:231-238`

- [ ] **Search Enhancements**
  - Saved searches/filter presets
  - Custom tags/labels for receipts
  - Search history
  - Export filtered results

### Performance Optimizations

#### Frontend Performance
- [ ] Lazy load receipt images
- [ ] Implement intersection observer for images
- [ ] Generate and use thumbnail images
- [ ] Add progressive image loading
- [ ] Implement receipt image caching

#### Data Caching
- [ ] Add React Query or SWR for data caching
- [ ] Cache dashboard statistics
- [ ] Cache frequently accessed collections
- [ ] Cache expense categories
- [ ] Implement stale-while-revalidate strategy

#### Database Optimization
- [ ] Add database-level pagination queries
- [ ] Create thumbnail storage for receipt images
- [ ] Implement materialized views for dashboard stats
- [ ] Optimize RLS policy queries
- [ ] Add composite indexes for common queries

#### Edge Function Optimization
- [ ] Generate optimized images before OpenAI extraction
- [ ] Implement image compression
- [ ] Cache extraction results
- [ ] Add retry logic with exponential backoff

### User Experience

#### Dashboard Improvements
- [ ] Fix "View receipt" functionality
  - Location: `src/pages/DashboardPage.tsx:102-104`
  - Currently just logs to console
- [ ] Add loading skeletons
- [ ] Implement real-time updates
- [ ] Add export dashboard data

#### Error Handling
- [ ] Better user-facing error messages
- [ ] Retry mechanism for failed extractions
- [ ] Offline support with service workers
- [ ] Error boundary components
- [ ] Toast notifications for errors

#### UI/UX Enhancements
- [ ] Undo functionality for deletions
- [ ] Keyboard shortcuts
- [ ] Dark mode support
- [ ] Mobile responsiveness testing
- [ ] Accessibility audit (WCAG 2.1)
- [ ] Loading states for all async operations

---

## 🟢 Nice to Have

### Reporting Features
- [ ] **Custom Reports**
  - Custom date range selection
  - Scheduled report generation
  - Email report delivery
  - More chart types (line, area, scatter)
  - Comparison reports (YoY, MoM)

- [ ] **Export Enhancements**
  - Excel export with formatting
  - Multiple sheets for categories
  - Customizable export templates
  - Automatic report scheduling

### Collaboration Features
- [ ] **Collection Members Management**
  - Invite users by email
  - Manage member roles (admin, submitter, viewer)
  - Role-based permissions enforcement
  - Remove members
  - Transfer ownership
  - Location: Database schema supports this, UI not implemented

- [ ] **Notifications**
  - Email notifications for new receipts
  - In-app notifications
  - Notification preferences
  - Digest emails (daily/weekly)
  - Location: `src/pages/SettingsPage.tsx:55-68`

### Advanced Features
- [ ] Receipt duplicates detection
- [ ] Auto-categorization using ML
- [ ] OCR accuracy improvement tracking
- [ ] Receipt templates for recurring expenses
- [ ] Mileage tracking integration
- [ ] Bank statement reconciliation
- [ ] Multi-currency support
- [ ] Receipt splitting (shared expenses)

### Compliance & Audit
- [ ] **Compliance Reports**
  - IRS-compliant reports
  - SOX compliance reports
  - Industry-specific formats
  - Audit trail reports

- [ ] **Data Management**
  - Automated data archival
  - Data retention policy enforcement
  - Compliance dashboard
  - Export audit logs

### API & Integrations
- [ ] REST API for third-party integrations
- [ ] Webhook support
- [ ] QuickBooks integration
- [ ] Xero integration
- [ ] Zapier integration
- [ ] Mobile app (React Native)

---

## 🧪 Testing & Quality

### Testing Infrastructure
- [ ] **Unit Tests**
  - Component tests
  - Hook tests
  - Utility function tests
  - Target: >80% coverage

- [ ] **Integration Tests**
  - API endpoint tests
  - Database query tests
  - Edge function tests
  - Auth flow tests

- [ ] **End-to-End Tests**
  - Receipt upload flow
  - User registration flow
  - Report generation flow
  - Collection management flow

### Code Quality
- [ ] ESLint configuration audit
- [ ] TypeScript strict mode
- [ ] Prettier configuration
- [ ] Pre-commit hooks
- [ ] CI/CD pipeline setup
- [ ] Automated security scanning
- [ ] Dependency vulnerability scanning

---

## 📋 Technical Debt

### Code Organization
- [ ] Split large components (ReceiptsPage is 465 lines)
- [ ] Create shared form components
- [ ] Extract API calls to service layer
- [ ] Standardize error handling patterns
- [ ] Add JSDoc comments

### Documentation
- [ ] API documentation
- [ ] Component documentation
- [ ] Database schema documentation
- [ ] Deployment guide
- [ ] Contributing guidelines
- [ ] Security policy

### Edge Function Improvements
- [ ] Better error handling and logging
- [ ] Add OpenAI API key rotation
- [ ] Implement fallback extraction methods
- [ ] Add extraction confidence scores
- [ ] Support for multiple OCR providers

---

## 📊 Monitoring & Analytics

### Application Monitoring
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring
- [ ] User analytics
- [ ] API usage metrics
- [ ] Database query performance
- [ ] Edge function metrics

### Business Metrics
- [ ] User engagement dashboard
- [ ] Receipt processing stats
- [ ] Extraction accuracy metrics
- [ ] Feature usage analytics
- [ ] Cost per extraction tracking

---

## 🔧 Infrastructure

### DevOps
- [ ] Automated backups
- [ ] Disaster recovery plan
- [ ] Load testing
- [ ] CDN setup for static assets
- [ ] Database replication
- [ ] Monitoring and alerting

### Security Infrastructure
- [ ] Web Application Firewall (WAF)
- [ ] DDoS protection
- [ ] Security headers (CSP, HSTS, etc.)
- [ ] Regular security audits
- [ ] Penetration testing
- [ ] Bug bounty program

---

## Notes

### Current Known Issues
1. Dashboard "View receipt" only logs to console instead of navigating
2. Bundle size is large (831KB) - needs optimization
3. No pagination causes performance issues with many receipts
4. MFA database fields exist but no UI implementation
5. ~~Settings page shows placeholder buttons with no functionality~~ ✅ Fixed - Collections & Business Management fully implemented

### Performance Benchmarks
- Target: First Contentful Paint < 1.5s
- Target: Time to Interactive < 3.5s
- Target: Receipt upload + extraction < 10s
- Target: Dashboard load < 2s

### Security Standards
- OWASP Top 10 compliance
- SOC 2 Type II (future consideration)
- GDPR compliance
- PCI DSS Level 4 (if processing payments)

---

**Last Updated:** 2025-10-06
**Priority Legend:** 🚨 Critical | 🔴 High | 🟡 Medium | 🟢 Nice to Have
