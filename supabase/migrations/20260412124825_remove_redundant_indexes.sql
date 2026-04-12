/*
  # Remove redundant database indexes

  1. Dropped Indexes
    - `idx_profiles_id` - redundant with `profiles_pkey` (primary key already indexed)
    - `idx_invitations_token` - redundant with `invitations_token_key` (unique constraint already indexed)
    - `idx_receipts_parent_id` - exact duplicate of `idx_receipts_parent_receipt_id`

  2. Performance Impact
    - Reduces write overhead (fewer indexes to maintain on INSERT/UPDATE)
    - No impact on read performance since equivalent indexes remain
*/

DROP INDEX IF EXISTS idx_profiles_id;
DROP INDEX IF EXISTS idx_invitations_token;
DROP INDEX IF EXISTS idx_receipts_parent_id;
