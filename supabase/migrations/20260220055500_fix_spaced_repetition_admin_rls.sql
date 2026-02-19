-- Migration: support admin access for spaced repetition tables
-- Description: Adds RLS policies to allow admins to view/modify spaced repetition data for all users.
-- This is necessary for "User View" mode to work correctly for admins.

-- 1. spaced_repetition_attempts
DROP POLICY IF EXISTS "Admins can view all attempts" ON public.spaced_repetition_attempts;
CREATE POLICY "Admins can view all attempts"
  ON public.spaced_repetition_attempts FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert attempts for any user" ON public.spaced_repetition_attempts;
CREATE POLICY "Admins can insert attempts for any user"
  ON public.spaced_repetition_attempts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- 2. spaced_repetition_schedules
DROP POLICY IF EXISTS "Admins can view all schedules" ON public.spaced_repetition_schedules;
CREATE POLICY "Admins can view all schedules"
  ON public.spaced_repetition_schedules FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert schedules for any user" ON public.spaced_repetition_schedules;
CREATE POLICY "Admins can insert schedules for any user"
  ON public.spaced_repetition_schedules FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all schedules" ON public.spaced_repetition_schedules;
CREATE POLICY "Admins can update all schedules"
  ON public.spaced_repetition_schedules FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. user_streaks
DROP POLICY IF EXISTS "Admins can view all streaks" ON public.user_streaks;
CREATE POLICY "Admins can view all streaks"
  ON public.user_streaks FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all streaks" ON public.user_streaks;
CREATE POLICY "Admins can update all streaks"
  ON public.user_streaks FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. user_achievements
DROP POLICY IF EXISTS "Admins can view all achievements" ON public.user_achievements;
CREATE POLICY "Admins can view all achievements"
  ON public.user_achievements FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert achievements for any user" ON public.user_achievements;
CREATE POLICY "Admins can insert achievements for any user"
  ON public.user_achievements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- 5. set_assignments
DROP POLICY IF EXISTS "Admins can delete all assignments" ON public.set_assignments;
CREATE POLICY "Admins can delete all assignments"
  ON public.set_assignments FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all assignments" ON public.set_assignments;
CREATE POLICY "Admins can update all assignments"
  ON public.set_assignments FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- 6. spaced_repetition_sets (viewing/creating already have some admin support in previous migrations, but let's ensure full coverage)
DROP POLICY IF EXISTS "Admins can view all sets" ON public.spaced_repetition_sets;
CREATE POLICY "Admins can view all sets"
  ON public.spaced_repetition_sets FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert sets for any user" ON public.spaced_repetition_sets;
CREATE POLICY "Admins can insert sets for any user"
  ON public.spaced_repetition_sets FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
