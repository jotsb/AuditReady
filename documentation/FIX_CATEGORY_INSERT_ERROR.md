# Fix: "new row violates row-level security policy for table expense_categories"

## Problem
Cannot create expense categories - get RLS policy violation error.

## Root Cause
The RLS policy requires `created_by = auth.uid()`, but frontend doesn't set `created_by` field.

## Solution Applied

### ✅ Bolt Cloud (Already Fixed)
Migration applied automatically via MCP tool.

### 🔧 Self-Hosted (Apply This)

**Apply migration:**
```bash
cat supabase/migrations/20251102100000_fix_expense_categories_created_by_trigger.sql | \
  docker exec -i supabase-db psql -U postgres -d postgres
```

**Verify:**
```bash
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname = 'trigger_set_expense_category_created_by';"
```

## What It Does
Adds a trigger that auto-sets `created_by = auth.uid()` on INSERT, allowing the RLS policy to pass.

## Testing
1. Go to Settings > Categories
2. Click "Add Category"
3. Fill in name, description, color
4. Save
5. Should work without errors ✅

## Files
- Migration: `supabase/migrations/20251102100000_fix_expense_categories_created_by_trigger.sql`
- This guide: `FIX_CATEGORY_INSERT_ERROR.md`
