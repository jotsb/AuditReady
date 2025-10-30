# Database Entity Relationships

## Core Entity Relationship Diagram

```
┌──────────────┐
│  auth.users  │ (Supabase Auth)
└──────┬───────┘
       │ 1:1
       ▼
┌──────────────┐
│   profiles   │ ◄───────┐
└──────┬───────┘         │
       │ 1:N             │ references
       ▼                 │
┌──────────────┐         │
│  businesses  │         │
└──────┬───────┘         │
       │ 1:N             │
       ▼                 │
┌──────────────┐         │
│  collections │         │
└──────┬───────┘         │
       │                 │
       ├─────────────────┘
       │ 1:N
       ├────────┐
       │        │
       ▼        ▼
┌──────────┐ ┌────────────────┐
│ receipts │ │ collection_    │
└──────────┘ │   members      │
             └────────┬───────┘
                      │
                      └──────► profiles (user_id)
```

## Detailed Relationships

### User & Profile Management

```
auth.users (Supabase)
  └─► profiles (1:1)
      ├─► businesses (1:N via owner_id)
      ├─► collection_members (1:N via user_id)
      ├─► receipts (1:N via uploaded_by)
      ├─► audit_logs (1:N via user_id)
      └─► system_logs (1:N via user_id)
```

### Business Hierarchy

```
businesses
  ├─► collections (1:N)
  ├─► business_members (1:N)
  ├─► invitations (1:N)
  └─► expense_categories (1:N per business or global)
```

### Collections & Receipts

```
collections
  ├─► receipts (1:N)
  ├─► collection_members (1:N)
  └─► export_jobs (1:N)
```

### Security & Auditing

```
profiles
  ├─► audit_logs (1:N) - all user actions
  ├─► system_logs (1:N) - system events
  ├─► security_events (1:N) - security incidents
  ├─► failed_login_attempts (1:N)
  ├─► account_lockouts (1:N)
  └─► recovery_codes (1:N)
```

### Multi-Factor Authentication

```
profiles
  ├─► recovery_codes (1:N)
  │   └─► used recovery codes are tracked
  └─► mfa_failed_attempts (1:N)
      └─► triggers account lockout
```

### Receipt Processing

```
receipts
  ├─► receipt_approvals (1:N) - approval workflow
  ├─► potential_duplicates (N:N via receipt1_id, receipt2_id)
  └─► email_receipts_inbox (1:1 via email_message_id)
```

## Foreign Key Relationships

### Critical Cascade Deletes

- **auth.users → profiles**: CASCADE (delete profile when user deleted)
- **profiles → businesses**: CASCADE (delete businesses owned by user)
- **businesses → collections**: RESTRICT (prevent if collections exist)
- **collections → receipts**: CASCADE (delete receipts with collection)
- **profiles → receipts**: CASCADE (delete receipts uploaded by user)

### Set NULL on Delete

- **profiles → audit_logs**: SET NULL (preserve logs even if user deleted)
- **profiles → system_logs**: SET NULL (preserve logs)
- **profiles → system_roles**: CASCADE (remove admin roles)

## Membership & Access Control

### Business Access

```
profiles ─► business_members ◄─ businesses
           (N:N relationship)
           roles: owner, admin, manager, member, viewer
```

### Collection Access

```
profiles ─► collection_members ◄─ collections
           (N:N relationship)
           roles: admin, submitter, viewer
```

## Key Tables by Category

### Core Application Tables
1. **profiles** - User data
2. **businesses** - Organizations
3. **collections** - Receipt folders
4. **receipts** - Main entity
5. **expense_categories** - Classification

### Access Control
6. **system_roles** - System admins
7. **business_members** - Business access
8. **collection_members** - Collection access

### Security
9. **audit_logs** - Action history
10. **system_logs** - System events
11. **security_events** - Security incidents
12. **failed_login_attempts** - Login tracking
13. **account_lockouts** - Account protection
14. **blocked_ips** - IP banning

### Rate Limiting
15. **rate_limit_config** - Rate limit rules
16. **rate_limit_attempts** - Rate limit tracking
17. **user_rate_limit_overrides** - Custom limits

### MFA & Authentication
18. **recovery_codes** - MFA backup codes
19. **mfa_failed_attempts** - MFA failure tracking
20. **invitations** - User invitations

### Features
21. **export_jobs** - Export processing
22. **email_receipts_inbox** - Email forwarding
23. **receipt_approvals** - Approval workflow
24. **saved_filters** - User preferences
25. **saved_audit_filters** - Audit filters
26. **saved_system_filters** - System log filters

### System Management
27. **system_config** - Configuration
28. **system_health_metrics** - Monitoring
29. **dashboard_analytics** - Analytics
30. **database_queries_log** - Query logging
31. **cleanup_jobs** - Cleanup tasks
32. **log_level_config** - Logging config

### Advanced Features
33. **potential_duplicates** - Duplicate detection
34. **detected_anomalies** - Anomaly detection
35. **user_activity_patterns** - Behavior tracking
36. **signed_url_requests** - URL tracking
37. **admin_impersonation_sessions** - Admin actions

## Index Strategy

### Primary Indexes
- All tables have UUID primary keys
- Foreign keys are automatically indexed

### Performance Indexes
- `receipts`: transaction_date, category, collection_id
- `audit_logs`: user_id, created_at, action
- `collection_members`: collection_id, user_id
- `businesses`: owner_id

### Full-Text Search
- Uses `pg_trgm` extension for similarity matching
- Applied to vendor_name, notes, category fields

## RLS Policy Patterns

### Read Policies
- Users can read their own data
- Business members can read business data
- Collection members can read collection receipts

### Write Policies
- Users can create their own data
- Admins can modify owned resources
- Collection submitters can create receipts
- Collection admins can modify collections

### Delete Policies
- Owners can delete businesses
- Admins can delete collections
- Most deletes are soft-deletes (marked deleted_at)

## Audit Trail

Every action is logged with:
- User ID
- Action type (create, update, delete, view)
- Resource type and ID
- Before/after values (for updates)
- IP address and user agent
- Timestamp

Audit logs are:
- Immutable (no updates or deletes)
- Automatically triggered via triggers
- Queryable with advanced filters
- Retained indefinitely (or per retention policy)
