-- Migration: Add get_student_proofreading_results RPC and ensure Admin/Staff RLS
-- Allows admins and teachers to view student detailed proofreading answers without RLS blocks

CREATE OR REPLACE FUNCTION public.get_student_proofreading_results(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  practice_id uuid,
  assignment_id uuid,
  sentences text[],
  correct_answers jsonb,
  user_answers jsonb,
  correct_count integer,
  total_count integer,
  accuracy_percentage integer,
  time_spent_seconds integer,
  completed_at timestamptz,
  created_at timestamptz,
  tips_used jsonb,
  practice_title text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT 
    ppr.id,
    ppr.user_id,
    ppr.practice_id,
    ppr.assignment_id,
    ppr.sentences,
    ppr.correct_answers,
    ppr.user_answers,
    ppr.correct_count,
    ppr.total_count,
    ppr.accuracy_percentage,
    ppr.time_spent_seconds,
    ppr.completed_at,
    ppr.created_at,
    COALESCE(ppr.tips_used, '[]'::jsonb) AS tips_used,
    pp.title AS practice_title
  FROM public.proofreading_practice_results ppr
  LEFT JOIN public.proofreading_practices pp ON ppr.practice_id = pp.id
  WHERE ppr.user_id = target_user_id
  ORDER BY ppr.completed_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_proofreading_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_proofreading_results(uuid) TO service_role;

-- Ensure RLS allows admins and staff to SELECT directly from proofreading_practice_results
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'proofreading_practice_results') THEN
    DROP POLICY IF EXISTS "Admins can view all proofreading results" ON public.proofreading_practice_results;
    CREATE POLICY "Admins can view all proofreading results"
      ON public.proofreading_practice_results FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role IN ('admin', 'class_staff')
        )
      );
  END IF;
END $$;
