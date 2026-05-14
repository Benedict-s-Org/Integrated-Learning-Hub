-- Migration: Fix Spaced Repetition Assignment Visibility
-- Description: Ensure students can see sets that are assigned to them, even if not published.

-- 1. Ensure set_assignments policy is robust and includes admin bypass
DROP POLICY IF EXISTS "Users can view assigned sets" ON public.set_assignments;
CREATE POLICY "Users can view assigned sets"
  ON public.set_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = assigned_by OR public.is_admin());

-- 2. Ensure spaced_repetition_sets policy handles assignments correctly
-- We use a more direct subquery to avoid potential PostgREST join/RLS interaction issues
DROP POLICY IF EXISTS "Users can view own sets" ON public.spaced_repetition_sets;
CREATE POLICY "Users can view own sets"
  ON public.spaced_repetition_sets FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR is_published = true
    OR public.is_admin()
    OR id IN (
      SELECT set_id FROM public.set_assignments
      WHERE user_id = auth.uid()
    )
  );

-- 3. Ensure spaced_repetition_questions policy handles assignments correctly
DROP POLICY IF EXISTS "Users can view questions in accessible sets" ON public.spaced_repetition_questions;
CREATE POLICY "Users can view questions in accessible sets"
  ON public.spaced_repetition_questions FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.spaced_repetition_sets
      WHERE spaced_repetition_sets.id = spaced_repetition_questions.set_id
      AND (
        spaced_repetition_sets.user_id = auth.uid()
        OR spaced_repetition_sets.is_published = true
        OR spaced_repetition_sets.id IN (
          SELECT set_id FROM public.set_assignments
          WHERE user_id = auth.uid()
        )
      )
    )
  );

-- 4. Ensure students can view schedules for assigned sets (if they don't own them)
-- The existing policy only allows viewing own schedules: USING (auth.uid() = user_id)
-- This is usually correct as schedules ARE own data.
