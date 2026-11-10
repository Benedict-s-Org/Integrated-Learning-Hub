-- Idempotent makeup write so duplicate clicks cannot flip a hand-in back to missing.

CREATE OR REPLACE FUNCTION public.set_homework_makeup(
  p_log_id uuid,
  p_subject text,
  p_item text,
  p_is_made_up boolean
) RETURNS public.homework_makeup_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log record;
  v_actor_id uuid := auth.uid();
  v_action public.homework_makeup_actions;
  v_made_up boolean := COALESCE(p_is_made_up, false);
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT class, log_date, student_id INTO v_log
  FROM public.morning_duty_logs
  WHERE id = p_log_id;

  IF v_log IS NULL THEN
    RAISE EXCEPTION 'Morning duty log not found';
  END IF;

  IF NOT public.is_authorized_for_class(v_actor_id, v_log.class) THEN
    RAISE EXCEPTION 'Not authorized for class %', v_log.class;
  END IF;

  INSERT INTO public.homework_makeup_actions (
    log_id, student_id, class, log_date, subject, item, is_made_up, marked_by, marked_at
  ) VALUES (
    p_log_id, v_log.student_id, v_log.class, v_log.log_date, p_subject, p_item, v_made_up, v_actor_id, now()
  )
  ON CONFLICT (log_id, subject, item) DO UPDATE SET
    is_made_up = EXCLUDED.is_made_up,
    marked_by = EXCLUDED.marked_by,
    marked_at = EXCLUDED.marked_at
  RETURNING * INTO v_action;

  RETURN v_action;
END;
$$;

REVOKE ALL ON FUNCTION public.set_homework_makeup(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_homework_makeup(uuid, text, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
