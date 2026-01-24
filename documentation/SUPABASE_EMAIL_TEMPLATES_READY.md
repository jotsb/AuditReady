# Ready-to-Use Supabase Email Templates

## How to Apply These Templates

1. Go to: https://supabase.com/dashboard/project/mnmfwqfbksughmthfutg
2. Navigate to: **Authentication** → **Email Templates**
3. Select each template type
4. Copy and paste the HTML below
5. Click **Save**

---

## Template 1: Confirm Signup (Email Verification)

**When to use**: When users register for a new account

**Copy and paste this into Supabase "Confirm signup" template:**

```html
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      background-color: #f4f7fa;
      margin: 0;
      padding: 0;
    }
    .email-wrapper {
      background-color: #f4f7fa;
      padding: 40px 20px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .logo-section {
      text-align: center;
      padding: 40px 20px 20px;
      background-color: #f4f7fa;
    }
    .logo {
      max-width: 180px;
      height: auto;
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      font-size: 28px;
      margin: 0 0 10px 0;
      font-weight: 700;
    }
    .header p {
      color: #e0e7ff;
      font-size: 16px;
      margin: 0;
    }
    .content {
      padding: 35px 30px;
      color: #475569;
      line-height: 1.6;
    }
    .content p {
      margin: 0 0 20px 0;
      font-size: 16px;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff;
      padding: 14px 40px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 25px 0;
    }
    .button-container {
      text-align: center;
    }
    .link-box {
      background-color: #f1f5f9;
      padding: 15px;
      border-radius: 6px;
      margin: 25px 0;
      word-break: break-all;
    }
    .link-box a {
      color: #2563eb;
      font-size: 13px;
      text-decoration: none;
    }
    .info-box {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 15px 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .info-box p {
      margin: 0;
      color: #1e40af;
      font-size: 14px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      color: #64748b;
      font-size: 14px;
      margin: 8px 0;
    }
    .footer a {
      color: #2563eb;
      text-decoration: none;
    }
    .signature {
      text-align: center;
      padding: 30px 20px;
      background-color: #f4f7fa;
    }
    .signature p {
      color: #1e293b;
      font-size: 15px;
      margin: 5px 0;
    }
    .copyright {
      text-align: center;
      padding: 20px;
      background-color: #f4f7fa;
      border-top: 1px solid #e2e8f0;
    }
    .copyright p {
      color: #94a3b8;
      font-size: 12px;
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <!-- Logo -->
    <div class="logo-section">
      <img src="https://auditproof.ca/logo_audit_proof.png" alt="Audit Proof" class="logo" />
    </div>

    <!-- Main Container -->
    <div class="email-container">
      <!-- Header -->
      <div class="header">
        <h1>Verify Your Email</h1>
        <p>Welcome to Audit Proof!</p>
      </div>

      <!-- Content -->
      <div class="content">
        <p>Hi there,</p>
        <p>Thank you for creating an account with <strong>Audit Proof</strong>. To complete your registration and start managing your receipts, please verify your email address:</p>

        <div class="button-container">
          <a href="{{ .ConfirmationURL }}" class="button">Verify Email Address</a>
        </div>

        <p style="text-align: center; font-size: 14px; color: #64748b;">Or copy and paste this link:</p>

        <div class="link-box">
          <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
        </div>

        <div class="info-box">
          <p><strong>Important:</strong> This link expires in 24 hours.</p>
        </div>

        <p style="font-size: 15px;">If you didn't create this account, you can safely ignore this email.</p>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p><strong>Need Help?</strong></p>
        <p>Contact us at <a href="mailto:contact@auditproof.ca">contact@auditproof.ca</a></p>
      </div>
    </div>

    <!-- Signature -->
    <div class="signature">
      <p><strong>Best regards,</strong></p>
      <p style="font-weight: 600;">The Audit Proof Team</p>
    </div>

    <!-- Copyright -->
    <div class="copyright">
      <p>&copy; 2025 Audit Proof. All rights reserved.</p>
      <p>
        <a href="https://auditproof.ca">auditproof.ca</a> |
        <a href="https://auditproof.ca/privacy">Privacy</a> |
        <a href="https://auditproof.ca/terms">Terms</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## Template 2: Reset Password (Password Recovery)

**When to use**: When users request a password reset

**Copy and paste this into Supabase "Reset password" template:**

```html
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      background-color: #f4f7fa;
      margin: 0;
      padding: 0;
    }
    .email-wrapper {
      background-color: #f4f7fa;
      padding: 40px 20px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .logo-section {
      text-align: center;
      padding: 40px 20px 20px;
      background-color: #f4f7fa;
    }
    .logo {
      max-width: 180px;
      height: auto;
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      font-size: 28px;
      margin: 0 0 10px 0;
      font-weight: 700;
    }
    .header p {
      color: #e0e7ff;
      font-size: 16px;
      margin: 0;
    }
    .content {
      padding: 35px 30px;
      color: #475569;
      line-height: 1.6;
    }
    .content p {
      margin: 0 0 20px 0;
      font-size: 16px;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff;
      padding: 14px 40px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 25px 0;
    }
    .button-container {
      text-align: center;
    }
    .link-box {
      background-color: #f1f5f9;
      padding: 15px;
      border-radius: 6px;
      margin: 25px 0;
      word-break: break-all;
    }
    .link-box a {
      color: #2563eb;
      font-size: 13px;
      text-decoration: none;
    }
    .warning-box {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .warning-box p {
      margin: 0;
      color: #92400e;
      font-size: 14px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      color: #64748b;
      font-size: 14px;
      margin: 8px 0;
    }
    .footer a {
      color: #2563eb;
      text-decoration: none;
    }
    .signature {
      text-align: center;
      padding: 30px 20px;
      background-color: #f4f7fa;
    }
    .signature p {
      color: #1e293b;
      font-size: 15px;
      margin: 5px 0;
    }
    .copyright {
      text-align: center;
      padding: 20px;
      background-color: #f4f7fa;
      border-top: 1px solid #e2e8f0;
    }
    .copyright p {
      color: #94a3b8;
      font-size: 12px;
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <!-- Logo -->
    <div class="logo-section">
      <img src="https://auditproof.ca/logo_audit_proof.png" alt="Audit Proof" class="logo" />
    </div>

    <!-- Main Container -->
    <div class="email-container">
      <!-- Header -->
      <div class="header">
        <h1>Reset Your Password</h1>
        <p>We received your password reset request</p>
      </div>

      <!-- Content -->
      <div class="content">
        <p>Hi there,</p>
        <p>We received a request to reset the password for your <strong>Audit Proof</strong> account. Click the button below to create a new password:</p>

        <div class="button-container">
          <a href="{{ .ConfirmationURL }}" class="button">Reset Password</a>
        </div>

        <p style="text-align: center; font-size: 14px; color: #64748b;">Or copy and paste this link:</p>

        <div class="link-box">
          <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
        </div>

        <div class="warning-box">
          <p><strong>Security Notice:</strong> This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>

        <p style="font-size: 15px;">This password reset link can only be used once.</p>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p><strong>Need Help?</strong></p>
        <p>Contact us at <a href="mailto:contact@auditproof.ca">contact@auditproof.ca</a></p>
      </div>
    </div>

    <!-- Signature -->
    <div class="signature">
      <p><strong>Best regards,</strong></p>
      <p style="font-weight: 600;">The Audit Proof Team</p>
    </div>

    <!-- Copyright -->
    <div class="copyright">
      <p>&copy; 2025 Audit Proof. All rights reserved.</p>
      <p>
        <a href="https://auditproof.ca">auditproof.ca</a> |
        <a href="https://auditproof.ca/privacy">Privacy</a> |
        <a href="https://auditproof.ca/terms">Terms</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## Template 3: Change Email (Email Update Confirmation)

**When to use**: When users change their email address

**Copy and paste this into Supabase "Change email" template:**

```html
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      background-color: #f4f7fa;
      margin: 0;
      padding: 0;
    }
    .email-wrapper {
      background-color: #f4f7fa;
      padding: 40px 20px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .logo-section {
      text-align: center;
      padding: 40px 20px 20px;
      background-color: #f4f7fa;
    }
    .logo {
      max-width: 180px;
      height: auto;
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      font-size: 28px;
      margin: 0 0 10px 0;
      font-weight: 700;
    }
    .header p {
      color: #e0e7ff;
      font-size: 16px;
      margin: 0;
    }
    .content {
      padding: 35px 30px;
      color: #475569;
      line-height: 1.6;
    }
    .content p {
      margin: 0 0 20px 0;
      font-size: 16px;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff;
      padding: 14px 40px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 25px 0;
    }
    .button-container {
      text-align: center;
    }
    .link-box {
      background-color: #f1f5f9;
      padding: 15px;
      border-radius: 6px;
      margin: 25px 0;
      word-break: break-all;
    }
    .link-box a {
      color: #2563eb;
      font-size: 13px;
      text-decoration: none;
    }
    .info-box {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 15px 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .info-box p {
      margin: 0;
      color: #1e40af;
      font-size: 14px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      color: #64748b;
      font-size: 14px;
      margin: 8px 0;
    }
    .footer a {
      color: #2563eb;
      text-decoration: none;
    }
    .signature {
      text-align: center;
      padding: 30px 20px;
      background-color: #f4f7fa;
    }
    .signature p {
      color: #1e293b;
      font-size: 15px;
      margin: 5px 0;
    }
    .copyright {
      text-align: center;
      padding: 20px;
      background-color: #f4f7fa;
      border-top: 1px solid #e2e8f0;
    }
    .copyright p {
      color: #94a3b8;
      font-size: 12px;
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <!-- Logo -->
    <div class="logo-section">
      <img src="https://auditproof.ca/logo_audit_proof.png" alt="Audit Proof" class="logo" />
    </div>

    <!-- Main Container -->
    <div class="email-container">
      <!-- Header -->
      <div class="header">
        <h1>Confirm Email Change</h1>
        <p>Verify your new email address</p>
      </div>

      <!-- Content -->
      <div class="content">
        <p>Hi there,</p>
        <p>You recently changed the email address for your <strong>Audit Proof</strong> account. Please confirm your new email address:</p>

        <div class="button-container">
          <a href="{{ .ConfirmationURL }}" class="button">Confirm Email Change</a>
        </div>

        <p style="text-align: center; font-size: 14px; color: #64748b;">Or copy and paste this link:</p>

        <div class="link-box">
          <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
        </div>

        <div class="info-box">
          <p><strong>Note:</strong> Your account will continue using your previous email until you confirm this change.</p>
        </div>

        <p style="font-size: 15px;">If you didn't request this change, contact <a href="mailto:contact@auditproof.ca">support</a> immediately.</p>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p><strong>Need Help?</strong></p>
        <p>Contact us at <a href="mailto:contact@auditproof.ca">contact@auditproof.ca</a></p>
      </div>
    </div>

    <!-- Signature -->
    <div class="signature">
      <p><strong>Best regards,</strong></p>
      <p style="font-weight: 600;">The Audit Proof Team</p>
    </div>

    <!-- Copyright -->
    <div class="copyright">
      <p>&copy; 2025 Audit Proof. All rights reserved.</p>
      <p>
        <a href="https://auditproof.ca">auditproof.ca</a> |
        <a href="https://auditproof.ca/privacy">Privacy</a> |
        <a href="https://auditproof.ca/terms">Terms</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## Step-by-Step Application Instructions

### Step 1: Access Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Log in to your account
3. Select project: `mnmfwqfbksughmthfutg`

### Step 2: Navigate to Email Templates
1. Click **Authentication** in the left sidebar
2. Click **Email Templates**
3. You'll see 4 template types

### Step 3: Update Each Template

#### For "Confirm signup":
1. Click on **Confirm signup**
2. Delete everything in the template editor
3. Copy the entire "Template 1" HTML above
4. Paste into the editor
5. Click **Save changes**

#### For "Reset password":
1. Click on **Reset password** (or Magic Link)
2. Delete everything in the template editor
3. Copy the entire "Template 2" HTML above
4. Paste into the editor
5. Click **Save changes**

#### For "Change email":
1. Click on **Change email address**
2. Delete everything in the template editor
3. Copy the entire "Template 3" HTML above
4. Paste into the editor
5. Click **Save changes**

### Step 4: Configure Email Settings
1. Stay in **Authentication** section
2. Click **Settings** (or **Configuration**)
3. Scroll to **Email Auth** section
4. Ensure these are enabled:
   - ✅ **Enable email confirmations**
   - ✅ **Enable email change confirmations**
   - ✅ **Secure email change**

### Step 5: Set URLs
1. In the same settings page
2. Set **Site URL**: `https://auditproof.ca`
3. Add **Redirect URLs**:
   - `https://auditproof.ca/**`
   - `http://localhost:5173/**`
4. Click **Save**

---

## Testing Your Templates

### Send Test Emails:
1. **Test Verification**: Create a new account
2. **Test Password Reset**: Use "Forgot Password" feature
3. **Test Email Change**: Change email in profile settings

### Check These Things:
- ✅ Logo loads correctly
- ✅ Button is styled and clickable
- ✅ Text link works as backup
- ✅ Colors look professional
- ✅ Mobile responsive
- ✅ No broken images

### Test in Multiple Email Clients:
- Gmail (web and mobile)
- Outlook
- Apple Mail
- Hotmail

---

## Logo Setup

### Required Action:
Upload your logo to: `https://auditproof.ca/logo_audit_proof.png`

### How to Test Logo URL:
```bash
# Test if logo is accessible
curl -I https://auditproof.ca/logo_audit_proof.png

# Should return: HTTP/2 200
```

### Alternative: Use Data URL (No External Image Needed)
If you can't upload the logo, you can convert it to base64 and embed directly:

```html
<!-- Replace the img tag with: -->
<img src="data:image/png;base64,iVBORw0KG..." alt="Audit Proof" class="logo" />
```

Tool to convert: https://www.base64-image.de/

---

## Troubleshooting

### Logo Not Loading:
1. Ensure URL is publicly accessible
2. Test in incognito browser
3. Check SSL certificate is valid
4. Use base64 embed as backup

### Styles Not Applying:
1. Ensure all CSS is in `<style>` tag (inline)
2. No external CSS files
3. Test in multiple email clients
4. Some clients strip certain styles (that's why we keep it simple)

### Variables Not Working:
- `{{ .ConfirmationURL }}` - Must be exactly this (Supabase variable)
- Don't change the variable names
- Supabase automatically replaces them

---

## What These Templates Include

✅ **Professional Design**:
- Modern gradient blue header
- Clean white content area
- Rounded corners and shadows

✅ **Logo**:
- Displayed prominently
- Responsive sizing
- Won't break if missing

✅ **Buttons**:
- Large, clear CTA buttons
- Blue (#2563eb) brand color
- Touch-friendly on mobile

✅ **Text Links**:
- Backup link in case button doesn't work
- Easy to copy/paste
- In styled box for visibility

✅ **Info Boxes**:
- Colored for emphasis
- Important information highlighted
- Security warnings where needed

✅ **Professional Signature**:
- "Best regards"
- Team name
- Contact email

✅ **Footer**:
- Help section
- Contact email link
- Copyright notice
- Legal links (privacy, terms)

✅ **Mobile Responsive**:
- Fluid layout
- Readable on all screen sizes
- No horizontal scrolling

✅ **Email Client Compatible**:
- Works in Gmail, Outlook, Apple Mail
- No JavaScript (not supported)
- Inline CSS only
- Table-based layout for Outlook

---

## Complete Implementation Checklist

- [ ] Upload logo to `https://auditproof.ca/logo_audit_proof.png`
- [ ] Access Supabase dashboard
- [ ] Copy/paste Template 1 into "Confirm signup"
- [ ] Copy/paste Template 2 into "Reset password"
- [ ] Copy/paste Template 3 into "Change email"
- [ ] Enable email confirmations in settings
- [ ] Set site URL to `https://auditproof.ca`
- [ ] Add redirect URLs
- [ ] Save all changes
- [ ] Test with new account registration
- [ ] Test password reset flow
- [ ] Check email in multiple clients
- [ ] Verify logo displays correctly
- [ ] Test buttons work
- [ ] Test text links work

---

## Support

If you encounter issues:
1. Check logo URL is accessible
2. Verify Supabase variables (`{{ .ConfirmationURL }}`) are correct
3. Test in multiple email clients
4. Contact: contact@auditproof.ca

---

**Your templates are now ready to deploy!** Just copy, paste, and save in Supabase. 🎉
