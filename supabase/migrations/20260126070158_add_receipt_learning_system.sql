/*
  # Receipt Learning System
  
  This migration adds tables to enable the system to learn from user corrections
  and improve future receipt data extraction.
  
  1. New Tables
    - `vendor_corrections`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses)
      - `extracted_name` (text) - The original name extracted by AI
      - `corrected_name` (text) - The name the user corrected it to
      - `occurrence_count` (integer) - How many times this correction has been made
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
    - `category_mappings`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses)
      - `vendor_pattern` (text) - Vendor name pattern to match
      - `category_name` (text) - Category to assign
      - `confidence_score` (numeric) - How confident we are (based on occurrences)
      - `occurrence_count` (integer) - How many times this mapping was used/confirmed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
    - `category_suggestions`
      - `id` (uuid, primary key)
      - `receipt_id` (uuid, references receipts)
      - `current_category` (text)
      - `suggested_category` (text)
      - `reason` (text)
      - `status` (text) - pending, accepted, rejected
      - `created_at` (timestamptz)
      - `reviewed_at` (timestamptz)
      - `reviewed_by` (uuid)
      
  2. Security
    - Enable RLS on all tables
    - Policies restrict access to business members only
    
  3. Functions
    - `record_vendor_correction` - Records when a user corrects a vendor name
    - `record_category_selection` - Records when a user selects/confirms a category
    - `get_learned_mappings` - Returns learned mappings for a business
*/

-- Vendor Corrections Table
CREATE TABLE IF NOT EXISTS vendor_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  extracted_name text NOT NULL,
  corrected_name text NOT NULL,
  occurrence_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, extracted_name, corrected_name)
);

CREATE INDEX IF NOT EXISTS idx_vendor_corrections_business ON vendor_corrections(business_id);
CREATE INDEX IF NOT EXISTS idx_vendor_corrections_extracted ON vendor_corrections(business_id, extracted_name);

ALTER TABLE vendor_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view vendor corrections"
  ON vendor_corrections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_members.business_id = vendor_corrections.business_id
      AND business_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Business members can insert vendor corrections"
  ON vendor_corrections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_members.business_id = vendor_corrections.business_id
      AND business_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Business members can update vendor corrections"
  ON vendor_corrections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_members.business_id = vendor_corrections.business_id
      AND business_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_members.business_id = vendor_corrections.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- Category Mappings Table
CREATE TABLE IF NOT EXISTS category_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  vendor_pattern text NOT NULL,
  category_name text NOT NULL,
  confidence_score numeric(5,2) DEFAULT 1.0,
  occurrence_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, vendor_pattern, category_name)
);

CREATE INDEX IF NOT EXISTS idx_category_mappings_business ON category_mappings(business_id);
CREATE INDEX IF NOT EXISTS idx_category_mappings_vendor ON category_mappings(business_id, vendor_pattern);

ALTER TABLE category_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view category mappings"
  ON category_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_members.business_id = category_mappings.business_id
      AND business_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Business members can insert category mappings"
  ON category_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_members.business_id = category_mappings.business_id
      AND business_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Business members can update category mappings"
  ON category_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_members.business_id = category_mappings.business_id
      AND business_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_members.business_id = category_mappings.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- Category Suggestions Table
CREATE TABLE IF NOT EXISTS category_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  current_category text,
  suggested_category text NOT NULL,
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  UNIQUE(receipt_id, suggested_category)
);

CREATE INDEX IF NOT EXISTS idx_category_suggestions_receipt ON category_suggestions(receipt_id);
CREATE INDEX IF NOT EXISTS idx_category_suggestions_business ON category_suggestions(business_id);
CREATE INDEX IF NOT EXISTS idx_category_suggestions_status ON category_suggestions(business_id, status);

ALTER TABLE category_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view category suggestions"
  ON category_suggestions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_members.business_id = category_suggestions.business_id
      AND business_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Business members can insert category suggestions"
  ON category_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_members.business_id = category_suggestions.business_id
      AND business_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Business members can update category suggestions"
  ON category_suggestions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_members.business_id = category_suggestions.business_id
      AND business_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_members.business_id = category_suggestions.business_id
      AND business_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Business members can delete category suggestions"
  ON category_suggestions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_members.business_id = category_suggestions.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- Function to record vendor corrections
