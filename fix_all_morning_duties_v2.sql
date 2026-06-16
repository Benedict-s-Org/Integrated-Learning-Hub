-- COMPREHENSIVE FIX SCRIPT FOR MORNING DUTIES (V2)

-- 1. Ensure pgcrypto extension exists for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Drop existing morning duty logs to allow parameter changes
DROP FUNCTION IF EXISTS public.upsert_morning_duty_log(date, uuid, text, text, text, text, boolean, boolean, timestamp with time zone, text, jsonb, text) CASCADE;
DROP FUNCTION IF EXISTS public.upsert_morning_duty_log(date, uuid, text, text, text, text, boolean, boolean, timestamp with time zone, text, text) CASCADE;

-- 3. Re-create upsert_morning_duty_log with exact parameter defaults
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
    v_final_missing_items jsonb;
    v_current_english_items text[] := '{}';
    v_item_name         text;
    v_material_id       uuid;
BEGIN
    SELECT class INTO v_class FROM public.users WHERE id = p_student_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;
    IF NOT public.is_authorized_for_class(v_actor_id, v_class) THEN
        RAISE EXCEPTION 'Not authorized to manage logs for student in class %', v_class;
    END IF;

    SELECT coins_awarded, handbook_written
    INTO   v_current_awarded, v_current_handbook
    FROM   public.morning_duty_logs
    WHERE  student_id = p_student_id AND log_date = p_log_date;

    IF p_event_type IS NOT NULL THEN
        PERFORM set_config('app.morning_duty_event_type', p_event_type, true);
    END IF;

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
        v_target_coins := 0;
        v_reason       := 'Class Dashboard Revert';
    END IF;

    v_delta := v_target_coins - COALESCE(v_current_awarded, 0);

    IF v_delta != 0 THEN
        PERFORM public.increment_room_coins(
            p_student_id, v_delta, v_reason, v_actor_id, NULL, false
        );
    END IF;

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

GRANT EXECUTE ON FUNCTION public.upsert_morning_duty_log(date, uuid, text, text, text, text, boolean, boolean, timestamptz, text, jsonb, text) TO authenticated;

-- 4. Re-create PIN functions
CREATE OR REPLACE FUNCTION public.set_class_duty_pin(p_class text, p_pin text)
RETURNS void AS $$
DECLARE
    v_actor_id uuid := auth.uid();
BEGIN
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized to manage settings for class %', p_class;
    END IF;

    IF length(p_pin) < 4 OR length(p_pin) > 8 OR p_pin !~ '^\d+$' THEN
        RAISE EXCEPTION 'PIN must be between 4 and 8 digits';
    END IF;

    INSERT INTO public.class_admin_settings (class, duty_pin_hash, updated_at)
    VALUES (p_class, extensions.crypt(p_pin, extensions.gen_salt('bf')), now())
    ON CONFLICT (class) DO UPDATE SET 
        duty_pin_hash = EXCLUDED.duty_pin_hash,
        updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

CREATE OR REPLACE FUNCTION public.verify_class_duty_pin(p_class text, p_pin text)
RETURNS boolean AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_is_valid boolean;
BEGIN
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM public.class_admin_settings 
        WHERE class = p_class 
        AND duty_pin_hash = extensions.crypt(p_pin, duty_pin_hash)
    ) INTO v_is_valid;
    
    RETURN v_is_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

GRANT EXECUTE ON FUNCTION public.set_class_duty_pin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_class_duty_pin(text, text) TO authenticated;

