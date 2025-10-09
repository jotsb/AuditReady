/*
  # Add Saved Filters for Receipt Search

  1. New Tables
    - `saved_filters`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, references auth.users) - User who created the filter
      - `name` (text) - User-defined name for the filter
      - `filters` (jsonb) - JSON object containing filter configuration
      - `is_default` (boolean) - Whether this is the user's default filter
      - `created_at` (timestamptz) - When the filter was created
      - `updated_at` (timestamptz) - When the filter was last modified

  2. Security
    - Enable RLS on `saved_filters` table
    - Add policy for users to read their own saved filters
    - Add policy for users to create their own saved filters
    - Add policy for users to update their own saved filters
    - Add policy for users to delete their own saved filters

  3. Indexes
    - Index on user_id for faster queries
    - Index on is_default for quick default filter lookup

  4. Constraints
    - Only one default filter per user (enforced via unique partial index)

  5. Notes
    - Filters stored as JSONB for flexibility
    - Example filter structure: {
        "dateFrom": "2024-01-01",
        "dateTo": "2024-12-31",
        "amountMin": "100",
        "amountMax": "1000",
        "paymentMethod": "Credit Card",
        "categories": ["Travel", "Meals"]
      }
*/

-- Create saved_filters table
CREATE TABLE IF NOT EXISTS saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL CHECK (length(name) > 0 AND length(name) <= 100),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_default ON saved_filters(user_id, is_default) WHERE is_default = true;

-- Ensure only one default filter per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_filters_one_default_per_user 
  ON saved_filters(user_id) 
  WHERE is_default = true;

-- Enable RLS
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own saved filters
CREATE POLICY "Users can view own saved filters"
  ON saved_filters
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can create their own saved filters
CREATE POLICY "Users can create own saved filters"
  ON saved_filters
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own saved filters
CREATE POLICY "Users can update own saved filters"
  ON saved_filters
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own saved filters
CREATE POLICY "Users can delete own saved filters"
  ON saved_filters
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_saved_filters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_saved_filters_updated_at_trigger ON saved_filters;
CREATE TRIGGER update_saved_filters_updated_at_trigger
  BEFORE UPDATE ON saved_filters
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_filters_updated_at();

-- Function to ensure only one default filter per user
CREATE OR REPLACE FUNCTION ensure_single_default_filter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset any existing default filters for this user
    UPDATE saved_filters 
    SET is_default = false 
    WHERE user_id = NEW.user_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure only one default filter per user
DROP TRIGGER IF EXISTS ensure_single_default_filter_trigger ON saved_filters;
CREATE TRIGGER ensure_single_default_filter_trigger
  BEFORE INSERT OR UPDATE ON saved_filters
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_filter();
