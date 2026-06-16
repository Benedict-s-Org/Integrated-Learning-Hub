-- Migration: Fix upsert_morning_duty_log duplicate overload
-- Description:
--   Problem A: An obsolete 11-arg overload coexists with the new 12-arg one.
--              The old overload has no coin logic and is picked up by ambiguous calls.
--   Problem B: In the 12-arg version, the 6 middle params have no DEFAULT, so the
--              teacher-console (5-arg) call site cannot resolve.
--              The ON CONFLICT path also overwrites reminded/made_up/made_up_at/notes
--              with EXCLUDED values instead of preserving them via COALESCE.
--
--   Fix:
--   1. CREATE OR REPLACE the 12-arg function with ALL params defaulting to NULL,
--      COALESCE on all preserved fields in ON CONFLICT, and COALESCE(bool, false)
--      in the INSERT path to honour NOT NULL columns.
--   2. DROP the obsolete 11-arg overload.
--   3. Re-grant EXECUTE on the surviving 12-arg function.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Redefine the surviving 12-arg function
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.upsert_morning_duty_log(
    date, uuid, text, text, text, text, boolean, boolean, timestamptz, text, text
);
DROP FUNCTION IF EXISTS public.upsert_morning_duty_log(
    date, uuid, text, text, text, text, boolean, boolean, timestamptz, text, jsonb, text
);

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
        -- COALESCE booleans so a NULL arg never violates NOT NULL columns
        COALESCE(p_reminded, false), COALESCE(p_made_up, false),
        p_made_up_at, p_notes,
        p_missing_items, v_target_coins, now()
    )
    ON CONFLICT (log_date, student_id) DO UPDATE SET
        status       = EXCLUDED.status,
        set_by       = EXCLUDED.set_by,
        -- Preserve existing values when the caller passes NULL
        snapshot_0830  = COALESCE(EXCLUDED.snapshot_0830,  morning_duty_logs.snapshot_0830),
        snapshot_0835  = COALESCE(EXCLUDED.snapshot_0835,  morning_duty_logs.snapshot_0835),
        reminded       = COALESCE(EXCLUDED.reminded,       morning_duty_logs.reminded),
        made_up        = COALESCE(EXCLUDED.made_up,        morning_duty_logs.made_up),
        made_up_at     = COALESCE(EXCLUDED.made_up_at,     morning_duty_logs.made_up_at),
        notes          = COALESCE(EXCLUDED.notes,          morning_duty_logs.notes),
        missing_items  = COALESCE(EXCLUDED.missing_items,  morning_duty_logs.missing_items),
        coins_awarded  = EXCLUDED.coins_awarded,
        -- Reset handbook status if moving away from 'missing'
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop the obsolete 11-arg overload (no coin logic)
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.upsert_morning_duty_log(
    date, uuid, text, text, text, text, boolean, boolean, timestamptz, text, text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Re-grant EXECUTE on the surviving overload
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.upsert_morning_duty_log(
    date, uuid, text, text, text, text, boolean, boolean, timestamptz, text, jsonb, text
) TO authenticated;
