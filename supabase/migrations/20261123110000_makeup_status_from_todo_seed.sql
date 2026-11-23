-- When Missing ledger seeds a todo duty row for English-only chips, makeup must:
--   - become missing when listed items remain after 補交
--   - become submitted when a todo/empty day is fully cleared (on-time hand-in)
--   - become late when a missing day is fully cleared (補交)

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
  v_assignments jsonb;
  v_status text;
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

    IF v_items = '{}'::jsonb THEN
      SELECT dh.assignments INTO v_assignments
      FROM public.daily_homework dh
      WHERE dh.class_name = v_log.class
        AND dh.date = v_log.log_date
      LIMIT 1;

      IF v_assignments IS NOT NULL AND jsonb_typeof(v_assignments) = 'object' THEN
        SELECT COALESCE(jsonb_object_agg(subj, names), '{}'::jsonb)
        INTO v_items
        FROM (
          SELECT subject AS subj,
                 jsonb_agg(to_jsonb(name) ORDER BY ord) AS names
          FROM (
            SELECT e.key AS subject,
                   CASE
                     WHEN jsonb_typeof(t.elem) = 'string' THEN nullif(btrim(t.elem #>> '{}'), '')
                     WHEN jsonb_typeof(t.elem) = 'object' THEN nullif(btrim(t.elem ->> 'name'), '')
                     ELSE NULL
                   END AS name,
                   t.ord
            FROM jsonb_each(v_assignments) AS e(key, value)
            CROSS JOIN LATERAL jsonb_array_elements(e.value) WITH ORDINALITY AS t(elem, ord)
            WHERE jsonb_typeof(e.value) = 'array'
          ) parsed
          WHERE name IS NOT NULL
          GROUP BY subject
        ) listed;
      END IF;

      -- Also ensure the clicked item exists so removing it is meaningful when
      -- daily_homework is empty or does not include this chip.
      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(v_items -> p_subject, '[]'::jsonb)) AS elem
        WHERE elem = p_item
      ) THEN
        v_items := v_items || jsonb_build_object(
          p_subject,
          COALESCE(v_items -> p_subject, '[]'::jsonb) || to_jsonb(p_item)
        );
      END IF;
    END IF;

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
    IF v_cleared THEN
      v_status := CASE
        -- 補交 from 欠 (or a late seed) stays late; on-time hand-in from todo → submitted.
        WHEN COALESCE(v_log.status, '') IN ('missing', 'late') THEN 'late'
        WHEN COALESCE(v_log.status, '') IN ('todo', '') THEN 'submitted'
        ELSE v_log.status
      END;
    ELSE
      v_status := 'missing';
    END IF;

    UPDATE public.morning_duty_logs
    SET missing_items = CASE WHEN v_cleared THEN NULL ELSE v_next END,
        status = v_status,
        updated_at = now()
    WHERE id = p_log_id;
  ELSE
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
