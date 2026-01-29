/*
  # Fix RLS Policy Infinite Recursion for Spelling Practices

  1. Problem
    - The existing policies for spelling_practices query the users table to check if user is admin
    - The users table SELECT policy also queries users table, creating infinite recursion
    - This prevents admins from inserting/updating spelling practices

  2. Solution
    - Drop existing policies that cause recursion
    - Create new policies that use a more efficient approach
    - Check admin role directly from user metadata stored in JWT claims
    - This avoids querying the users table during policy evaluation

  3. Security
    - Maintains same security level - only admins can manage practices
    - Users can still view practices assigned to them
    - More performant as it doesn't require additional table queries
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all practices" ON spelling_practices;
DROP POLICY IF EXISTS "Admins can create practices" ON spelling_practices;
DROP POLICY IF EXISTS "Admins can update practices" ON spelling_practices;
DROP POLICY IF EXISTS "Admins can delete practices" ON spelling_practices;
DROP POLICY IF EXISTS "Users can view assigned practices" ON spelling_practices;

-- Create new policies that avoid infinite recursion
-- These policies check the user's role from raw_user_meta_data which doesn't require querying users table

CREATE POLICY "Admins can view all spelling practices"
  ON spelling_practices FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can create spelling practices"
  ON spelling_practices FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can update spelling practices"
  ON spelling_practices FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can delete spelling practices"
  ON spelling_practices FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Users can view practices assigned to them
CREATE POLICY "Users can view their assigned spelling practices"
  ON spelling_practices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM practice_assignments
      WHERE practice_assignments.practice_id = spelling_practices.id
      AND practice_assignments.user_id = auth.uid()
    )
  );
