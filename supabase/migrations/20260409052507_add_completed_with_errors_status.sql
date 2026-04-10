/*
  # Add 'completed_with_errors' status to database_backups

  1. Modified Tables
    - `database_backups`
      - Updated `status` check constraint to allow 'completed_with_errors' value
  
  2. Reason
    - Backups that partially succeed (some tables fetched, others failed) need a 
      distinct status to differentiate from fully successful or fully failed backups
    - This enables proper error surfacing in the UI
*/

ALTER TABLE database_backups DROP CONSTRAINT IF EXISTS database_backups_status_check;

ALTER TABLE database_backups ADD CONSTRAINT database_backups_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'completed_with_errors'::text, 'failed'::text]));
