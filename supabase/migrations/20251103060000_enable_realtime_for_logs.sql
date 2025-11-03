/*
  # Enable Realtime for Logs Tables

  1. Configuration
    - Enable realtime publication for system_logs table
    - Enable realtime publication for audit_logs table
    - Set replica identity to FULL to include all columns in realtime payload

  2. Security
    - RLS policies already enforce access control
    - Realtime subscriptions respect RLS automatically
*/

-- Enable replica identity FULL for system_logs
-- This ensures all column values are included in the realtime payload
ALTER TABLE system_logs REPLICA IDENTITY FULL;

-- Enable replica identity FULL for audit_logs
ALTER TABLE audit_logs REPLICA IDENTITY FULL;

-- Add tables to realtime publication if not already added
DO $$
BEGIN
  -- Check if publication exists, create if not
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add system_logs to publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'system_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE system_logs;
  END IF;
END $$;

-- Add audit_logs to publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
  END IF;
END $$;
