# Multi-Factor Authentication (MFA) Implementation Plan

## Overview
This document outlines the complete implementation plan for adding TOTP-based Multi-Factor Authentication to AuditReady.

---

## 🎯 Goals

1. **Security**: Protect user accounts from password theft
2. **Compliance**: Meet enterprise security requirements (SOC 2, ISO 27001)
3. **User Experience**: Simple setup, reliable login flow
4. **Recovery**: Backup codes for device loss scenarios
5. **Flexibility**: Optional for users, enforceable for roles

---

## 📋 MFA Options Available to Users

### Primary Method: TOTP Authenticator Apps ⭐
**Compatible Apps:**
- Google Authenticator
- Microsoft Authenticator
- Authy
- 1Password
- Bitwarden
- Any TOTP-compatible app

**Why TOTP First:**
- ✅ Free (no SMS costs)
- ✅ Most secure (offline, no SIM swap risk)
- ✅ Enabled by default in Supabase
- ✅ Industry standard
- ✅ Works internationally

### Backup Method: Recovery Codes
- 10 single-use backup codes
- Generated during MFA setup
- Used if authenticator app is lost
- Can be regenerated in settings

### Future Option: SMS/WhatsApp (Phase 2)
- Not included in initial implementation
- Requires SMS provider (Twilio, MessageBird)
- Costs ~$0.01 per message
- Add only if business need exists

---

## 🗄️ Database Design

### Existing Tables (Already Ready)
**profiles table:**
- `mfa_enabled` (boolean) - MFA status
- `mfa_method` (text) - 'authenticator' or 'sms'
- `phone_number` (text) - For future SMS support
- `trusted_devices` (jsonb) - Device fingerprints

### New Table Required: recovery_codes

```sql
CREATE TABLE recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code_hash text NOT NULL,
  used boolean DEFAULT false,
  used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 year')
);

-- Indexes for performance
CREATE INDEX idx_recovery_codes_user_id ON recovery_codes(user_id);
CREATE INDEX idx_recovery_codes_unused ON recovery_codes(user_id, used) WHERE used = false;

-- RLS Policies
ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recovery codes"
  ON recovery_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own recovery codes"
  ON recovery_codes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recovery codes"
  ON recovery_codes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recovery codes"
  ON recovery_codes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

**Security Note:** Store hashed codes only, not plain text!

---

## 🎨 User Interface Components

### 1. MFA Setup Component (`MFASetup.tsx`)
**Location:** `src/components/settings/MFASetup.tsx`

**Features:**
- Step-by-step wizard (3 steps)
- QR code generation and display
- Manual entry fallback (secret key)
- Verification code input
- Recovery codes display with download option

**Steps:**
1. **Introduction** - Explain MFA benefits
2. **Scan QR Code** - Display QR + manual key
3. **Verify Setup** - Enter 6-digit code
4. **Save Recovery Codes** - Display 10 codes, require download/copy

### 2. MFA Login Component (`MFAVerification.tsx`)
**Location:** `src/components/auth/MFAVerification.tsx`

**Features:**
- 6-digit code input with auto-focus
- "Use recovery code instead" toggle
- "Trust this device" checkbox (30 days)
- Resend code option (for future SMS)
- Clear error messages

**User Flow:**
- Email/password success → MFA verification screen
- Enter TOTP code OR recovery code
- Optional: Trust device
- Access granted with aal2 assurance

### 3. MFA Management Component (`MFAManagement.tsx`)
**Location:** `src/components/settings/MFAManagement.tsx`

**Features:**
- Current MFA status (enabled/disabled)
- Enable/disable toggle with confirmation
- View active authenticator factors
- Regenerate recovery codes
- View trusted devices list
- Remove trusted devices

**Actions:**
- **Enable MFA** - Launch setup wizard
- **Disable MFA** - Require password + current TOTP code
- **View Recovery Codes** - Show count, regenerate option
- **Manage Devices** - List devices, revoke access

### 4. Recovery Code Display (`RecoveryCodesDisplay.tsx`)
**Location:** `src/components/settings/RecoveryCodesDisplay.tsx`

**Features:**
- Grid display (2 columns x 5 rows)
- Copy all button
- Download as .txt file
- Print option
- "I've saved these codes" confirmation checkbox
- Warning: "Save these codes now - you won't see them again"

---

## 🔐 Security Implementation

### TOTP Enrollment Flow
```typescript
// 1. User initiates MFA setup
const { data: { factors } } = await supabase.auth.mfa.enroll({
  factorType: 'totp',
  friendlyName: 'Authenticator App'
});