-- 5. Fix negative increment amounts in increment_room_coins (Correctly matching production DB schema)
CREATE OR REPLACE FUNCTION public.increment_room_coins(
    target_user_id UUID,
    amount INTEGER,
    log_reason TEXT DEFAULT 'Gift',
    log_admin_id UUID DEFAULT auth.uid(),
    p_batch_id UUID DEFAULT NULL,
    p_skip_daily_count BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
DECLARE
    today_date_str TEXT;
    status_date DATE;
    current_counts JSONB;
    daily_real_count INTEGER;
    daily_real_amount INTEGER;
    is_answering_question BOOLEAN;
    current_morning_status TEXT;
    current_morning_date DATE;
    new_morning_status TEXT;
    is_virtual BOOLEAN := FALSE;
    final_amount INTEGER;
    display_amount_str TEXT;
BEGIN
    -- Initialize variables
    today_date_str := to_char(now() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD');
    status_date := (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE;
    is_answering_question := log_reason LIKE '%回答問題%';
    final_amount := amount;
    display_amount_str := CASE WHEN amount >= 0 THEN '+' || amount::TEXT ELSE amount::TEXT END;

    -- Ensure record exists
    INSERT INTO public.user_room_data (user_id, coins, virtual_coins, daily_counts, morning_status, last_morning_update)
    VALUES (target_user_id, 0, 0, '{}'::jsonb, 'todo', status_date - INTERVAL '1 day')
    ON CONFLICT (user_id) DO NOTHING;

    -- Get current state
    SELECT daily_counts, morning_status, last_morning_update 
    INTO current_counts, current_morning_status, current_morning_date
    FROM public.user_room_data
    WHERE user_id = target_user_id;

    -- Handle Morning Duties Daily Reset
    IF current_morning_date < status_date THEN
        new_morning_status := 'todo';
    ELSE
        new_morning_status := current_morning_status;
    END IF;

    -- Check if this specific call updates the status
    IF log_reason = '完成班務（交齊功課）' THEN
        new_morning_status := 'completed';
    ELSIF log_reason = '完成班務（欠功課）' OR log_reason LIKE '功課:%' THEN
        new_morning_status := 'review';
    ELSIF log_reason = '完成班務（寫手冊）' THEN
        new_morning_status := 'completed';
    ELSIF log_reason LIKE '%缺席%' OR log_reason ILIKE '%absent%' THEN
        new_morning_status := 'absent';
    END IF;

    -- Initialize daily counts
    IF (current_counts->>'date') = today_date_str THEN
        daily_real_count := COALESCE((current_counts->>'real_earned_count')::INTEGER, (current_counts->>'count')::INTEGER, 0);
        daily_real_amount := COALESCE((current_counts->>'real_earned_amount')::INTEGER, (current_counts->>'real_earned')::INTEGER, 0);
    ELSE
        daily_real_count := 0;
        daily_real_amount := 0;
    END IF;

    -- Logic for incrementing daily counts
    IF NOT p_skip_daily_count THEN
        IF amount > 0 THEN
            IF is_answering_question THEN
                -- ONLY answering questions has a limit of 3
                IF daily_real_count < 3 THEN
                    daily_real_count := daily_real_count + 1;
                    daily_real_amount := daily_real_amount + amount;
                ELSE
                    is_virtual := TRUE;
                    -- Virtual rewards do NOT increment daily_real_amount
                END IF;
            ELSE
                -- All other positive rewards (Helping Others, Homework, etc.) 
                -- contribute to total daily amount without affecting the "Answering Questions" count.
                daily_real_amount := daily_real_amount + amount;
            END IF;
        ELSE
            -- Negative amounts (reverts, penalties)
            -- Subtract from daily_real_amount to keep it accurate, preventing it from dropping below 0
            daily_real_amount := GREATEST(0, daily_real_amount + amount);
        END IF;
    END IF;

    -- Apply Updates
    IF is_virtual THEN
        UPDATE public.user_room_data
        SET virtual_coins = COALESCE(virtual_coins, 0) + final_amount,
            daily_counts = jsonb_build_object(
                'date', today_date_str, 
                'real_earned_count', daily_real_count, 
                'real_earned_amount', daily_real_amount
            ),
            morning_status = new_morning_status,
            last_morning_update = status_date,
            updated_at = NOW()
        WHERE user_id = target_user_id;
    ELSE
        UPDATE public.user_room_data
        SET coins = GREATEST(0, COALESCE(coins, 0) + final_amount),
            daily_counts = jsonb_build_object(
                'date', today_date_str, 
                'real_earned_count', daily_real_count, 
                'real_earned_amount', daily_real_amount
            ),
            morning_status = new_morning_status,
            last_morning_update = status_date,
            updated_at = NOW()
        WHERE user_id = target_user_id;
    END IF;

    -- Log transaction for audit
    INSERT INTO public.coin_transactions (user_id, amount, reason, created_by, batch_id)
    VALUES (
        target_user_id, 
        final_amount, 
        CASE WHEN is_virtual THEN log_reason || ' (Virtual)' ELSE log_reason END, 
        log_admin_id,
        p_batch_id
    );

    -- Log to student_records for unified progress log
    INSERT INTO public.student_records (student_id, type, message, coin_amount, created_by, is_virtual)
    VALUES (
        target_user_id,
        CASE WHEN amount >= 0 THEN 'positive' ELSE 'negative' END,
        log_reason || ' (' || display_amount_str || ')',
        final_amount,
        log_admin_id,
        is_virtual
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.increment_room_coins(UUID, INTEGER, TEXT, UUID, UUID, BOOLEAN) TO authenticated;

-- Force PostgREST schema cache to reload so the new function signature is instantly available
NOTIFY pgrst, 'reload schema';
