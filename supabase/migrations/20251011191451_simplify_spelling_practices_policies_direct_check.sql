/*
  # Simplify Spelling Practices Policies with Direct Role Check
  
  1. Problem
    - is_admin() function may not properly bypass RLS in Supabase
    - Need a simpler approach that doesn't cause recursion
    
  2. Solution
    - Use direct subquery that only checks the user's own record
    - Since users can read their own record (id = auth.uid()), no recursion occurs
    - This avoids the need for querying all users or using complex functions
    
  3. Security
    - Same security level maintained
    - Only checks the current user's own role (which they can always read)
    - No recursion because policy only checks their own record
*/

-- Drop existing spelling_practices policies
DROP POLICY IF EXISTS "Admins can view all practices" ON spelling_practices;
DROP POLICY IF EXISTS "Admins can create practices" ON spelling_practices;
DROP POLICY IF EXISTS "Admins can update practices" ON spelling_practices;
DROP POLICY IF EXISTS "Admins can delete practices" ON spelling_practices;
DROP POLICY IF EXISTS "Users can view assigned practices" ON spelling_practices;

-- Create new simplified policies that check user's own role directly
-- This works because users can always read their own record (id = auth.uid())

CREATE POLICY "Admins can view all practices"
  ON spelling_practices FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

CREATE POLICY "Admins can create practices"
  ON spelling_practices FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid() LIMIT 1) = 'admin'
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can update practices"
  ON spelling_practices FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid() LIMIT 1) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

CREATE POLICY "Admins can delete practices"
  ON spelling_practices FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

-- Users can view practices assigned to them
CREATE POLICY "Users can view assigned practices"
  ON spelling_practices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM practice_assignments
      WHERE practice_assignments.practice_id = spelling_practices.id
      AND practice_assignments.user_id = auth.uid()
    )
  );
