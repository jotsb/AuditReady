# Password Reset Guide

## I forgot my admin password, what do I do?

### Option 1: Use the App (Recommended - Easiest)

1. Go to your login page
2. Click **"Forgot Password?"**
3. Enter your email: `brarjot@hotmail.ca`
4. Check your email inbox
5. Click the reset link in the email
6. Set your new password

### Option 2: Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/mnmfwqfbksughmthfutg
2. Navigate to: **Authentication** > **Users**
3. Find your user email
4. Click the **three dots menu** (⋮)
5. Select **"Send Password Recovery"**
6. Check your email

### Option 3: Direct Reset Link (No email needed)

If email is not configured or not working:

1. Get your **Service Role Key** from:
   - https://supabase.com/dashboard/project/mnmfwqfbksughmthfutg/settings/api
   - Copy the "service_role" key (not the anon key)

2. Add it to your `.env` file:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

3. Run the reset script:
   ```bash
   npm run reset-password brarjot@hotmail.ca
   ```

4. The script will output a direct reset link
5. Copy and paste the link into your browser
6. Set your new password

## Creating a New Admin Account

If you're locked out completely, you can create a new account and grant it admin privileges:

1. Register a new account through the app
2. Use another admin account to grant admin access
3. Or manually add the admin role in the database:

```sql
INSERT INTO system_roles (user_id, role, granted_by)
VALUES (
  'YOUR_NEW_USER_ID',
  'admin',
  NULL
);
```

## Security Best Practices

- Use a strong password (12+ characters, mixed case, numbers, symbols)
- Enable MFA after resetting your password
- Don't share admin credentials
- Use password managers to store credentials securely
