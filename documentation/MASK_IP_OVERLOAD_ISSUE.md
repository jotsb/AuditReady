# mask_ip Overload Issue - Detailed Analysis

## Problem Statement

The migration `20251015120000_security_hardening_phase_a.sql` fails with:
```
ERROR: function name "mask_ip" is not unique
```

This occurs when trying to CREATE the second overload of `mask_ip`.

## What's Happening

### The Two Functions

1. **mask_ip(text)** - Masks an IP address provided as text
2. **mask_ip(inet)** - Masks an IP address from inet type, calls mask_ip(text) internally

### The Failure Sequence

1. DROP any existing mask_ip functions (lines 301-315)
2. CREATE mask_ip(text) (line 318) - **SUCCEEDS**
3. CREATE mask_ip(inet) (line 342) - **FAILS with "not unique"**

### Why It Fails

When PostgreSQL parses the CREATE statement for `mask_ip(inet)`, it encounters:
```sql
RETURN mask_ip(host(p_ip_address)::text);
```

At this point, PostgreSQL needs to resolve which `mask_ip` function this refers to. The parser sees:
- A function call to `mask_ip` with a TEXT argument
- An existing function `mask_ip(text)` that matches
- But ALSO sees that we're currently CREATING another `mask_ip` function

PostgreSQL's function resolution gets confused during the creation phase, especially if:
- There are remnants from previous failed migrations
- The transaction state is unclear
- The parser is validating the function body before committing

## Root Cause Theories

### Theory 1: Parser Ambiguity During Creation
When CREATE OR REPLACE runs, PostgreSQL validates the function body. The body references `mask_ip(text)`, but the parser might be seeing BOTH:
- The existing mask_ip(text) we just created
- The mask_ip(inet) we're currently creating
This creates an ambiguity: "which mask_ip?"

### Theory 2: Implicit Casting Confusion
The call `mask_ip(host(...)::text)` explicitly casts to text, but PostgreSQL might still be checking if there are OTHER mask_ip overloads that could match, creating the "not unique" error.

### Theory 3: Transaction Isolation
If the migration runs in a transaction and the first CREATE hasn't been fully committed/visible when the second one tries to reference it, there could be a visibility issue.

### Theory 4: Existing Partial State
If a previous migration attempt partially succeeded, there might be:
- One mask_ip function in the catalog
- Dependency records that are confused
- View dependencies that weren't properly cleaned up

## What We've Tried

### Attempt 1: Sequential DROP IF EXISTS
```sql
DROP FUNCTION IF EXISTS mask_ip(text) CASCADE;
DROP FUNCTION IF EXISTS mask_ip(inet) CASCADE;
```
**Result:** FAILED - Still got "not unique" error

### Attempt 2: DO Block with Sequential Drops
```sql
DO $$
BEGIN
  DROP FUNCTION IF EXISTS mask_ip(text) CASCADE;
  DROP FUNCTION IF EXISTS mask_ip(inet) CASCADE;
END $$;
```
**Result:** FAILED - Still got "not unique" error

### Attempt 3: Dynamic Drop via pg_proc
```sql
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure
    FROM pg_proc
    WHERE proname = 'mask_ip'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
  END LOOP;
END $$;
```
**Result:** FAILED - Still got "not unique" error

### Attempt 4: Schema-Qualified Call + CREATE OR REPLACE
```sql
CREATE OR REPLACE FUNCTION mask_ip(p_ip_address text) ...
CREATE OR REPLACE FUNCTION mask_ip(p_ip_address inet)
...
  RETURN public.mask_ip(host(p_ip_address)::text);
...
```
**Result:** FAILED - Still got "not unique" error

### Attempt 5: Added search_path and STRICT
```sql
CREATE OR REPLACE FUNCTION mask_ip(p_ip_address inet)
...
STRICT
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN mask_ip(host(p_ip_address)::text);
END;
$$;
```
**Result:** Testing now...

## Possible Solutions

### Solution A: Split Into Two Migrations
Create two separate migration files:
1. `20251015120000_security_hardening_phase_a_part1.sql` - Creates mask_ip(text)
2. `20251015120001_security_hardening_phase_a_part2.sql` - Creates mask_ip(inet)

This ensures the first function is fully committed before the second references it.

### Solution B: Remove Overloading
Instead of two functions with the same name, create:
- `mask_ip_text(text)`
- `mask_ip_inet(inet)` - calls mask_ip_text

This avoids the overload resolution issue entirely.

### Solution C: Inline the Logic
Don't call one function from the other:
```sql
CREATE FUNCTION mask_ip(inet)
AS $$
DECLARE
  v_parts text[];
  v_ip_text text;
BEGIN
  v_ip_text := host(p_ip_address);
  -- duplicate the masking logic here
  ...
END;
$$;
```

### Solution D: Use Function Signature in Call
Explicitly specify which overload to call:
```sql
RETURN public.mask_ip(text)(host(p_ip_address)::text);
```

### Solution E: Transaction Control
Wrap each function creation in its own transaction block:
```sql
BEGIN;
  CREATE mask_ip(text) ...
COMMIT;

BEGIN;
  CREATE mask_ip(inet) ...
COMMIT;
```

## Recommended Next Steps

1. **Immediate**: Try Solution B (rename to avoid overloading)
2. **If that fails**: Try Solution A (split migrations)
3. **Long term**: Document this as a known PostgreSQL limitation in migrations

## Testing Notes

When testing locally with direct SQL execution (not via migration script), the functions CREATE successfully. This suggests the issue might be:
- How the migration runner handles multi-statement SQL
- Transaction boundaries in the migration runner
- Some state from the migration running context

