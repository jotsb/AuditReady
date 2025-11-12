# Database Schema Documentation - Index

## Quick Start

For most users, start here:
1. Read **DATABASE_SCHEMA_SUMMARY.md** for overview
2. Review **SCHEMA_README.md** for usage instructions
3. Use **database_schema_complete.sql** to create the database

## Documentation Files

### 📄 DATABASE_SCHEMA_SUMMARY.md (8.2 KB)
**Purpose:** Executive summary and comprehensive overview
**Best for:** Understanding the complete system architecture

**Contents:**
- Generated files overview
- Database statistics
- Architecture description
- Security features
- Table categories
- Key functions
- RLS policy examples
- Data flow diagrams
- Maintenance guidelines
- Troubleshooting tips

---

### 📘 SCHEMA_README.md (5.2 KB)
**Purpose:** User guide and reference
**Best for:** Day-to-day usage and administration

**Contents:**
- File descriptions
- Database statistics
- Table organization by category
- Usage instructions (installation, backup, verification)
- Security model explanation
- Key features
- Migration notes
- Support information

---

### 📋 DATABASE_TABLES_REFERENCE.md (11 KB)
**Purpose:** Quick reference for all tables
**Best for:** Looking up table structures quickly

**Contents:**
- 37 tables listed alphabetically
- Each table shows:
  - Column names
  - Data types
  - Clean table format

**Example:**
```
## receipts

| Column | Type |
|--------|------|
| id | uuid |
| collection_id | uuid |
| vendor_name | text |
| total_amount | numeric(10,2) |
...
```

---

### 🔗 DATABASE_RELATIONSHIPS.md (6.8 KB)
**Purpose:** Entity relationship documentation
**Best for:** Understanding how tables connect

**Contents:**
- ASCII art ER diagrams
- Core entity relationships
- Detailed relationship trees
- Foreign key relationships
- Cascade delete behavior
- Membership patterns
- Index strategy
- RLS policy patterns
- Audit trail explanation

---

### 💾 database_schema_complete.sql (205 KB)
**Purpose:** Complete database creation script
**Best for:** Creating fresh database or reference

**Contents:**
- 3 PostgreSQL extensions
- 5 custom ENUM types
- 37 tables with full definitions
- 71 performance indexes
- 95 functions
- 34 triggers
- 151 RLS security policies
- Default data (expense categories, etc.)

**Usage:**
```bash
psql -U postgres -d your_database -f database_schema_complete.sql
```

---

## Reading Order by Use Case

### 🎯 I want to understand the system
1. DATABASE_SCHEMA_SUMMARY.md
2. DATABASE_RELATIONSHIPS.md
3. SCHEMA_README.md

### 🔧 I want to set up a new database
1. SCHEMA_README.md (Usage section)
2. database_schema_complete.sql (run this)
3. DATABASE_SCHEMA_SUMMARY.md (verify setup)

### 📚 I want to develop against this database
1. DATABASE_TABLES_REFERENCE.md (quick lookup)
2. DATABASE_RELATIONSHIPS.md (understand connections)
3. src/lib/database.types.ts (TypeScript types)

### 🔒 I want to understand security
1. DATABASE_SCHEMA_SUMMARY.md (Security section)
2. DATABASE_RELATIONSHIPS.md (RLS patterns)
3. database_schema_complete.sql (search for "CREATE POLICY")

### 🐛 I have a problem
1. DATABASE_SCHEMA_SUMMARY.md (Troubleshooting section)
2. SCHEMA_README.md (Support section)
3. supabase/migrations/ (see historical changes)

---

## File Statistics

| File | Size | Lines | Purpose |
|------|------|-------|---------|
| database_schema_complete.sql | 205 KB | 7,402 | Full schema (executable) |
| DATABASE_SCHEMA_SUMMARY.md | 8.2 KB | ~450 | Overview & guide |
| DATABASE_TABLES_REFERENCE.md | 11 KB | ~550 | Table quick reference |
| DATABASE_RELATIONSHIPS.md | 6.8 KB | ~350 | ER documentation |
| SCHEMA_README.md | 5.2 KB | ~250 | User guide |
| **Total** | **236 KB** | **~9,000** | Complete documentation |

---

## Additional Resources

### In This Repository

- **supabase/migrations/**: Original 92 migration files (chronological history)
- **src/lib/database.types.ts**: TypeScript type definitions (auto-generated)
- **documentation/**: Application-specific documentation

### Related Documentation

- **DEPLOYMENT_GUIDE.md**: How to deploy the complete system
- **SECURITY_AUDIT_COMPLETE.md**: Security audit findings
- **PRODUCTION_READINESS.md**: Production checklist

---

## Quick Reference

### Database Connection

```bash
# Local development
psql -U postgres -d auditproof_dev

# Production (via Docker)
docker exec -it supabase-db psql -U postgres -d postgres

# With environment variables
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME
```

### Common Commands

```sql
-- List all tables
\dt

-- Describe table structure
\d receipts

-- List all functions
\df

-- List all policies
\d+ receipts  -- includes policies

-- Check RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

### Backup & Restore

```bash
# Backup
pg_dump -U postgres -d auditproof > backup.sql

# Restore
psql -U postgres -d auditproof_new < backup.sql

# Schema only
pg_dump -U postgres -d auditproof --schema-only > schema.sql

# Data only
pg_dump -U postgres -d auditproof --data-only > data.sql
```

---

## Version Information

- **Generated:** 2025-10-30
- **Source:** 92 migration files
- **Total SQL Lines:** 16,033
- **Database:** PostgreSQL 15+ (Supabase)
- **Status:** Production-ready

---

## Key Highlights

### ✅ Complete Coverage
- Every table documented
- All relationships mapped
- Full RLS policy coverage
- Comprehensive indexing

### 🔒 Security First
- RLS enabled on all tables
- 151 security policies
- Audit logging everywhere
- Rate limiting built-in

### 📊 Enterprise Features
- Multi-tenant architecture
- Role-based access control
- Complete audit trail
- Storage quota management
- Health monitoring
- Anomaly detection

### 🚀 Performance Optimized
- 71 strategic indexes
- Query optimization
- Connection pooling ready
- Efficient foreign keys

---

## Support & Maintenance

### For Questions
1. Check this documentation first
2. Review migration files for context
3. Consult TypeScript types for current schema
4. Check application code for usage examples

### For Updates
1. Create new migration file in `supabase/migrations/`
2. Test migration on development database
3. Update TypeScript types: `supabase gen types typescript`
4. Run migration on production
5. Update this documentation if major changes

### For Issues
- Missing columns: Run pending migrations
- RLS errors: Check user authentication and roles
- Performance: Review indexes and query plans
- Data integrity: Check foreign key constraints

---

**Last Updated:** 2025-10-30
**Maintained By:** Development Team
**License:** Proprietary
