/*
  # Add Restore Tracking to Database Backups

  1. Modified Tables
    - `database_backups`
      - Expanded `backup_type` CHECK constraint to allow 'restore' and 'pre_restore' values
      - Added `restored_from_backup_id` (uuid, nullable) - self-referencing FK to the source backup
      - Added `restore_strategy` (text, nullable) - 'merge' or 'replace'

  2. Security
    - No RLS changes needed, existing admin-only policies cover new columns

  3. Notes
    - Existing rows are unaffected (new columns are nullable)
    - 'pre_restore' type is for automatic safety snapshots created before any restore
    - 'restore' type tracks completed restore operations
*/

ALTER TABLE database_backups
  DROP CONSTRAINT IF EXISTS database_backups_backup_type_check;

ALTER TABLE database_backups
  ADD CONSTRAINT database_backups_backup_type_check
  CHECK (backup_type IN ('manual', 'scheduled', 'pre_migration', 'restore', 'pre_restore'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'database_backups' AND column_name = 'restored_from_backup_id'
  ) THEN
    ALTER TABLE database_backups
      ADD COLUMN restored_from_backup_id uuid REFERENCES database_backups(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'database_backups' AND column_name = 'restore_strategy'
  ) THEN
    ALTER TABLE database_backups
      ADD COLUMN restore_strategy text
      CHECK (restore_strategy IN ('merge', 'replace'));
  END IF;
END $$;
