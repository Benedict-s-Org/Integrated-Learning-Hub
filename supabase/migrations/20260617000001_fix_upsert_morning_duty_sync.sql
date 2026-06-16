-- ─────────────────────────────────────────────────────────────────────────────
-- Fix upsert_morning_duty_log missing_items clear and sync reconcile block
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_morning_duty_log(
    p_log_date       date,
    p_student_id     uuid,
    p_status         text,
    p_set_by         text,
    p_snapshot_0830  text        DEFAULT NULL,
    p_snapshot_0835  text        DEFAULT NULL,
    p_reminded       boolean     DEFAULT NULL,
    p_made_up        boolean     DEFAULT NULL,
    p_made_up_at     timestamptz DEFAULT NULL,
    p_notes          text        DEFAULT NULL,
    p_missing_items  jsonb       DEFAULT NULL,
    p_event_type     text        DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_class             text;
    v_actor_id          uuid    := auth.uid();
    v_current_awarded   integer := 0;
    v_current_handbook  boolean := false;
    v_target_coins      integer := 0;
    v_delta             integer;
    v_reason            text;
    
    -- Sync variables
    v_final_missing_items jsonb;
    v_item_name text;
    v_material_id uuid;
    v_current_english_items text[] := '{}';
BEGIN
    -- Resolve class and authorise
    SELECT class INTO v_class FROM public.users WHERE id = p_student_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;
    IF NOT public.is_authorized_for_class(v_actor_id, v_class) THEN
        RAISE EXCEPTION 'Not authorized to manage logs for student in class %', v_class;
    END IF;

    -- Read existing coin and handbook state (for delta calculation)
    SELECT coins_awarded, handbook_written
    INTO   v_current_awarded, v_current_handbook
    FROM   public.morning_duty_logs
    WHERE  student_id = p_student_id AND log_date = p_log_date;

    -- Propagate event type into session config for downstream triggers
    IF p_event_type IS NOT NULL THEN
        PERFORM set_config('app.morning_duty_event_type', p_event_type, true);
    END IF;

    -- ── Coin target logic ────────────────────────────────────────────────────
    IF p_status = 'submitted' THEN
        v_target_coins := 20;
        v_reason       := '完成班務（交齊功課）';
    ELSIF p_status = 'missing' THEN
        IF v_current_handbook THEN
            v_target_coins := 20;
            v_reason       := '完成班務（寫手冊）';
        ELSE
            v_target_coins := 10;
            v_reason       := '完成班務（欠功課）';
        END IF;
    ELSE
        -- absent / todo / any other value → no coins
        v_target_coins := 0;
        v_reason       := 'Class Dashboard Revert';
    END IF;

    v_delta := v_target_coins - COALESCE(v_current_awarded, 0);

    IF v_delta != 0 THEN
        PERFORM public.increment_room_coins(
            p_student_id, v_delta, v_reason, v_actor_id, NULL, false
        );
    END IF;

    -- ── Upsert ───────────────────────────────────────────────────────────────
    INSERT INTO public.morning_duty_logs (
        log_date, student_id, class, status, set_by,
        snapshot_0830, snapshot_0835,
        reminded, made_up, made_up_at, notes,
        missing_items, coins_awarded, updated_at
    )
    VALUES (
        p_log_date, p_student_id, v_class, p_status, p_set_by,
        p_snapshot_0830, p_snapshot_0835,
        COALESCE(p_reminded, false), COALESCE(p_made_up, false),
        p_made_up_at, p_notes,
        CASE WHEN p_status = 'missing' THEN p_missing_items ELSE NULL END, 
        v_target_coins, now()
    )
    ON CONFLICT (log_date, student_id) DO UPDATE SET
        status       = EXCLUDED.status,
        set_by       = EXCLUDED.set_by,
        snapshot_0830  = COALESCE(EXCLUDED.snapshot_0830,  morning_duty_logs.snapshot_0830),
        snapshot_0835  = COALESCE(EXCLUDED.snapshot_0835,  morning_duty_logs.snapshot_0835),
        reminded       = COALESCE(EXCLUDED.reminded,       morning_duty_logs.reminded),
        made_up        = COALESCE(EXCLUDED.made_up,        morning_duty_logs.made_up),
        made_up_at     = COALESCE(EXCLUDED.made_up_at,     morning_duty_logs.made_up_at),
        notes          = COALESCE(EXCLUDED.notes,          morning_duty_logs.notes),
        missing_items  = CASE 
                             WHEN EXCLUDED.status = 'missing' THEN EXCLUDED.missing_items
                             ELSE NULL
                         END,
        coins_awarded  = EXCLUDED.coins_awarded,
        handbook_written    = CASE
                                  WHEN EXCLUDED.status != 'missing' THEN false
                                  ELSE morning_duty_logs.handbook_written
                              END,
        handbook_written_at = CASE
                                  WHEN EXCLUDED.status != 'missing' THEN NULL
                                  ELSE morning_duty_logs.handbook_written_at
                              END,
        updated_at = now();

    -- ── Sync English Homework ──────────────────────────────────────────────────
    SELECT missing_items INTO v_final_missing_items 
    FROM public.morning_duty_logs 
    WHERE log_date = p_log_date AND student_id = p_student_id;

    -- 1. Wipe clean all existing English records for this student today, regardless of status
    DELETE FROM public.english_submissions es
    USING public.english_materials em
    WHERE es.material_id = em.id
      AND es.student_id = p_student_id
      AND es.record_date = p_log_date
      AND em.subject = 'English';

    -- 2. Re-insert the current missing English items from JSON
    IF v_final_missing_items ? '英文' THEN
        FOR v_item_name IN SELECT jsonb_array_elements_text(v_final_missing_items->'英文') LOOP
            SELECT id INTO v_material_id FROM public.english_materials WHERE name = v_item_name AND subject = 'English' AND is_active = true;
            IF FOUND THEN
                INSERT INTO public.english_submissions (student_id, material_id, record_date, class, status)
                VALUES (p_student_id, v_material_id, p_log_date, v_class, 'missing');
            END IF;
        END LOOP;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
