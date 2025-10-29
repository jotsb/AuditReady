# AuditProof Application Test Workflow

This document provides a comprehensive test workflow to verify all functionality after infrastructure setup.

## 🎯 Test Overview

This workflow tests the complete application stack:
- ✅ User authentication and authorization
- ✅ Receipt upload and management
- ✅ Multi-page receipt handling
- ✅ Storage bucket access
- ✅ Database operations and RLS
- ✅ Edge functions
- ✅ Admin functionality
- ✅ Team management
- ✅ Email integration (if configured)

**Estimated Time**: 30-45 minutes

---

## Prerequisites

Before starting tests:

1. Infrastructure setup completed successfully
2. All services running: `docker compose ps` (in supabase-project/)
3. Frontend accessible at: https://test.auditproof.ca
4. Admin credentials available in: `/mnt/user/appdata/auditproof/secrets.txt`

---

## Phase 1: Authentication & User Management

### Test 1.1: Admin User Login

**Objective**: Verify admin user was created correctly

**Steps**:
1. Navigate to https://test.auditproof.ca
2. Click "Login"
3. Enter admin credentials from `secrets.txt`:
   - Email: `admin@test.auditproof.ca`
   - Password: (from secrets.txt)
4. Click "Sign In"

**Expected Results**:
- ✅ Successful login
- ✅ Redirected to dashboard
- ✅ User profile shows "System Administrator" role
- ✅ Admin menu items visible (Admin, System Logs, etc.)

**If Failed**:
- Check database: `docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT email, role FROM auth.users;"`
- Review logs: `docker logs supabase-auth`
- Verify .env has correct keys

---

### Test 1.2: New User Signup

**Objective**: Verify user registration flow works

**Steps**:
1. Logout from admin account
2. Click "Sign Up"
3. Enter test user details:
   - Email: `test1@example.com`
   - Password: `TestUser123!`
   - Full Name: `Test User One`
4. Click "Create Account"

**Expected Results**:
- ✅ Account created successfully
- ✅ User logged in automatically (if email autoconfirm is enabled)
- ✅ Redirected to dashboard
- ✅ No CSP errors in browser console
- ✅ Profile created in database

**If Failed**:
- Check browser console for CSP errors
- Verify nginx.conf has correct CSP headers
- Check auth logs: `docker logs supabase-auth`

---

### Test 1.3: Password Reset Flow

**Objective**: Verify password recovery works

**Steps**:
1. Logout
2. Click "Forgot Password"
3. Enter: `test1@example.com`
4. Click "Send Reset Link"

**Expected Results**:
- ✅ Success message displayed
- ✅ If SMTP configured: Email received
- ✅ If SMTP not configured: Check logs for reset token
- ✅ No errors in console

**Note**: If SMTP not configured, this test validates the flow but won't send email.

---

## Phase 2: Business & Team Setup

### Test 2.1: Create Business

**Objective**: Verify business creation and ownership

**Steps**:
1. Login as `test1@example.com`
2. Go to Settings → Business Management
3. Click "Create Business"
4. Enter:
   - Business Name: `Test Company LLC`
   - Industry: `Technology`
5. Click "Create"

**Expected Results**:
- ✅ Business created successfully
- ✅ User is business owner
- ✅ Business appears in dropdown
- ✅ Can switch to business context

**If Failed**:
- Check database: `SELECT * FROM businesses WHERE name = 'Test Company LLC';`
- Check RLS policies: `docker logs supabase-db`

---

### Test 2.2: Invite Team Member

**Objective**: Verify team invitation system

**Steps**:
1. As business owner, go to Team Management
2. Click "Invite Member"
3. Enter:
   - Email: `test2@example.com`
   - Role: `member`
4. Click "Send Invitation"

**Expected Results**:
- ✅ Invitation created
- ✅ Invitation appears in pending list
- ✅ If SMTP configured: Email sent
- ✅ Edge function executed successfully

**Verification**:
```sql
-- Check invitation in database
docker exec -i supabase-db psql -U postgres -d postgres << SQL
SELECT * FROM invitations WHERE email = 'test2@example.com';
SQL
```

---

### Test 2.3: Accept Invitation

**Objective**: Verify invitation acceptance flow

**Steps**:
1. Signup as `test2@example.com` / `TestUser123!`
2. Check for invitation notification
3. Go to Team page
4. Click "Accept" on invitation
5. Select business from dropdown