// 2. Display QR code from factors[0].totp.qr_code
// 3. Display secret from factors[0].totp.secret

// 4. User enters verification code
const { data } = await supabase.auth.mfa.challengeAndVerify({
  factorId: factors[0].id,
  code: userEnteredCode
});

// 5. Generate and store recovery codes (hashed)
```

### TOTP Verification Flow
```typescript
// 1. After successful password login
const { data: { factors } } = await supabase.auth.mfa.listFactors();

// 2. Create challenge
const { data: challenge } = await supabase.auth.mfa.challenge({
  factorId: factors[0].id
});

// 3. Verify code
const { data } = await supabase.auth.mfa.verify({
  factorId: factors[0].id,
  challengeId: challenge.id,
  code: userCode
});

// 4. Check assurance level
const { data: { session } } = await supabase.auth.getSession();
if (session?.aal === 'aal2') {
  // MFA verified, grant access
}
```

### Recovery Code Verification
```typescript
// 1. User enters recovery code
// 2. Hash the code and check against database
const hashedCode = await hashRecoveryCode(userCode);

const { data: recoveryCode } = await supabase
  .from('recovery_codes')
  .select('*')
  .eq('user_id', userId)
  .eq('code_hash', hashedCode)
  .eq('used', false)
  .maybeSingle();

// 3. If valid, mark as used and grant access
if (recoveryCode) {
  await supabase
    .from('recovery_codes')
    .update({ used: true, used_at: new Date().toISOString() })
    .eq('id', recoveryCode.id);

  // Grant access and prompt to set up new MFA
}
```

### Trusted Device Management
```typescript
// Store device fingerprint in profiles.trusted_devices
const deviceFingerprint = {
  id: crypto.randomUUID(),
  name: navigator.userAgent,
  added_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  ip_address: 'xxx.xxx.xxx.xxx', // From request
  last_used: new Date().toISOString()
};

// Store in localStorage for client-side check
localStorage.setItem('device_id', deviceFingerprint.id);

// During login, check if device is trusted
const trustedDevices = profile.trusted_devices || [];
const currentDeviceId = localStorage.getItem('device_id');
const trustedDevice = trustedDevices.find(d =>
  d.id === currentDeviceId &&
  new Date(d.expires_at) > new Date()
);

