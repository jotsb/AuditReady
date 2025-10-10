/*
  # Add Saved Filter Tables for Logs

  1. New Tables
    - `saved_audit_filters`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text) - Filter name
      - `filters` (jsonb) - Filter configuration
      - `is_default` (boolean) - Whether this is the default filter for the user
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `saved_system_filters`
      - Same structure as saved_audit_filters but for system logs
  
  2. Security
    - Enable RLS on both tables
    - Users can only manage their own saved filters
    - Only one default filter per user per type
*/

-- Create saved_audit_filters table
CREATE TABLE IF NOT EXISTS saved_audit_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT saved_audit_filters_name_length CHECK (length(name) >= 1 AND length(name) <= 100)
);

-- Create saved_system_filters table
CREATE TABLE IF NOT EXISTS saved_system_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT saved_system_filters_name_length CHECK (length(name) >= 1 AND length(name) <= 100)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_saved_audit_filters_user_id ON saved_audit_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_system_filters_user_id ON saved_system_filters(user_id);

-- Enable RLS
ALTER TABLE saved_audit_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_system_filters ENABLE ROW LEVEL SECURITY;

-- Policies for saved_audit_filters
CREATE POLICY "Users can view own audit filters"
  ON saved_audit_filters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit filters"
  ON saved_audit_filters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own audit filters"
  ON saved_audit_filters FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own audit filters"
  ON saved_audit_filters FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for saved_system_filters
CREATE POLICY "Users can view own system filters"
  ON saved_system_filters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own system filters"
  ON saved_system_filters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own system filters"
  ON saved_system_filters FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own system filters"
  ON saved_system_filters FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_saved_filter_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_saved_audit_filters_updated_at
  BEFORE UPDATE ON saved_audit_filters
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_filter_updated_at();

CREATE TRIGGER update_saved_system_filters_updated_at
  BEFORE UPDATE ON saved_system_filters
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_filter_updated_at();

-- Function to ensure only one default filter per user
CREATE OR REPLACE FUNCTION ensure_single_default_audit_filter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE saved_audit_filters
    SET is_default = false
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ensure_single_default_system_filter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE saved_system_filters
    SET is_default = false
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_audit_filter_trigger
  BEFORE INSERT OR UPDATE ON saved_audit_filters
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_audit_filter();

CREATE TRIGGER ensure_single_default_system_filter_trigger
  BEFORE INSERT OR UPDATE ON saved_system_filters
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_system_filter();
