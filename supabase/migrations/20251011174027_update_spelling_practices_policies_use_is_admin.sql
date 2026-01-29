/*
  # Update Spelling Practices Policies to Use is_admin() Function

  1. Changes
    - Replace policies that query users table directly
    - Use the is_admin() SECURITY DEFINER function instead
    - This avoids any potential recursion issues
    - More efficient as it caches the admin check

  2. Security
    - Maintains same security level
    - Only admins can create, update, delete practices
    - Users can view practices assigned to them
    - Admins can view all practices
*/

-- Drop recently created policies
DROP POLICY IF EXISTS "Admins can view all spelling practices" ON spelling_practices;
DROP POLICY IF EXISTS "Admins can create spelling practices" ON spelling_practices;
DROP POLICY IF EXISTS "Admins can update spelling practices" ON spelling_practices;
DROP POLICY IF EXISTS "Admins can delete spelling practices" ON spelling_practices;
DROP POLICY IF EXISTS "Users can view their assigned spelling practices" ON spelling_practices;

-- Create new policies using is_admin() function
CREATE POLICY "Admins can view all practices"
  ON spelling_practices FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can create practices"
  ON spelling_practices FOR INSERT
  TO authenticated
  WITH CHECK (is_admin() AND created_by = auth.uid());

CREATE POLICY "Admins can update practices"
  ON spelling_practices FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete practices"
  ON spelling_practices FOR DELETE
  TO authenticated
  USING (is_admin());

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