**Expected Results**:
- ✅ Invitation accepted
- ✅ User added to team
- ✅ Can access business data
- ✅ Role-based permissions applied

---

## Phase 3: Receipt Management

### Test 3.1: Upload Single Receipt

**Objective**: Verify receipt upload and storage

**Steps**:
1. Go to Receipts page
2. Click "Upload Receipt"
3. Choose a receipt image (JPG/PNG)
4. Fill in details:
   - Vendor: `Acme Corp`
   - Amount: `$125.50`
   - Date: Today's date
   - Category: `Office Supplies`
5. Click "Save"

**Expected Results**:
- ✅ Receipt uploaded to storage bucket
- ✅ Thumbnail generated
- ✅ Receipt appears in list
- ✅ Metadata saved correctly
- ✅ Image accessible via storage URL

**Verification**:
```sql
-- Check receipt in database
docker exec -i supabase-db psql -U postgres -d postgres << SQL
SELECT id, vendor, amount, storage_path FROM receipts ORDER BY created_at DESC LIMIT 1;
SQL
```

---

### Test 3.2: Upload Multi-Page Receipt

**Objective**: Verify multi-page receipt handling

**Steps**:
1. Click "Upload Receipt"
2. Click "Multi-Page Upload"
3. Upload 3 images (representing pages)
4. Verify all pages shown in preview
5. Fill in details and save

**Expected Results**:
- ✅ All pages uploaded
- ✅ Linked as single receipt
- ✅ Can navigate between pages
- ✅ All pages stored in bucket
- ✅ Proper page ordering

---

### Test 3.3: Camera Capture Receipt

**Objective**: Verify camera capture functionality

**Steps**:
1. Click "Camera Capture"
2. Allow camera permissions
3. Capture receipt image
4. Review and confirm
5. Fill in details and save

**Expected Results**:
- ✅ Camera permission requested
- ✅ Image captured successfully
- ✅ Preview shown correctly
- ✅ Image uploaded to storage
- ✅ Receipt created

---

### Test 3.4: OCR Data Extraction

**Objective**: Verify OpenAI integration for OCR

**Steps**:
1. Upload a clear receipt image
2. Wait for OCR processing
3. Verify extracted data:
   - Vendor name
   - Amount
   - Date
   - Items (if detailed)

**Expected Results**:
- ✅ Edge function triggered
- ✅ OpenAI API called
- ✅ Data extracted accurately
- ✅ Fields pre-filled
- ✅ User can review/edit

**If Failed**:
- Check OpenAI API key in .env
- Check edge function logs: `docker logs supabase-functions`
- Verify edge function deployed: `ls -la /mnt/user/appdata/auditproof/supabase-project/volumes/functions/`

---

### Test 3.5: Receipt Search and Filter

**Objective**: Verify search and filtering

**Steps**:
1. Upload multiple receipts with different:
   - Vendors
   - Categories
   - Dates
   - Amounts
2. Test filters:
   - Search by vendor
   - Filter by category
   - Filter by date range
   - Filter by amount range
3. Save filter as preset

**Expected Results**:
- ✅ Search returns correct results
- ✅ Filters work independently
- ✅ Combined filters work
- ✅ Filter presets save/load
- ✅ Results update in real-time

---

## Phase 4: Collections & Organization

### Test 4.1: Create Collection

**Objective**: Verify collection management

**Steps**:
1. Go to Collections page
2. Click "Create Collection"
3. Enter:
   - Name: `Q1 2024 Expenses`
   - Description: `First quarter business expenses`
4. Click "Create"

**Expected Results**:
- ✅ Collection created
- ✅ Appears in list
- ✅ Can be selected
- ✅ Initially empty

---

### Test 4.2: Add Receipts to Collection

**Objective**: Verify receipt organization

**Steps**:
1. Go to Receipts page
2. Select multiple receipts (checkbox)
3. Click "Add to Collection"
4. Choose `Q1 2024 Expenses`
5. Confirm

**Expected Results**:
- ✅ Receipts added to collection
- ✅ Collection count updated
- ✅ Can view receipts in collection
- ✅ Can remove from collection

---

### Test 4.3: Bulk Operations

**Objective**: Verify bulk actions

