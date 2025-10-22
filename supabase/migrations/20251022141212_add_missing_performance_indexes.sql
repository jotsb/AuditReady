/*
  # Add Missing Performance Indexes

  ## Problem
  Several tables are missing indexes that would improve query performance,
  especially for frequently queried foreign key relationships.

  ## Solution
  Add composite indexes for common query patterns found in:
  - Invitations filtering by business_id + status
  - Business members joined_at ordering
  - Profiles lookups (already has indexes, but adding email index)

  ## Changes
  1. Add composite index on invitations (business_id, status, created_at)
  2. Add composite index on business_members (business_id, joined_at)
  3. Add index on profiles (email) for faster lookups
*/

-- Add composite index for invitations queries (business_id + status + created_at)
CREATE INDEX IF NOT EXISTS idx_invitations_business_status_date
ON invitations (business_id, status, created_at DESC);

-- Add composite index for business_members queries (business_id + joined_at)
CREATE INDEX IF NOT EXISTS idx_business_members_business_joined
ON business_members (business_id, joined_at DESC);

-- Add index on profiles email for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email
ON profiles (email);

-- Add index on profiles id (should already exist as primary key, but being explicit)
-- This helps JOIN performance
CREATE INDEX IF NOT EXISTS idx_profiles_id
ON profiles (id);
