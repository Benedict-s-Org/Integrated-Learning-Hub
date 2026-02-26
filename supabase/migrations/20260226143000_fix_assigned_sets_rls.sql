-- Fix RLS so students can see sets and questions that are assigned to them
-- Previously, students could only see sets they OWN or sets that are published.
-- Assigned (but unpublished) sets were invisible to the assigned student.

-- 1. Fix spaced_repetition_sets: students can see sets assigned to them
DROP POLICY IF EXISTS "Users can view own sets" ON public.spaced_repetition_sets;
CREATE POLICY "Users can view own sets"
  ON public.spaced_repetition_sets FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR is_published = true
    OR EXISTS (
      SELECT 1 FROM public.set_assignments
      WHERE set_assignments.set_id = spaced_repetition_sets.id
        AND set_assignments.user_id = auth.uid()
    )
  );

-- 2. Fix spaced_repetition_questions: students can see questions in sets assigned to them
DROP POLICY IF EXISTS "Users can view questions in accessible sets" ON public.spaced_repetition_questions;
CREATE POLICY "Users can view questions in accessible sets"
  ON public.spaced_repetition_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.spaced_repetition_sets
      WHERE spaced_repetition_sets.id = spaced_repetition_questions.set_id
        AND (
          spaced_repetition_sets.user_id = auth.uid()
          OR spaced_repetition_sets.is_published = true
          OR EXISTS (
            SELECT 1 FROM public.set_assignments
            WHERE set_assignments.set_id = spaced_repetition_sets.id
              AND set_assignments.user_id = auth.uid()
          )
        )
    )
  );