if (trustedDevice) {
  // Skip MFA verification
} else {
  // Require MFA verification
}
```

---

## 📱 User Experience Flows

### First-Time MFA Setup
1. User goes to Settings → Security
2. Sees "Two-Factor Authentication: Disabled"
3. Clicks "Enable Two-Factor Authentication"
4. **Step 1:** Welcome screen explaining benefits
5. **Step 2:** QR code displayed
   - "Scan with your authenticator app"
   - Manual entry option shown below
   - Secret key visible for manual entry
6. **Step 3:** Verification
   - "Enter the 6-digit code from your app"
   - Code input with auto-format (3-3 format)
7. **Step 4:** Recovery codes
   - 10 codes displayed in grid
   - "Download codes" button
   - "Copy all" button
   - "Print codes" button
   - Checkbox: "I have saved these codes in a safe place"
   - Cannot proceed without checking box
8. Success message: "Two-Factor Authentication Enabled!"
9. Redirects to settings with MFA status = Enabled

### Login with MFA Enabled
1. User enters email and password
2. System checks if MFA is enabled for user
3. If enabled:
   - Redirect to MFA verification page
   - Show: "Enter your authentication code"
   - Input field for 6-digit code
   - Link: "Use a recovery code instead"
   - Checkbox: "Trust this device for 30 days"
4. User enters TOTP code from app
5. System verifies code
6. If valid: Access granted (aal2)
7. If invalid: Error message, allow retry (max 5 attempts)

### Using Recovery Code
1. User clicks "Use a recovery code instead"
2. Interface changes to text input
3. "Enter one of your recovery codes"
4. User pastes/types code
5. System validates and marks code as used
6. Access granted
7. Warning banner: "You used a recovery code. Please set up MFA again or generate new recovery codes."

### Disabling MFA
1. User goes to Settings → Security
2. MFA status shows "Enabled"
3. Clicks "Disable Two-Factor Authentication"
4. Modal appears: "Are you sure?"
   - Warning text about reduced security
   - Requires password confirmation
   - Requires current TOTP code
5. User confirms with password + code
6. MFA disabled, all recovery codes invalidated
7. All trusted devices cleared
8. Success message: "Two-Factor Authentication Disabled"

### Managing Recovery Codes
1. User goes to Settings → Security → Manage MFA
2. Section: "Recovery Codes"
3. Shows: "X of 10 codes remaining"
4. Button: "View Recovery Codes"
5. Requires password confirmation
6. Shows list of codes with status (used/unused)
7. Button: "Generate New Recovery Codes"
8. Warning: "This will invalidate all existing codes"
9. New codes generated and displayed (one-time view)

---

## 🔧 Technical Implementation Details

### Files to Create

1. **`src/components/settings/MFASetup.tsx`**
   - Multi-step wizard component
   - QR code generation (use `qrcode` library)
   - Recovery code generation

2. **`src/components/settings/MFAManagement.tsx`**
   - Status display
   - Enable/disable controls
   - Recovery code management
   - Trusted device list

3. **`src/components/auth/MFAVerification.tsx`**
   - TOTP code input
   - Recovery code input
   - Trust device option

4. **`src/components/settings/RecoveryCodesDisplay.tsx`**
   - Code grid display
   - Download/copy/print functions

5. **`src/lib/mfaUtils.ts`**
   - Recovery code generation
   - Code hashing (bcrypt)
   - Device fingerprinting
   - Helper functions

6. **`src/hooks/useMFA.ts`**
   - MFA state management
   - Enrollment functions
   - Verification functions

### Dependencies to Install
```json
{
  "qrcode": "^1.5.3",
  "bcryptjs": "^2.4.3",
  "@types/qrcode": "^1.5.5",
  "@types/bcryptjs": "^2.4.6"
}
```

### Key Functions

**Recovery Code Generation:**
```typescript
export function generateRecoveryCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = Array.from({ length: 8 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
    ).join('');
    codes.push(code);
  }
  return codes;
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(code.toUpperCase(), 10);
}

