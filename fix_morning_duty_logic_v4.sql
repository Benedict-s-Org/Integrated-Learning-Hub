-- V4 Fix: Bulletproof 2-step Revert and Add that ALWAYS fires

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
    v_reason            text;
BEGIN
    SELECT class INTO v_class FROM public.users WHERE id = p_student_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;
    IF NOT public.is_authorized_for_class(v_actor_id, v_class) THEN
        RAISE EXCEPTION 'Not authorized to manage logs for student in class %', v_class;
    END IF;

    -- Get current stored awarded amount (defaults to 0 if no record exists)
    SELECT COALESCE(coins_awarded, 0), COALESCE(handbook_written, false)
    INTO   v_current_awarded, v_current_handbook
    FROM   public.morning_duty_logs
    WHERE  student_id = p_student_id AND log_date = p_log_date;

    IF p_event_type IS NOT NULL THEN
        PERFORM set_config('app.morning_duty_event_type', p_event_type, true);
    END IF;

    -- Determine new target coins
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
        -- For 'absent' or any other status, target is 0
        v_target_coins := 0;
        v_reason       := 'Class Dashboard Revert';
    END IF;

    -- ONLY perform coin operations if the target has actually changed
    IF v_target_coins != v_current_awarded THEN
        
        -- STEP 1: ALWAYS revert the exact amount currently stored if it's > 0
        IF v_current_awarded > 0 THEN
            PERFORM public.increment_room_coins(
                p_student_id, 
                -v_current_awarded, 
                'Class Dashboard Revert', 
                v_actor_id, 
                NULL, 
                false
            );
        END IF;

        -- STEP 2: ALWAYS add the exact new target amount if it's > 0
        IF v_target_coins > 0 THEN
            PERFORM public.increment_room_coins(
                p_student_id, 
                v_target_coins, 
                v_reason, 
                v_actor_id, 
                NULL, 
                false
            );
        END IF;

    END IF;

    -- Upsert the log
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
        p_missing_items, v_target_coins, now()
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
        missing_items  = COALESCE(EXCLUDED.missing_items,  morning_duty_logs.missing_items),
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Force PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';