**Steps**:
1. Select multiple receipts
2. Test bulk operations:
   - Change category
   - Add to collection
   - Delete (soft delete)
3. Verify changes applied

**Expected Results**:
- ✅ All selected receipts updated
- ✅ Changes reflected immediately
- ✅ Audit log entries created
- ✅ Can undo deletion

---

## Phase 5: Reporting & Export

### Test 5.1: Generate PDF Report

**Objective**: Verify PDF generation

**Steps**:
1. Go to Reports page
2. Select date range
3. Choose report type: `Expense Summary`
4. Click "Generate PDF"

**Expected Results**:
- ✅ PDF generated successfully
- ✅ Contains correct data
- ✅ Properly formatted
- ✅ Downloads to browser
- ✅ Includes receipt images

---

### Test 5.2: Export to CSV

**Objective**: Verify CSV export

**Steps**:
1. Select receipts to export
2. Click "Export CSV"
3. Download file
4. Open in spreadsheet

**Expected Results**:
- ✅ CSV file downloads
- ✅ All fields included
- ✅ Proper formatting
- ✅ Opens correctly
- ✅ Data matches UI

---

### Test 5.3: Tax Summary Report

**Objective**: Verify tax reporting

**Steps**:
1. Go to Reports → Tax Summary
2. Select tax year
3. Generate report

**Expected Results**:
- ✅ Categorized by tax category
- ✅ Totals calculated correctly
- ✅ Includes deductible amounts
- ✅ Can export for accountant

---

## Phase 6: Admin Functions

### Test 6.1: User Management (Admin)

**Objective**: Verify admin user management

**Steps**:
1. Login as admin
2. Go to Admin → User Management
3. Test:
   - View all users
   - View user details
   - Suspend user
   - Reactivate user
   - Reset MFA

**Expected Results**:
- ✅ Can view all users
- ✅ Can modify user status
- ✅ Can reset security
- ✅ Audit logs created
- ✅ Users notified (if SMTP configured)

---

### Test 6.2: System Health Monitoring

**Objective**: Verify health monitoring

**Steps**:
1. Go to Admin → System Health
2. Check:
   - Database status
   - Storage usage
   - Service health
   - Error rates

**Expected Results**:
- ✅ All services show healthy
- ✅ Metrics displayed correctly
- ✅ Storage usage shown
- ✅ Alerts if issues

---

### Test 6.3: Audit Log Review

**Objective**: Verify audit logging

**Steps**:
1. Go to Admin → Audit Logs
2. Filter by:
   - User
   - Action type
   - Date range
3. Review log entries
4. Export logs

**Expected Results**:
- ✅ All actions logged
- ✅ Complete details captured
- ✅ Filters work correctly
- ✅ Can export logs
- ✅ Proper retention applied

---

## Phase 7: Security Testing

### Test 7.1: Row Level Security

**Objective**: Verify RLS policies work

**Steps**:
1. As `test1@example.com`, upload receipt
2. Logout and login as `test2@example.com`
3. Try to access test1's receipt directly
4. Verify can only see own/team receipts

**Expected Results**:
- ✅ Cannot access other user's data
- ✅ Can access team data if member
- ✅ Proper error messages
- ✅ No data leakage

**Manual Verification**:
```sql
-- Try to access as different user
docker exec -i supabase-db psql -U postgres -d postgres << SQL
SET request.jwt.claim.sub = '<test2_user_id>';
SELECT * FROM receipts WHERE user_id != '<test2_user_id>';
-- Should return no rows
SQL
```

---

### Test 7.2: Storage Security

**Objective**: Verify storage bucket security

**Steps**:
1. Upload receipt as test1
2. Copy storage URL
3. Logout
4. Try to access URL without auth
5. Try to access with different user

**Expected Results**:
- ✅ Cannot access without auth
- ✅ Cannot access other user's files
- ✅ Proper 403/401 errors
- ✅ RLS enforced on storage

---

### Test 7.3: API Rate Limiting

**Objective**: Verify rate limiting works

**Steps**:
1. Make rapid API requests (use browser console):
```javascript
for(let i=0; i<100; i++) {
  fetch('/rest/v1/receipts');
}
```

**Expected Results**:
- ✅ Rate limit triggered
- ✅ 429 Too Many Requests returned
- ✅ Retry-After header present
- ✅ Normal operation resumes after cooldown

---

## Phase 8: Edge Functions

