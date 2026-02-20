-- Comprehensive Admin access for Spaced Repetition tables
-- This ensures "User View" mode works correctly for admins by bypassing typical user isolation.

-- Helper to safely recreate policies
DO $$
BEGIN
    -- 1. spaced_repetition_sets
    DROP POLICY IF EXISTS "Admins can maintain all sets" ON public.spaced_repetition_sets;
    CREATE POLICY "Admins can maintain all sets"
      ON public.spaced_repetition_sets FOR ALL
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());

    -- 2. spaced_repetition_questions
    DROP POLICY IF EXISTS "Admins can maintain all questions" ON public.spaced_repetition_questions;
    CREATE POLICY "Admins can maintain all questions"
      ON public.spaced_repetition_questions FOR ALL
      TO authenticated
      USING (public.is_admin());

    -- 3. spaced_repetition_schedules
    DROP POLICY IF EXISTS "Admins can maintain all schedules" ON public.spaced_repetition_schedules;
    CREATE POLICY "Admins can maintain all schedules"
      ON public.spaced_repetition_schedules FOR ALL
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());

    -- 4. spaced_repetition_attempts
    DROP POLICY IF EXISTS "Admins can maintain all attempts" ON public.spaced_repetition_attempts;
    CREATE POLICY "Admins can maintain all attempts"
      ON public.spaced_repetition_attempts FOR ALL
      TO authenticated
      USING (public.is_admin());

    -- 5. user_streaks
    DROP POLICY IF EXISTS "Admins can maintain all streaks" ON public.user_streaks;
    CREATE POLICY "Admins can maintain all streaks"
      ON public.user_streaks FOR ALL
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());

    -- 6. user_achievements
    DROP POLICY IF EXISTS "Admins can maintain all achievements" ON public.user_achievements;
    CREATE POLICY "Admins can maintain all achievements"
      ON public.user_achievements FOR ALL
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());

    -- 7. set_assignments
    DROP POLICY IF EXISTS "Admins can maintain all assignments" ON public.set_assignments;
    CREATE POLICY "Admins can maintain all assignments"
      ON public.set_assignments FOR ALL
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
END $$;
