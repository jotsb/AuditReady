/*
  # Add Heartbeat and Progress Tracking to Database Backups

  1. Modified Tables
    - `database_backups`
      - `last_heartbeat_at` (timestamptz) - Updated by Edge Function during processing to detect stalled backups
      - `progress` (jsonb) - Structured progress info: current_table, tables_completed, total_tables, rows_fetched

  2. Notes
    - The heartbeat column replaces arbitrary timeout-based stale detection
    - If a backup is in_progress but last_heartbeat_at is >2 minutes old, it is considered stalled
    - Backup limit of 25 is enforced at the application layer
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'database_backups' AND column_name = 'last_heartbeat_at'
  ) THEN
    ALTER TABLE database_backups ADD COLUMN last_heartbeat_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'database_backups' AND column_name = 'progress'
  ) THEN
    ALTER TABLE database_backups ADD COLUMN progress jsonb;
  END IF;
END $$;