export async function verifyRecoveryCode(
  code: string,
  hash: string
): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(code.toUpperCase(), hash);
}
```

**Device Fingerprinting:**
```typescript
export function generateDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency,
    navigator.deviceMemory,
  ];

  // Simple hash (in production, use better fingerprinting)
  return btoa(components.join('|'));
}
```

---

## 🧪 Testing Checklist

### Setup Flow Testing
- [ ] QR code generates correctly
- [ ] Manual entry secret matches QR code
- [ ] Invalid verification code rejected
- [ ] Valid verification code accepted
- [ ] Recovery codes display correctly
- [ ] Recovery codes can be downloaded
- [ ] Recovery codes can be copied
- [ ] Cannot complete setup without saving codes
- [ ] MFA status updates after setup
- [ ] Audit log records MFA enable event

### Login Flow Testing
- [ ] Non-MFA users bypass verification
- [ ] MFA users prompted for code
- [ ] Valid TOTP code grants access
- [ ] Invalid TOTP code rejected with error
- [ ] Rate limiting after 5 failed attempts
- [ ] Recovery code works correctly
- [ ] Recovery code marked as used
- [ ] Trusted device skips MFA (if checked)
- [ ] Trusted device expires after 30 days
- [ ] Session has aal2 after MFA verification

### Management Flow Testing
- [ ] MFA status displays correctly
- [ ] Disable requires password + code
- [ ] Disable invalidates recovery codes
- [ ] Disable clears trusted devices
- [ ] Recovery code count accurate
- [ ] New recovery codes invalidate old ones
- [ ] Trusted devices list shows all devices
- [ ] Can remove individual trusted devices
- [ ] Audit logs all MFA changes

### Edge Cases
- [ ] User loses authenticator app → recovery code works
- [ ] All recovery codes used → must disable and re-enable
- [ ] Browser clears localStorage → device no longer trusted
- [ ] Multiple tabs open → MFA state syncs
- [ ] User switches devices → MFA required
- [ ] Network failure during setup → graceful error
- [ ] Invalid QR code → show error message

---

## 📊 Success Metrics

### Security Metrics
- MFA adoption rate (target: 30% within 3 months)
- Successful MFA verifications vs failures
- Recovery code usage rate
- Account takeover attempts prevented

### User Experience Metrics
- MFA setup completion rate (target: >90%)
- Average setup time (target: <2 minutes)
- Support tickets related to MFA (target: <5% of users)
- MFA-related login failures (target: <2%)

### Performance Metrics
- QR code generation time (target: <500ms)
- TOTP verification time (target: <200ms)
- Recovery code lookup time (target: <100ms)

---

## 🚀 Rollout Plan

### Phase 1: Core Implementation (Days 1-3)
- Create database migration
- Build MFA setup wizard
- Implement TOTP verification
- Generate and store recovery codes
- Basic testing

### Phase 2: Polish & Testing (Day 4)
- Add trusted device management
- Improve error handling
- Comprehensive testing
- Fix bugs

### Phase 3: Integration & Documentation (Day 5)
- Integrate with settings page
- Update user documentation
- Create admin documentation
- Final testing

### Phase 4: Optional Enhancements (Future)
- SMS/WhatsApp MFA
- Enforce MFA for specific roles
- MFA analytics dashboard
- Advanced fingerprinting

---

## 🔒 Security Considerations

### Best Practices
1. **Never store recovery codes in plain text** - Always hash
2. **Rate limit MFA attempts** - Max 5 failures, then lock
3. **Expire recovery codes** - 1 year default
4. **Audit all MFA events** - Enable, disable, verification
5. **Secure QR code generation** - Server-side only
6. **Clear sensitive data** - Remove from memory after use
7. **Use HTTPS only** - Never transmit codes over HTTP

### Compliance
- **SOC 2 Type II:** MFA required for sensitive data access
- **GDPR:** User can export/delete MFA data
- **PCI DSS:** MFA for payment-related access
- **ISO 27001:** MFA as part of access control

---

## 📚 User Documentation (To Be Created)

### Help Articles Needed
1. "How to Enable Two-Factor Authentication"
2. "Choosing an Authenticator App"
3. "What to Do If You Lose Your Authenticator App"
4. "How to Use Recovery Codes"
5. "Managing Trusted Devices"
6. "How to Disable Two-Factor Authentication"

### FAQ
- Q: What happens if I lose my phone?
  A: Use one of your recovery codes to log in, then set up MFA on your new device.

- Q: Can I use multiple devices?
  A: Yes! The same TOTP secret works on multiple devices.

- Q: Do recovery codes expire?
  A: Yes, after 1 year. Generate new ones periodically.

- Q: Can I trust multiple devices?
  A: Yes, each device can be trusted independently for 30 days.

---

## 🎯 Next Steps

1. **Review and approve this plan**
2. **Answer configuration questions:**
   - Optional or mandatory MFA? (Recommend: Optional)
   - Trust device duration? (Recommend: 30 days)
   - Recovery code count? (Recommend: 10 codes)
   - Enforce for roles? (Recommend: Not initially)
3. **Begin implementation**
4. **Review progress after each phase**

---

## 📝 Open Questions

1. Should system admins be required to use MFA? (Recommend: Yes)
2. Should we send email notification when MFA is enabled/disabled? (Recommend: Yes)
3. Should we support multiple authenticator enrollments? (Recommend: Phase 2)
4. What should happen to active sessions when MFA is disabled? (Recommend: Invalidate all)

---

**Estimated Total Effort:** 4-5 days
**Priority:** Critical (🚨)
**Business Value:** High - Required for enterprise customers and compliance
