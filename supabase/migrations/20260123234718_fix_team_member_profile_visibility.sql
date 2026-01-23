/*
  # Fix Team Member Profile Visibility
  
  ## Problem
  Team members cannot see each other's profiles in the Team Management page,
  causing them to appear as "Unknown" users.
  
  ## Solution
  Add RLS policy to allow users to view profiles of other members in the same business.
  
  ## Changes
  1. Add SELECT policy on profiles table for team members
     - Users can view profiles of members in the same business
     - Check via business_members table
  
  ## Security
  - Users can only see profiles of members in businesses they belong to
  - Maintains data isolation between businesses
*/

-- Allow users to view profiles of team members in the same business
CREATE POLICY "Team members can view each other's profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM business_members bm1
      INNER JOIN business_members bm2 ON bm1.business_id = bm2.business_id
      WHERE bm1.user_id = auth.uid()
        AND bm2.user_id = profiles.id
    )
  );
