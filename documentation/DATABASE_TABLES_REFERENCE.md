# Database Tables Quick Reference

Total Tables: 37

---

## account_lockouts

| Column | Type |
|--------|------|
| id | uuid |
| email | text |
| locked_at | timestamptz |
| locked_until | timestamptz |
| locked_by_ip | inet |
| attempts_count | integer |
| is_active | boolean |
| unlock_reason | text |
| unlocked_at | timestamptz |
| unlocked_by | uuid |

---

## admin_impersonation_sessions

| Column | Type |
|--------|------|
| id | uuid |
| admin_id | uuid |
| target_user_id | uuid |
| reason | text |
| started_at | timestamptz |
| ended_at | timestamptz |
| actions_performed | jsonb |
| ip_address | inet |

---

## audit_logs

| Column | Type |
|--------|------|
| id | uuid |
| user_id | uuid |
| action | text |
| resource_type | text |
| resource_id | uuid |
| details | jsonb |
| created_at | timestamptz |

---

## blocked_ips

| Column | Type |
|--------|------|
| id | uuid |
| reason | text |
| blocked_by | uuid |
| blocked_until | timestamptz |
| metadata | jsonb |
| created_at | timestamptz |

---

## business_members

| Column | Type |
|--------|------|
| id | uuid |
| business_id | uuid |
| user_id | uuid |
| role | business_role_type |
| invited_by | uuid |
| joined_at | timestamptz |
| created_at | timestamptz |

---

## businesses

| Column | Type |
|--------|------|
| id | uuid |
| owner_id | uuid |
| name | text |
| tax_id | text |
| currency | text |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## cleanup_jobs

| Column | Type |
|--------|------|
| id | uuid |
| items_found | integer |
| items_processed | integer |
| items_deleted | integer |
| total_size_bytes | bigint |
| deleted_size_bytes | bigint |
| scan_results | jsonb |
| error_message | text |
| started_by | uuid |
| started_at | timestamptz |
| completed_at | timestamptz |
| created_at | timestamptz |

---

## collection_members

| Column | Type |
|--------|------|
| id | uuid |
| collection_id | uuid |
| user_id | uuid |
| invited_by | uuid |
| created_at | timestamptz |

---

## collections

| Column | Type |
|--------|------|
| id | uuid |
| business_id | uuid |
| name | text |
| description | text |
| year | integer |
| created_by | uuid |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## dashboard_analytics

| Column | Type |
|--------|------|
| id | uuid |
| business_id | uuid |
| user_id | uuid |
| total_expenses | numeric |
| receipt_count | integer |
| monthly_total | numeric |
| tax_total | numeric |
| category_breakdown | jsonb |
| last_calculated_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## database_queries_log

| Column | Type |
|--------|------|
| id | uuid |
| admin_id | uuid |
| query_text | text |
| rows_affected | integer |
| execution_time_ms | integer |
| executed_at | timestamptz |
| error_message | text |
| success | boolean |

---

## detected_anomalies

| Column | Type |
|--------|------|
| id | uuid |
| user_id | uuid |
| anomaly_type | text |
| description | text |
| ip_address | inet |
| user_agent | text |
| detected_at | timestamptz |
| reviewed | boolean |
| reviewed_by | uuid |
| reviewed_at | timestamptz |
| false_positive | boolean |
| metadata | jsonb |

---

## email_receipts_inbox

| Column | Type |
|--------|------|
| id | UUID |
| business_id | UUID |
| message_id | TEXT |
| from_email | TEXT |
| from_name | TEXT |
| to_email | TEXT |
| subject | TEXT |
| received_at | TIMESTAMPTZ |
| raw_email_data | JSONB |
| receipt_id | UUID |
| attachments_count | INTEGER |
| error_message | TEXT |
| processed_at | TIMESTAMPTZ |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

---

## expense_categories

| Column | Type |
|--------|------|
| id | uuid |
| business_id | uuid |
| name | text |
| description | text |
| is_default | boolean |
| display_order | integer |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## export_jobs

| Column | Type |
|--------|------|
| id | uuid |
| business_id | uuid |
| requested_by | uuid |
| status | export_job_status |
| export_type | text |
| file_path | text |
| file_size_bytes | bigint |
| error_message | text |
| metadata | jsonb |
| started_at | timestamptz |
| completed_at | timestamptz |
| expires_at | timestamptz |
| created_at | timestamptz |

---

## failed_login_attempts

| Column | Type |
|--------|------|
| id | uuid |
| email | text |
| ip_address | inet |
| attempt_time | timestamptz |
| user_agent | text |
| failure_reason | text |
| metadata | jsonb |

---

## invitations

| Column | Type |
|--------|------|
| id | uuid |
| business_id | uuid |
| email | text |
| role | business_role_type |
| invited_by | uuid |
| status | invitation_status_type |
| expires_at | timestamptz |
| accepted_at | timestamptz |
| created_at | timestamptz |

---

## log_level_config

| Column | Type |
|--------|------|
| id | uuid |
| min_level | text |
| enabled | boolean |
| description | text |
| updated_at | timestamptz |
| updated_by | uuid |

---

## mfa_failed_attempts

| Column | Type |
|--------|------|
| id | uuid |
| user_id | uuid |
| attempted_at | timestamptz |
| ip_address | text |
| user_agent | text |
| created_at | timestamptz |

