# Solution: mask_ip Overload Issue

## Problem
PostgreSQL migration failed with "function name 'mask_ip' is not unique" when trying to create two overloaded functions where one calls the other.

## Root Cause
When creating `mask_ip(inet)` that calls `mask_ip(text)` internally, PostgreSQL's parser couldn't resolve the function reference during the CREATE statement, even though `mask_ip(text)` was already created earlier in the same migration.

This is a known PostgreSQL limitation when:
1. Creating overloaded functions in the same transaction
2. One overload calls another overload by name
3. The parser needs to resolve which overload at CREATE time

## Solution Implemented
Changed from direct overloading to a layered approach:

### Before (Failed):
```sql
CREATE FUNCTION mask_ip(text) ...       -- Base implementation
CREATE FUNCTION mask_ip(inet) ...       -- Calls mask_ip(text) - FAILED HERE
```

### After (Works):
```sql
-- Layer 1: Base implementations with unique names
CREATE FUNCTION mask_ip_text(text) ...    -- Base implementation
CREATE FUNCTION mask_ip_inet(inet) ...    -- Calls mask_ip_text() - NO AMBIGUITY

-- Layer 2: Convenience wrappers with overloaded names
CREATE FUNCTION mask_ip(text) ...         -- Calls mask_ip_text()
CREATE FUNCTION mask_ip(inet) ...         -- Calls mask_ip_inet()
```

### Why This Works:
1. **mask_ip_text** and **mask_ip_inet** have unique names → no ambiguity
2. **mask_ip_inet** calls **mask_ip_text** → clear, unambiguous reference
3. The overloaded **mask_ip** wrappers call uniquely-named functions → no circular resolution
4. All existing code using `mask_ip(...)` continues to work via the wrappers

## Benefits
- ✅ No parser ambiguity during function creation
- ✅ Backward compatible with existing code using `mask_ip()`
- ✅ Clear naming for internal functions (_text, _inet suffixes)
- ✅ Easy to debug and understand the call chain
- ✅ Can be extended with more overloads if needed

## Files Modified
- `20251015120000_security_hardening_phase_a.sql` - Updated function definitions and grants

## Testing
The solution creates 4 functions total:
1. `mask_ip_text(text)` - Internal: masks text IP
2. `mask_ip_inet(inet)` - Internal: converts inet to text, calls mask_ip_text
3. `mask_ip(text)` - Public wrapper: calls mask_ip_text
4. `mask_ip(inet)` - Public wrapper: calls mask_ip_inet

All views and other code continue to use `mask_ip(...)` and will work correctly.

## Lesson Learned
When creating overloaded PostgreSQL functions where one calls another:
- ✅ Use unique names for the actual implementations
- ✅ Create thin wrapper functions for the overloaded interface
- ❌ Don't create direct overloads that call each other by the same name

This pattern should be used for any future functions that need overloading with cross-references.