### Test 8.1: Receipt OCR Function

**Objective**: Verify extract-receipt-data function

**Steps**:
1. Upload receipt image
2. Trigger OCR
3. Monitor function execution

**Expected Results**:
- ✅ Function invoked
- ✅ OpenAI API called
- ✅ Data extracted
- ✅ Response returned
- ✅ Under 10 seconds

**Logs Check**:
```bash
docker logs supabase-functions | grep extract-receipt-data
```

---

### Test 8.2: Email Invitation Function

**Objective**: Verify send-invitation-email function

**Steps**:
1. Send team invitation
2. Check function logs
3. Verify email sent (if SMTP configured)

**Expected Results**:
- ✅ Function triggered
- ✅ Email formatted correctly
- ✅ Invitation link included
- ✅ No errors

---

## Phase 9: Performance Testing

### Test 9.1: Large Receipt Upload

**Objective**: Test file size limits

**Steps**:
1. Upload receipt near 50MB limit
2. Upload multiple receipts in sequence
3. Monitor upload speed

**Expected Results**:
- ✅ Large files accepted
- ✅ Upload completes successfully
- ✅ No timeout errors
- ✅ Reasonable speed

---

### Test 9.2: Receipt List Performance

**Objective**: Test pagination and rendering

**Steps**:
1. Upload 100+ receipts
2. Scroll through list
3. Test filters with large dataset

**Expected Results**:
- ✅ Smooth scrolling
- ✅ Fast filtering
- ✅ Proper pagination
- ✅ No memory leaks
- ✅ Under 2 seconds per page

---

## Phase 10: Mobile Responsiveness

### Test 10.1: Mobile Layout

**Objective**: Verify responsive design

**Steps**:
1. Open on mobile device or browser dev tools
2. Test at various breakpoints:
   - 320px (mobile)
   - 768px (tablet)
   - 1024px (desktop)
3. Verify all pages

**Expected Results**:
- ✅ Layout adapts correctly
- ✅ All features accessible
- ✅ Touch targets adequate
- ✅ No horizontal scroll
- ✅ Images scale properly

---

## Issue Tracking Template

Use this template to track any issues found:

```markdown
### Issue #X: [Brief Description]

**Test**: [Test ID, e.g., Test 3.1]
**Severity**: Critical / High / Medium / Low
**Steps to Reproduce**:
1. 
2. 
3. 

**Expected**: 
**Actual**: 
**Screenshots**: 
**Logs**: 
**Environment**: 
```

---

## Test Results Summary

After completing all tests, fill out this summary:

### Phase 1: Authentication __ / 3 Passed
### Phase 2: Business & Teams __ / 3 Passed
### Phase 3: Receipts __ / 5 Passed
### Phase 4: Collections __ / 3 Passed
### Phase 5: Reporting __ / 3 Passed
### Phase 6: Admin __ / 3 Passed
### Phase 7: Security __ / 3 Passed
### Phase 8: Functions __ / 2 Passed
### Phase 9: Performance __ / 2 Passed
### Phase 10: Mobile __ / 1 Passed

**Total**: __ / 28 Tests Passed

---

## Critical Paths

These tests MUST pass before production:

1. ✅ User signup and login
2. ✅ Receipt upload and storage
3. ✅ RLS security
4. ✅ Team invitations
5. ✅ Data export

---

## Useful Commands

### Check Service Health
```bash
cd /mnt/user/appdata/auditproof/supabase-project
docker compose ps
docker compose logs [service]
```

### Check Database
```bash
docker exec -it supabase-db psql -U postgres -d postgres
```

### View Edge Function Logs
```bash
docker logs -f supabase-functions
```

### Check Storage
```bash
docker exec supabase-db psql -U postgres -d postgres -c "SELECT * FROM storage.objects LIMIT 10;"
```

### Monitor Kong Gateway
```bash
docker logs -f supabase-kong
```

---

## Success Criteria

The application is ready for production when:

- ✅ All critical tests pass
- ✅ No security vulnerabilities found
- ✅ Performance meets requirements
- ✅ All edge functions working
- ✅ Backups configured
- ✅ Monitoring in place
- ✅ Documentation complete

---

**Test Completion Date**: _____________
**Tester**: _____________
**Overall Status**: PASS / FAIL / NEEDS REVIEW
**Notes**: 
