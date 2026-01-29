/*
  # Fix Security and Performance Issues - Part 1
  
  This migration addresses:
  1. Missing index for foreign key
  2. RLS policy optimization using (select auth.uid()) pattern
*/

-- ================================================
-- PART 1: ADD MISSING INDEX
-- ================================================

CREATE INDEX IF NOT EXISTS idx_recommended_voices_created_by 
  ON recommended_voices(created_by);

-- ================================================
-- PART 2: FIX RLS POLICIES FOR PERFORMANCE
-- ================================================

-- USERS TABLE POLICIES
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can read own record" ON users;
DROP POLICY IF EXISTS "Users can update own password" ON users;

CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can read own record"
  ON users
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own password"
  ON users
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- SAVED_CONTENTS TABLE POLICIES
DROP POLICY IF EXISTS "Users can read own saved contents" ON saved_contents;
DROP POLICY IF EXISTS "Users can insert own saved contents" ON saved_contents;
DROP POLICY IF EXISTS "Users can update own saved contents" ON saved_contents;
DROP POLICY IF EXISTS "Users can delete own saved contents" ON saved_contents;

CREATE POLICY "Users can read own saved contents"
  ON saved_contents
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own saved contents"
  ON saved_contents
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own saved contents"
  ON saved_contents
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own saved contents"
  ON saved_contents
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- PRACTICE_ASSIGNMENTS TABLE POLICIES
DROP POLICY IF EXISTS "Admins can view all assignments" ON practice_assignments;
DROP POLICY IF EXISTS "Admins can create assignments" ON practice_assignments;
DROP POLICY IF EXISTS "Admins can delete assignments" ON practice_assignments;
DROP POLICY IF EXISTS "Users can view own assignments" ON practice_assignments;

CREATE POLICY "Admins can view all assignments"
  ON practice_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can create assignments"
  ON practice_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete assignments"
  ON practice_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can view own assignments"
  ON practice_assignments
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- SPELLING_PRACTICES TABLE POLICIES
DROP POLICY IF EXISTS "Admins can view all practices" ON spelling_practices;
DROP POLICY IF EXISTS "Admins can create practices" ON spelling_practices;
DROP POLICY IF EXISTS "Admins can update practices" ON spelling_practices;
DROP POLICY IF EXISTS "Admins can delete practices" ON spelling_practices;
DROP POLICY IF EXISTS "Users can view assigned practices" ON spelling_practices;

CREATE POLICY "Admins can view all practices"
  ON spelling_practices
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
  ON spelling_practices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update practices"
  ON spelling_practices
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

CREATE POLICY "Admins can delete practices"
  ON spelling_practices
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can view assigned practices"
  ON spelling_practices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM practice_assignments
      WHERE practice_assignments.practice_id = spelling_practices.id
      AND practice_assignments.user_id = (select auth.uid())
    )
  );

-- SPELLING_PRACTICE_RESULTS TABLE POLICIES
DROP POLICY IF EXISTS "Users can view own spelling results" ON spelling_practice_results;
DROP POLICY IF EXISTS "Users can insert own spelling results" ON spelling_practice_results;
DROP POLICY IF EXISTS "Admins can view all spelling results" ON spelling_practice_results;

CREATE POLICY "Users can view own spelling results"
  ON spelling_practice_results
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own spelling results"
  ON spelling_practice_results
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all spelling results"
  ON spelling_practice_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

-- MEMORIZATION_PRACTICE_SESSIONS TABLE POLICIES
DROP POLICY IF EXISTS "Users can view own memorization sessions" ON memorization_practice_sessions;
DROP POLICY IF EXISTS "Users can insert own memorization sessions" ON memorization_practice_sessions;
DROP POLICY IF EXISTS "Admins can view all memorization sessions" ON memorization_practice_sessions;

CREATE POLICY "Users can view own memorization sessions"
  ON memorization_practice_sessions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own memorization sessions"
  ON memorization_practice_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all memorization sessions"
  ON memorization_practice_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );