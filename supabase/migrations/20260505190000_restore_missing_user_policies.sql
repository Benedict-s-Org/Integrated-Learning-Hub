-- Restore missing user policies for Spaced Repetition that may have been accidentally dropped

DO $$
BEGIN
    -- 1. spaced_repetition_attempts
    DROP POLICY IF EXISTS "Users can view own attempts" ON public.spaced_repetition_attempts;
    CREATE POLICY "Users can view own attempts"
      ON public.spaced_repetition_attempts FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can insert own attempts" ON public.spaced_repetition_attempts;
    CREATE POLICY "Users can insert own attempts"
      ON public.spaced_repetition_attempts FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);

    -- 2. spaced_repetition_schedules
    DROP POLICY IF EXISTS "Users can view own schedules" ON public.spaced_repetition_schedules;
    CREATE POLICY "Users can view own schedules"
      ON public.spaced_repetition_schedules FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can insert own schedules" ON public.spaced_repetition_schedules;
    CREATE POLICY "Users can insert own schedules"
      ON public.spaced_repetition_schedules FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can update own schedules" ON public.spaced_repetition_schedules;
    CREATE POLICY "Users can update own schedules"
      ON public.spaced_repetition_schedules FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    -- 3. user_streaks
    DROP POLICY IF EXISTS "Users can view own streaks" ON public.user_streaks;
    CREATE POLICY "Users can view own streaks"
      ON public.user_streaks FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can insert own streaks" ON public.user_streaks;
    CREATE POLICY "Users can insert own streaks"
      ON public.user_streaks FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can update own streaks" ON public.user_streaks;
    CREATE POLICY "Users can update own streaks"
      ON public.user_streaks FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

END $$;
