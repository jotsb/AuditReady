/*
  # Denormalize business_id on audit_logs and optimize RLS policies

  1. Schema Changes
    - Add `business_id` (uuid, nullable) column to `audit_logs` table
    - Add foreign key constraint to `businesses(id)` with ON DELETE SET NULL
    - Temporarily disable immutability trigger for backfill
    - Backfill `business_id` from `details->>'business_id'` only for valid business references
    - Re-enable immutability trigger after backfill
    - Add composite index on `(business_id, created_at DESC)`

  2. RLS Policy Changes
    - Replace slow JSONB-extracting policy with indexed column lookup
    - New policy uses denormalized `business_id` column directly

  3. Index Changes
    - Remove redundant `idx_audit_logs_created_at` (duplicate of `idx_audit_logs_timestamp`)
    - Add composite index on `business_members(user_id, business_id)`

  4. Performance Impact
    - Eliminates per-row JSONB text extraction in RLS evaluation
    - Enables index scans for business-scoped audit log queries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN business_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'audit_logs_business_id_fkey'
  ) THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE audit_logs DISABLE TRIGGER prevent_audit_log_updates;

UPDATE audit_logs
SET business_id = (details->>'business_id')::uuid
WHERE business_id IS NULL
  AND details->>'business_id' IS NOT NULL
  AND details->>'business_id' != ''
  AND EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = (audit_logs.details->>'business_id')::uuid
  );

ALTER TABLE audit_logs ENABLE TRIGGER prevent_audit_log_updates;

CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id_created
  ON audit_logs (business_id, created_at DESC)
  WHERE business_id IS NOT NULL;

DROP POLICY IF EXISTS "Business owners and managers can view team audit logs" ON audit_logs;

CREATE POLICY "Business owners and managers can view team audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    audit_logs.business_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = audit_logs.business_id
        AND (
          b.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM business_members bm
            WHERE bm.business_id = b.id
              AND bm.user_id = auth.uid()
              AND bm.role IN ('manager', 'owner')
          )
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_business_members_user_business
  ON business_members (user_id, business_id);

DROP INDEX IF EXISTS idx_audit_logs_created_at;
