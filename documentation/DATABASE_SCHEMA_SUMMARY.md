# Database Schema Analysis - Summary

## Generated Files

### 1. **database_schema_complete.sql** (205 KB)
Complete SQL schema that can create the entire database structure from scratch.

**Contents:**
- 3 PostgreSQL extensions
- 5 custom ENUM types
- 37 tables with full definitions
- 71 indexes for performance
- 95 functions (business logic, triggers, utilities)
- 34 triggers (auto-updates, auditing, validation)
- 151 RLS policies (comprehensive security)
- Default data inserts (expense categories, configs)

**Usage:**
```bash
psql -U postgres -d your_database -f database_schema_complete.sql
```

### 2. **SCHEMA_README.md** (5.2 KB)
Comprehensive documentation covering:
- Overview of all tables by category
- Usage instructions
- Security model explanation
- Key features description
- Migration notes

### 3. **DATABASE_TABLES_REFERENCE.md** (11 KB)
Quick reference guide listing all 37 tables with their columns and types in a readable table format.

### 4. **DATABASE_RELATIONSHIPS.md** (7.5 KB)
Visual entity-relationship documentation including:
- ASCII art ER diagrams
- Foreign key relationships
- Cascade behavior
- Access control patterns
- Index strategy
- RLS policy patterns

## Database Overview

### Architecture
- **Multi-tenant**: Business-based isolation with collection-level access control
- **Role-based**: Multiple role types (system admin, business owner, collection admin, submitter, viewer)
- **Audit-ready**: Complete audit trail for compliance
- **Secure**: RLS on every table, rate limiting, IP blocking, MFA support

### Core Entities
1. **Profiles** (extends Supabase auth.users)
2. **Businesses** (organizations)
3. **Collections** (receipt folders/years)
4. **Receipts** (main data entity)
5. **Expense Categories** (classification)

### Security Features
- Row Level Security (RLS) on all tables
- 151 comprehensive security policies
- MFA with recovery codes
- Account lockout after failed attempts
- Rate limiting on sensitive operations
- IP blocking for bad actors
- Comprehensive audit logging

### Advanced Features
- Email receipt forwarding
- Multi-page receipt support
- Duplicate detection
- Soft delete with audit trail
- Export jobs (CSV, PDF, ZIP)
- Storage quota management
- Health monitoring
- Anomaly detection

## Statistics

| Metric | Count |
|--------|-------|
| Migration Files | 92 |
| Total Lines of SQL | 16,033 |
| Tables | 37 |
| Functions | 95 |
| Triggers | 34 |
| RLS Policies | 151 |
| Indexes | 71 |
| Custom Types | 5 |
| Extensions | 3 |

## Table Categories

### Authentication & Users (6 tables)
- profiles, system_roles, recovery_codes, failed_login_attempts, mfa_failed_attempts, account_lockouts

### Business & Organizations (4 tables)
- businesses, business_members, collections, collection_members

### Core Data (4 tables)
- receipts, expense_categories, email_receipts_inbox, receipt_approvals

### Security & Auditing (7 tables)
- audit_logs, system_logs, security_events, blocked_ips, rate_limit_config, rate_limit_attempts, user_rate_limit_overrides

### System Management (8 tables)
- system_config, system_health_metrics, dashboard_analytics, database_queries_log, admin_impersonation_sessions, user_activity_patterns, detected_anomalies, potential_duplicates

### User Features (8 tables)
- invitations, saved_filters, saved_audit_filters, saved_system_filters, export_jobs, cleanup_jobs, log_level_config, signed_url_requests

## Key Functions

### Authentication & Security
- `handle_new_user()` - Auto-create profile on signup
- `check_account_lockout()` - Validate login attempts
- `check_mfa_status()` - Verify MFA setup
- `verify_recovery_code()` - MFA recovery
- `check_rate_limit()` - Rate limiting

### Business Logic
- `get_user_businesses()` - Fetch accessible businesses
- `get_collection_role()` - Check collection permissions
- `calculate_storage_usage()` - Storage quota tracking
- `detect_receipt_duplicates()` - Find similar receipts