---

## potential_duplicates

| Column | Type |
|--------|------|
| id | uuid |
| receipt_id | uuid |
| duplicate_of_receipt_id | uuid |
| match_reason | text |
| reviewed_by | uuid |
| reviewed_at | timestamptz |
| created_at | timestamptz |

---

## profiles

| Column | Type |
|--------|------|
| id | uuid |
| full_name | text |
| phone_number | text |
| mfa_enabled | boolean |
| trusted_devices | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## rate_limit_attempts

| Column | Type |
|--------|------|
| id | uuid |
| identifier | text |
| attempts | integer |
| window_start | timestamptz |
| window_end | timestamptz |
| is_blocked | boolean |
| block_expires_at | timestamptz |
| metadata | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## rate_limit_config

| Column | Type |
|--------|------|
| id | uuid |
| requests_per_minute | integer |
| requests_per_hour | integer |
| requests_per_day | integer |
| enabled | boolean |
| description | text |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## receipt_approvals

| Column | Type |
|--------|------|
| id | uuid |
| status | approval_status_type |
| submitted_by | uuid |
| reviewed_by | uuid |
| reviewed_at | timestamptz |
| notes | text |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## receipts

| Column | Type |
|--------|------|
| id | uuid |
| collection_id | uuid |
| uploaded_by | uuid |
| vendor_name | text |
| vendor_address | text |
| transaction_date | timestamptz |
| subtotal | numeric(10,2) |
| gst_amount | numeric(10,2) |
| pst_amount | numeric(10,2) |
| total_amount | numeric(10,2) |
| payment_method | text |
| category | text |
| notes | text |
| file_path | text |
| file_type | text |
| extraction_data | jsonb |
| is_edited | boolean |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## recovery_codes

| Column | Type |
|--------|------|
| id | uuid |
| user_id | uuid |
| code_hash | text |
| used | boolean |
| used_at | timestamptz |
| created_at | timestamptz |
| expires_at | timestamptz |

---

## saved_audit_filters

| Column | Type |
|--------|------|
| id | uuid |
| user_id | uuid |
| name | text |
| filters | jsonb |
| is_default | boolean |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## saved_filters

| Column | Type |
|--------|------|
| id | uuid |
| user_id | uuid |
| filters | jsonb |
| is_default | boolean |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## saved_system_filters

| Column | Type |
|--------|------|
| id | uuid |
| user_id | uuid |
| name | text |
| filters | jsonb |
| is_default | boolean |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## security_events

| Column | Type |
|--------|------|
| id | uuid |
| event_type | text |
| user_id | uuid |
| ip_address | text |
| user_agent | text |
| details | jsonb |
| created_at | timestamptz |

---

## signed_url_requests

| Column | Type |
|--------|------|
| id | uuid |
| file_path | text |
| user_id | uuid |
| ip_address | inet |
| expires_at | timestamptz |
| accessed | boolean |
| access_count | integer |
| last_accessed_at | timestamptz |
| created_at | timestamptz |
| metadata | jsonb |

---

## system_config

| Column | Type |
|--------|------|
| id | uuid |
| storage_settings | jsonb |
| "max_file_size_mb": | 10 |
| "allowed_file_types": | ["image/jpeg" |
| "default_storage_quota_gb": | 10 |
| email_settings | jsonb |
| "smtp_enabled": | false |
| "email_from_name": | "Audit |
| "email_from_address": | "noreply@auditproof.com" |
| app_settings | jsonb |
| "app_name": | "Audit |
| "app_version": | "0.8.4" |
| "maintenance_mode": | false |
| feature_flags | jsonb |
| "mfa_required": | false |
| "email_verification_required": | true |
| "ai_extraction_enabled": | true |
| "multi_page_receipts_enabled": | true |
| updated_at | timestamptz |
| updated_by | uuid |

---

## system_health_metrics

| Column | Type |
|--------|------|
| id | uuid |
| metric_name | text |
| metric_value | numeric |
| metric_unit | text |
| measured_at | timestamptz |
| metadata | jsonb |

---

## system_logs

| Column | Type |
|--------|------|
| id | uuid |
| timestamp | timestamptz |
| level | text |
| category | text |
| message | text |
| metadata | jsonb |
| user_id | uuid |
| session_id | text |
| ip_address | inet |
| user_agent | text |
| stack_trace | text |
| execution_time_ms | integer |
| created_at | timestamptz |

---

## system_roles

| Column | Type |
|--------|------|
| id | uuid |
| user_id | uuid |
| role | system_role_type |
| granted_by | uuid |
| granted_at | timestamptz |
| created_at | timestamptz |

---

## user_activity_patterns

| Column | Type |
|--------|------|
| id | uuid |
| user_id | uuid |
| pattern_type | text |
| typical_time_of_day | integer[] |
| typical_days_of_week | integer[] |
| typical_locations | inet[] |
| average_frequency_per_day | numeric |
| last_updated | timestamptz |

---

## user_rate_limit_overrides

| Column | Type |
|--------|------|
| id | uuid |
| user_id | uuid |
| endpoint_pattern | text |
| requests_per_minute | integer |
| requests_per_hour | integer |
| requests_per_day | integer |
| reason | text |
| expires_at | timestamptz |
| created_by | uuid |
| created_at | timestamptz |

---

