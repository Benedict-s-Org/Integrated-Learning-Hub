-- Fix missing INSERT policy for user_streaks
-- The original migration only created SELECT and UPDATE policies.
-- The updateStreakData function uses upsert which requires INSERT permission
-- when the row doesn't yet exist for the user.

-- Allow regular users to insert their own streak row
CREATE POLICY "Users can insert own streaks"
  ON public.user_streaks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow admins to insert/upsert streak rows for any user (needed for "User View" mode)
DROP POLICY IF EXISTS "Admins can insert streaks for any user" ON public.user_streaks;
CREATE POLICY "Admins can insert streaks for any user"
  ON public.user_streaks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Also ensure user_achievements has an INSERT policy for users
-- (to allow checkForAchievements to work for regular users)
CREATE POLICY "Users can insert own achievements"
  ON public.user_achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