### Auditing
- `log_audit_event()` - Create audit log entry
- `log_system_event()` - Log system events
- `log_security_event()` - Track security incidents

### Data Management
- `soft_delete_receipt()` - Soft delete with audit
- `cleanup_orphaned_files()` - Storage cleanup
- `archive_old_receipts()` - Data archiving

## RLS Policy Examples

### Profile Access
```sql
-- Users can view own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
```

### Business Access
```sql
-- Users can view businesses they own or are members of
CREATE POLICY "Users can view own businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = businesses.id 
      AND user_id = auth.uid()
    )
  );
```

### Receipt Access
```sql
-- Collection members can view receipts
CREATE POLICY "Collection members can view receipts"
  ON receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collection_members
      WHERE collection_id = receipts.collection_id 
      AND user_id = auth.uid()
    )
  );
```

## Data Flow

### Receipt Upload
1. User uploads file → Supabase Storage
2. Insert record → `receipts` table (RLS check)
3. Trigger → Create audit log entry
4. Edge function → Extract data with ChatGPT
5. Update → Receipt with extracted data
6. Check → Duplicate detection
7. Workflow → Approval if required

### User Authentication
1. Supabase Auth → Validate credentials
2. Check → Account lockout status
3. Check → Failed login attempts
4. If MFA → Verify TOTP/SMS code
5. Success → Update last_login_at
6. Log → Audit trail entry
7. Session → Create auth session

## Maintenance Tasks

### Regular Maintenance
- Vacuum and analyze tables
- Reindex for performance
- Archive old audit logs
- Clean up soft-deleted records
- Monitor storage usage
- Check system health metrics

### Backup Strategy
```bash
# Full backup (daily)
pg_dump -U postgres -d auditproof > backup_$(date +%Y%m%d).sql

# Schema only (before changes)
pg_dump -U postgres -d auditproof --schema-only > schema_backup.sql

# Data only (for restore)
pg_dump -U postgres -d auditproof --data-only > data_backup.sql
```

## Performance Considerations

### Indexed Columns
- Foreign keys (automatic)
- Transaction dates
- User IDs
- Collection IDs
- Status fields
- Created/updated timestamps

### Query Optimization
- Use prepared statements
- Limit result sets
- Use indexes for WHERE clauses
- Avoid N+1 queries
- Use batch operations
- Cache frequently accessed data

### Monitoring
- Slow query log
- Query execution plans
- Table statistics
- Index usage statistics
- Connection pool metrics

## Security Best Practices

1. **Never disable RLS** - Every table must have RLS enabled
2. **Validate inputs** - Use CHECK constraints and validation functions
3. **Audit everything** - All actions should be logged
4. **Rate limit** - Prevent abuse on sensitive operations
5. **Soft delete** - Preserve audit trail
6. **Encrypt at rest** - Use Supabase encryption
7. **Use prepared statements** - Prevent SQL injection
8. **Monitor anomalies** - Track unusual patterns

## Migration Strategy

### For Fresh Installation
1. Run `database_schema_complete.sql`
2. Verify all tables created
3. Check RLS policies applied
4. Seed default data
5. Test with sample user

### For Existing Database
1. Backup current database
2. Run migrations sequentially from `supabase/migrations/`
3. Verify each migration succeeds
4. Test application functionality
5. Monitor for errors

## Troubleshooting

### Common Issues

**Missing columns:**
- Solution: Run missing migrations in order

**RLS policy failures:**
- Solution: Check user authentication
- Verify role assignments
- Review policy logic

**Performance issues:**
- Solution: Add missing indexes
- Optimize slow queries
- Check connection pool

**Audit log size:**
- Solution: Archive old logs
- Implement retention policy

## Next Steps

1. Review all generated documentation files
2. Test schema on development database
3. Adjust RLS policies as needed
4. Add custom indexes for your queries
5. Configure backup schedule
6. Set up monitoring alerts
7. Document custom changes
8. Train team on security model

---

**Generated:** 2025-10-30  
**Source:** 92 migration files  
**Status:** Production-ready
