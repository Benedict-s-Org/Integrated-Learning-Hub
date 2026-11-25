-- Class staff / admin: load prior morning-duty missing items without RLS gaps.
-- Used by morning makeup modal after 交齊／欠.

CREATE OR REPLACE FUNCTION public.get_student_prior_missing_homework(
  p_student_id uuid,
  p_today date DEFAULT (timezone('Asia/Hong_Kong', now()))::date
)
RETURNS TABLE (
  log_id uuid,
  log_date date,
  class text,
  student_id uuid,
  status text,
  missing_items jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_class text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT u.class INTO v_class
  FROM public.users u
  WHERE u.id = p_student_id;

  IF v_class IS NULL OR btrim(v_class) = '' THEN
    SELECT l.class INTO v_class
    FROM public.morning_duty_logs l
    WHERE l.student_id = p_student_id
    ORDER BY l.log_date DESC
    LIMIT 1;
  END IF;

  IF v_class IS NULL OR NOT public.is_authorized_for_class(v_actor, v_class) THEN
    -- Also allow if actor is authorized for any class that appears on this student's logs.
    IF NOT EXISTS (
      SELECT 1
      FROM public.morning_duty_logs l
      WHERE l.student_id = p_student_id
        AND public.is_authorized_for_class(v_actor, l.class)
    ) AND NOT public.is_admin(v_actor) THEN
      RAISE EXCEPTION 'Not authorized for student %', p_student_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.log_date,
    l.class,
    l.student_id,
    l.status::text,
    l.missing_items
  FROM public.morning_duty_logs l
  WHERE l.student_id = p_student_id
    AND l.log_date < p_today
    AND lower(coalesce(l.status::text, '')) = 'missing'
    AND l.missing_items IS NOT NULL
    AND l.missing_items <> '{}'::jsonb
  ORDER BY l.log_date ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_prior_missing_homework(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_prior_missing_homework(uuid, date) TO authenticated;
