/*
  # Fix Security and Performance Issues - Part 2
  
  Continue fixing RLS policies for proofreading and other tables
*/

-- PROOFREADING_PRACTICES TABLE POLICIES
DROP POLICY IF EXISTS "Admins can view all practices" ON proofreading_practices;
DROP POLICY IF EXISTS "Admins can create practices" ON proofreading_practices;
DROP POLICY IF EXISTS "Admins can update own practices" ON proofreading_practices;
DROP POLICY IF EXISTS "Admins can delete own practices" ON proofreading_practices;
DROP POLICY IF EXISTS "Students can view assigned practices" ON proofreading_practices;

CREATE POLICY "Admins can view all practices"
  ON proofreading_practices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can create practices"
  ON proofreading_practices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update own practices"
  ON proofreading_practices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete own practices"
  ON proofreading_practices
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Students can view assigned practices"
  ON proofreading_practices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proofreading_practice_assignments
      WHERE proofreading_practice_assignments.practice_id = proofreading_practices.id
      AND proofreading_practice_assignments.user_id = (select auth.uid())
    )
  );

-- PROOFREADING_PRACTICE_ASSIGNMENTS TABLE POLICIES
DROP POLICY IF EXISTS "Admins can view all proofreading assignments" ON proofreading_practice_assignments;
DROP POLICY IF EXISTS "Admins can create proofreading assignments" ON proofreading_practice_assignments;
DROP POLICY IF EXISTS "Admins can update proofreading assignments" ON proofreading_practice_assignments;
DROP POLICY IF EXISTS "Admins can delete proofreading assignments" ON proofreading_practice_assignments;
DROP POLICY IF EXISTS "Students can view own proofreading assignments" ON proofreading_practice_assignments;
DROP POLICY IF EXISTS "Students can update own proofreading completion" ON proofreading_practice_assignments;

CREATE POLICY "Admins can view all proofreading assignments"
  ON proofreading_practice_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can create proofreading assignments"
  ON proofreading_practice_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update proofreading assignments"
  ON proofreading_practice_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete proofreading assignments"
  ON proofreading_practice_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Students can view own proofreading assignments"
  ON proofreading_practice_assignments
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Students can update own proofreading completion"
  ON proofreading_practice_assignments
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- PROOFREADING_PRACTICE_RESULTS TABLE POLICIES
DROP POLICY IF EXISTS "Users can view own proofreading results" ON proofreading_practice_results;
DROP POLICY IF EXISTS "Users can insert own proofreading results" ON proofreading_practice_results;
DROP POLICY IF EXISTS "Admins can view all proofreading results" ON proofreading_practice_results;

CREATE POLICY "Users can view own proofreading results"
  ON proofreading_practice_results
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own proofreading results"
  ON proofreading_practice_results
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all proofreading results"
  ON proofreading_practice_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

-- RECOMMENDED_VOICES TABLE POLICIES
DROP POLICY IF EXISTS "Admins can insert voice recommendations" ON recommended_voices;
DROP POLICY IF EXISTS "Admins can update voice recommendations" ON recommended_voices;
DROP POLICY IF EXISTS "Admins can delete voice recommendations" ON recommended_voices;

CREATE POLICY "Admins can insert voice recommendations"
  ON recommended_voices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update voice recommendations"
  ON recommended_voices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete voice recommendations"
  ON recommended_voices
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

-- SYSTEM_CONFIG TABLE POLICIES
DROP POLICY IF EXISTS "Admins can read system config" ON system_config;

CREATE POLICY "Admins can read system config"
  ON system_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

-- CONTENT_REFERENCE TABLE POLICIES
DROP POLICY IF EXISTS "Admins can view all content references" ON content_reference;
DROP POLICY IF EXISTS "Admins can insert content references" ON content_reference;
DROP POLICY IF EXISTS "Admins can update content references" ON content_reference;
DROP POLICY IF EXISTS "Admins can delete content references" ON content_reference;

CREATE POLICY "Admins can view all content references"
  ON content_reference
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert content references"
  ON content_reference
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update content references"
  ON content_reference
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete content references"
  ON content_reference
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );