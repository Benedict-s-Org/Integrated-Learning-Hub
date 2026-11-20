-- When makeup clears the last missing item, flip the duty row out of
-- status='missing'. Leaving it as missing with empty missing_items let
-- English classmate-inference reinflate the student as 欠 on every item
-- after refresh.

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
  v_items jsonb;
  v_subject_items jsonb;
  v_next jsonb := '{}'::jsonb;
  v_subj text;
  v_arr jsonb;
  v_filtered jsonb;
  v_cleared boolean := false;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, class, log_date, student_id, missing_items, status INTO v_log
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

  IF v_made_up THEN
    v_items := COALESCE(v_log.missing_items, '{}'::jsonb);
    FOR v_subj, v_arr IN SELECT key, value FROM jsonb_each(v_items)
    LOOP
      IF v_subj = p_subject THEN
        SELECT COALESCE(jsonb_agg(to_jsonb(elem)), '[]'::jsonb)
        INTO v_filtered
        FROM jsonb_array_elements_text(v_arr) AS elem
        WHERE elem IS DISTINCT FROM p_item;
        IF v_filtered <> '[]'::jsonb THEN
          v_next := v_next || jsonb_build_object(v_subj, v_filtered);
        END IF;
      ELSE
        v_next := v_next || jsonb_build_object(v_subj, v_arr);
      END IF;
    END LOOP;

    v_cleared := (v_next = '{}'::jsonb);

    UPDATE public.morning_duty_logs
    SET missing_items = CASE WHEN v_cleared THEN NULL ELSE v_next END,
        -- Makeup from 欠 is late hand-in once every listed item is cleared.
        status = CASE
          WHEN v_cleared AND COALESCE(v_log.status, '') IN ('missing', 'todo', '') THEN 'late'
          ELSE v_log.status
        END,
        updated_at = now()
    WHERE id = p_log_id;
  ELSE
    -- Undo makeup: put the item back on the duty missing list.
    v_items := COALESCE(v_log.missing_items, '{}'::jsonb);
    v_subject_items := COALESCE(v_items -> p_subject, '[]'::jsonb);
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_subject_items) AS elem WHERE elem = p_item
    ) THEN
      v_subject_items := v_subject_items || to_jsonb(p_item);
    END IF;
    v_items := v_items || jsonb_build_object(p_subject, v_subject_items);

    UPDATE public.morning_duty_logs
    SET missing_items = v_items,
        status = CASE WHEN status IN ('submitted', 'late') THEN 'missing' ELSE status END,
        updated_at = now()
    WHERE id = p_log_id;
  END IF;

  RETURN v_action;
END;
$$;

REVOKE ALL ON FUNCTION public.set_homework_makeup(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_homework_makeup(uuid, text, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
