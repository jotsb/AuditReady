# Admin User Management Guide

## How to Make a User an Admin

### Method 1: Using the Script (Recommended)

**List all users first:**
```bash
npm run list-users
```

**Grant admin access to a user:**
```bash
npm run grant-admin user@example.com
```

Or directly:
```bash
node scripts/grant-admin-access.js user@example.com
```

### Method 2: Using SQL (Manual)

If you have direct database access, run this SQL query:

```sql
-- First, find the user's ID
SELECT id, email, full_name
FROM profiles
WHERE email = 'user@example.com';

-- Then grant admin access
INSERT INTO system_roles (user_id, role, granted_by, granted_at)
VALUES (
  'USER_ID_FROM_ABOVE',
  'admin',
  NULL,
  NOW()
);
```

### Method 3: Via Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Run the SQL queries from Method 2 above

## What Admin Users Can Do

Once a user is granted admin access, they can:

- Access the Admin Panel (gear icon in sidebar)
- View and manage all users
- Suspend/unsuspend users
- Reset user passwords
- Delete users (soft and hard delete)
- View comprehensive audit logs
- Manage system configuration
- View system health metrics
- Manage business accounts
- Access deleted receipts
- Configure log levels
- Run database queries

## Current Admin Users

You can check who has admin access:

```bash
npm run list-users
```

Or via SQL:
```sql
SELECT
  sr.user_id,
  p.email,
  p.full_name,
  sr.granted_at,
  granter.email as granted_by_email
FROM system_roles sr
JOIN profiles p ON p.id = sr.user_id
LEFT JOIN profiles granter ON granter.id = sr.granted_by
WHERE sr.role = 'admin'
ORDER BY sr.granted_at DESC;
```

## Remove Admin Access

To revoke admin access from a user:

```sql
DELETE FROM system_roles
WHERE user_id = 'USER_ID_HERE'
AND role = 'admin';
```

## Security Best Practices

1. **Limit admin users** - Only grant admin access to trusted individuals
2. **Audit regularly** - Review the list of admins periodically
3. **Use MFA** - Require multi-factor authentication for admin accounts
4. **Monitor actions** - Review audit logs for admin activities
5. **Document changes** - Keep track of who granted admin access and why

## Troubleshooting

### "User not found"
- Verify the email address is correct
- Check that the user has registered in the system
- Run `npm run list-users` to see all users

### "User is already a system admin"
- The user already has admin access
- No action needed

### "Missing SUPABASE_SERVICE_ROLE_KEY"
- Add the service role key to your `.env` file
- Get it from: Supabase Dashboard > Settings > API
- Or provide it as a command line argument

## Examples

**Grant admin to a new user:**
```bash
npm run grant-admin newadmin@example.com
```

**List all users to find the right email:**
```bash
npm run list-users
```

**Check if someone is already an admin:**
```bash
npm run list-users | grep "ADMIN"
```
