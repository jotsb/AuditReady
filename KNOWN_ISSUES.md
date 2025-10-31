# Known Migration Issues & Quick Fixes

## 1. Function Signature Change Errors

### Symptom
```
ERROR: cannot change return type of existing function
HINT: Use DROP FUNCTION function_name() first.
```

### Cause
Some migrations modify existing functions by changing their return type or parameters. PostgreSQL requires dropping the function first when the signature changes.

### Quick Fix Pattern
When you see this error:

1. Note the function name from the error (e.g., `cleanup_expired_recovery_codes`)
2. Edit the failing migration file
3. Add `DROP FUNCTION IF EXISTS function_name() CASCADE;` before the `CREATE OR REPLACE FUNCTION`
4. Change `CREATE OR REPLACE FUNCTION` to `CREATE FUNCTION`

**Example:**

Before:
```sql
CREATE OR REPLACE FUNCTION cleanup_expired_recovery_codes()
RETURNS jsonb
...
```

After:
```sql
DROP FUNCTION IF EXISTS cleanup_expired_recovery_codes() CASCADE;
CREATE FUNCTION cleanup_expired_recovery_codes()
RETURNS jsonb
...
```

### Files Already Fixed
- `20251006213000_phase1_rbac_system.sql` - All RBAC helper functions
- `20251009201000_add_recovery_code_expiration.sql` - cleanup_expired_recovery_codes

---

## 2. Non-Existent Column Errors

### Symptom
```
ERROR: column profiles.is_system_admin does not exist
```

### Cause
The system uses RBAC with separate tables:
- **profiles** - Basic user profile info
- **system_roles** - System-level roles (admin, support)
- **business_members** - Business-level roles (owner, manager, member)

Some migrations incorrectly reference `profiles.is_system_admin` which doesn't exist.

### Quick Fix Pattern

**Wrong:**
```sql
EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.is_system_admin = true
)
```

**Correct:**
```sql
is_system_admin(auth.uid())
```

### Helper Functions Available

```sql
-- System-level checks
is_system_admin(user_id uuid) RETURNS boolean
is_technical_support(user_id uuid) RETURNS boolean

-- Business-level checks
get_business_role(user_id uuid, business_id uuid) RETURNS text
is_business_owner(user_id uuid, business_id uuid) RETURNS boolean
is_business_owner_or_manager(user_id uuid, business_id uuid) RETURNS boolean
is_business_member(user_id uuid, business_id uuid) RETURNS boolean
```

### Files Already Fixed
- `20251013050000_add_email_receipt_support.sql` - System admin check

---

## Why CASCADE is Safe

The `CASCADE` keyword:
- Drops the function and any policies that depend on it
- The migration immediately recreates both
- Only affects objects related to that specific function
- Leaves other database objects intact

---

## Other Common Issues

### "policy already exists"
**Fix**: Add `DROP POLICY IF EXISTS "policy name" ON table_name;` before `CREATE POLICY`

### "column already exists"
**Fix**: Use `ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name type;`

### "table already exists"
**Fix**: Use `CREATE TABLE IF NOT EXISTS table_name (...);`

---

## Migration Strategy

Given the size of this migration set (78 files), encountering a few issues is expected. The recommended approach:

1. Run migrations: `./run-migrations.sh`
2. If it fails, note the error message
3. Find the fix pattern in this document
4. Apply the fix to that specific migration
5. Re-run: `./run-migrations.sh` (continues from failure point)
6. Repeat until complete

This is faster and safer than trying to predict and fix all potential issues upfront.

---

## Tracking Progress

Check how many migrations have succeeded:
```bash
docker exec -i supabase-db psql -U postgres -d postgres -c \
  'SELECT COUNT(*) as completed FROM schema_migrations WHERE success = true;'
```

Expected: 78 total migrations

---

## If You Encounter a New Error

1. Read the PostgreSQL error message carefully
2. Check which migration file failed (shown in output)
3. Identify the pattern:
   - Function signature change? → Add DROP CASCADE
   - Column doesn't exist? → Use helper functions
   - Policy exists? → Add DROP POLICY
4. Apply the appropriate fix
5. Re-run migrations

The migration runner is designed to be resilient - it will always continue from where it stopped.
