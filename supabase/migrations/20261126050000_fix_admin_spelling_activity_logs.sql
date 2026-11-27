-- Migration: Fix Admin Analytics - Student Spelling Results Access
-- Mirrors get_student_proofreading_results so Activity Logs can load spelling
-- rows when direct SELECT is blocked by RLS (auth.uid vs public.users mismatch).

DROP FUNCTION IF EXISTS public.get_student_spelling_results(uuid);

CREATE OR REPLACE FUNCTION public.get_student_spelling_results(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  practice_id uuid,
  assignment_id uuid,
  title text,
  words text[],
  user_answers jsonb,
  correct_count integer,
  total_count integer,
  accuracy_percentage integer,
  practice_level integer,
  time_spent_seconds integer,
  completed_at timestamptz,
  created_at timestamptz,
  is_srs boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT
    spr.id,
    spr.user_id,
    spr.practice_id,
    spr.assignment_id,
    spr.title,
    spr.words,
    spr.user_answers,
    spr.correct_count,
    spr.total_count,
    spr.accuracy_percentage,
    spr.practice_level,
    spr.time_spent_seconds,
    spr.completed_at,
    spr.created_at,
    COALESCE(spr.is_srs, false) AS is_srs
  FROM public.spelling_practice_results spr
  WHERE spr.user_id = target_user_id
  ORDER BY spr.completed_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_spelling_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_spelling_results(uuid) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'spelling_practice_results') THEN
    DROP POLICY IF EXISTS "Users can view own spelling results" ON public.spelling_practice_results;
    DROP POLICY IF EXISTS "Admins can view all spelling results" ON public.spelling_practice_results;
    DROP POLICY IF EXISTS "Users and admins can view spelling results" ON public.spelling_practice_results;

    CREATE POLICY "Users and admins can view spelling results"
      ON public.spelling_practice_results FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid()
        OR public.is_admin(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role IN ('admin', 'class_staff')
        )
      );
  END IF;
END $$;