CREATE OR REPLACE FUNCTION record_vendor_correction(
  p_business_id uuid,
  p_extracted_name text,
  p_corrected_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_extracted_name IS NULL OR p_corrected_name IS NULL THEN
    RETURN;
  END IF;
  
  IF LOWER(TRIM(p_extracted_name)) = LOWER(TRIM(p_corrected_name)) THEN
    RETURN;
  END IF;

  INSERT INTO vendor_corrections (business_id, extracted_name, corrected_name, occurrence_count)
  VALUES (p_business_id, LOWER(TRIM(p_extracted_name)), TRIM(p_corrected_name), 1)
  ON CONFLICT (business_id, extracted_name, corrected_name)
  DO UPDATE SET
    occurrence_count = vendor_corrections.occurrence_count + 1,
    updated_at = now();
END;
$$;

-- Function to record category selections
CREATE OR REPLACE FUNCTION record_category_selection(
  p_business_id uuid,
  p_vendor_name text,
  p_category_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendor_pattern text;
BEGIN
  IF p_vendor_name IS NULL OR p_category_name IS NULL THEN
    RETURN;
  END IF;

  v_vendor_pattern := LOWER(TRIM(p_vendor_name));

  INSERT INTO category_mappings (business_id, vendor_pattern, category_name, occurrence_count, confidence_score)
  VALUES (p_business_id, v_vendor_pattern, p_category_name, 1, 1.0)
  ON CONFLICT (business_id, vendor_pattern, category_name)
  DO UPDATE SET
    occurrence_count = category_mappings.occurrence_count + 1,
    confidence_score = LEAST(category_mappings.confidence_score + 0.1, 10.0),
    updated_at = now();
END;
$$;

-- Function to get learned mappings for extraction
CREATE OR REPLACE FUNCTION get_learned_mappings(p_business_id uuid)
RETURNS TABLE (
  vendor_corrections jsonb,
  category_mappings jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'extracted', vc.extracted_name,
        'corrected', vc.corrected_name,
        'count', vc.occurrence_count
      ) ORDER BY vc.occurrence_count DESC), '[]'::jsonb)
      FROM vendor_corrections vc
      WHERE vc.business_id = p_business_id
      AND vc.occurrence_count >= 2
    ) as vendor_corrections,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'vendor', cm.vendor_pattern,
        'category', cm.category_name,
        'confidence', cm.confidence_score,
        'count', cm.occurrence_count
      ) ORDER BY cm.confidence_score DESC, cm.occurrence_count DESC), '[]'::jsonb)
      FROM category_mappings cm
      WHERE cm.business_id = p_business_id
      AND cm.occurrence_count >= 2
    ) as category_mappings;
END;
$$;

-- Function to generate category suggestions for a business when new category added
CREATE OR REPLACE FUNCTION generate_category_suggestions(
  p_business_id uuid,
  p_new_category_name text,
  p_category_description text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
  v_receipt record;
  v_keywords text[];
BEGIN
  v_keywords := string_to_array(LOWER(p_category_description), ' ');
  v_keywords := array_append(v_keywords, LOWER(p_new_category_name));

  FOR v_receipt IN
    SELECT r.id, r.vendor_name, r.category, c.id as collection_id
    FROM receipts r
    JOIN collections c ON r.collection_id = c.id
    WHERE c.business_id = p_business_id
    AND r.deleted_at IS NULL
    AND (r.category IS NULL OR r.category != p_new_category_name)
    AND r.vendor_name IS NOT NULL
  LOOP
    IF (
      SELECT EXISTS (
        SELECT 1 FROM unnest(v_keywords) k
        WHERE LOWER(v_receipt.vendor_name) LIKE '%' || k || '%'
        AND LENGTH(k) > 3
      )
    ) THEN
      INSERT INTO category_suggestions (
        receipt_id, business_id, current_category, suggested_category, reason, status
      )
      VALUES (
        v_receipt.id,
        p_business_id,
        v_receipt.category,
        p_new_category_name,
        'Vendor name matches new category keywords',
        'pending'
      )
      ON CONFLICT (receipt_id, suggested_category) DO NOTHING;
      
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION record_vendor_correction TO authenticated;
GRANT EXECUTE ON FUNCTION record_category_selection TO authenticated;
GRANT EXECUTE ON FUNCTION get_learned_mappings TO authenticated;
GRANT EXECUTE ON FUNCTION generate_category_suggestions TO authenticated;
