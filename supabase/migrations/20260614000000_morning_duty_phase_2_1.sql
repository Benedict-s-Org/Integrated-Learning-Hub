-- Migration: Morning Duty Phase 2.1
-- Description: Adds missing_items, lockout logic, class PIN settings, and coin delta reconciliations.

-- 1. Schema Updates
ALTER TABLE public.morning_duty_logs
    ADD COLUMN IF NOT EXISTS coins_awarded integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS handbook_written boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS handbook_written_at timestamptz,
    ADD COLUMN IF NOT EXISTS missing_items jsonb;

-- Update event_type enum for morning_duty_events (requires dropping and recreating check)
ALTER TABLE public.morning_duty_events DROP CONSTRAINT IF EXISTS morning_duty_events_event_type_check;
ALTER TABLE public.morning_duty_events ADD CONSTRAINT morning_duty_events_event_type_check 
    CHECK (event_type IN ('student_click', 'leader_confirm', 'marked_absent', 'makeup_submitted', 'alarm_fired', 'snapshot_0830', 'snapshot_0835', 'system_init', 'status_change', 'handbook_written', 'pin_failed', 'pin_unlocked'));

-- 2. New Admin Settings Table
CREATE TABLE IF NOT EXISTS public.class_admin_settings (
    class text PRIMARY KEY,
    duty_pin_hash text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.class_admin_settings ENABLE ROW LEVEL SECURITY;
-- Explicitly NO client policies - accessed only via SECURITY DEFINER.

-- 3. Functions
CREATE OR REPLACE FUNCTION public.set_class_duty_pin(p_class text, p_pin text)
RETURNS void AS $$
DECLARE
    v_actor_id uuid := auth.uid();
BEGIN
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized to manage settings for class %', p_class;
    END IF;

    -- Basic length validation
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

CREATE OR REPLACE FUNCTION public.has_class_duty_pin(p_class text)
RETURNS boolean AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_exists boolean;
BEGIN
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.class_admin_settings WHERE class = p_class) INTO v_exists;
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.unlock_pin_attempts(p_class text, p_admin_password text)
RETURNS boolean AS $$
DECLARE
    v_actor_id uuid := auth.uid();
BEGIN
    -- Only class_staff or admin can unlock
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Verify admin's login password
    IF NOT public.verify_password(v_actor_id, p_admin_password) THEN
        RETURN false;
    END IF;

    -- Insert pin_unlocked event
    INSERT INTO public.morning_duty_events (class, event_type, status_value, actor_id, created_at)
    VALUES (p_class, 'pin_unlocked', 'unlocked_by_admin', v_actor_id, now());

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.confirm_handbook_written(p_student_id uuid, p_pin text)
RETURNS text AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_class text;
    v_log_id uuid;
    v_status text;
    v_handbook_written boolean;
    v_coins_awarded integer;
    v_stored_hash text;
    v_failed_count integer;
    v_target_coins integer := 20;
    v_delta integer;
BEGIN
    -- Get student log info
    SELECT l.id, l.class, l.status, l.handbook_written, l.coins_awarded
    INTO v_log_id, v_class, v_status, v_handbook_written, v_coins_awarded
    FROM public.morning_duty_logs l
    WHERE l.student_id = p_student_id AND l.log_date = ((now() at time zone 'Asia/Hong_Kong')::date);

    IF NOT FOUND THEN RETURN 'no_log'; END IF;
    IF v_status != 'missing' THEN RETURN 'invalid_status'; END IF;
    IF v_handbook_written THEN RETURN 'already_written'; END IF;

    -- Check lockout (5 failures in 5 minutes since last unlock)
    SELECT COUNT(*) INTO v_failed_count 
    FROM public.morning_duty_events 
    WHERE class = v_class AND event_type = 'pin_failed' 
      AND created_at > now() - interval '5 minutes'
      AND created_at > COALESCE((SELECT MAX(created_at) FROM public.morning_duty_events WHERE class = v_class AND event_type = 'pin_unlocked'), '1970-01-01'::timestamptz);
      
    IF v_failed_count >= 5 THEN
        RETURN 'locked_out';
    END IF;

    -- Verify PIN
    SELECT duty_pin_hash INTO v_stored_hash FROM public.class_admin_settings WHERE class = v_class;
    IF v_stored_hash IS NULL THEN RETURN 'no_pin_set'; END IF;

    IF extensions.crypt(p_pin, v_stored_hash) != v_stored_hash THEN
        -- Log failure explicitly
        INSERT INTO public.morning_duty_events (log_id, student_id, class, event_type, status_value, actor_id, created_at)
        VALUES (v_log_id, p_student_id, v_class, 'pin_failed', 'wrong_pin', v_actor_id, now());
        RETURN 'wrong_pin';
    END IF;

    -- Success
    PERFORM set_config('app.morning_duty_event_type', 'handbook_written', true);
    
    -- Calculate delta and award
    v_delta := v_target_coins - COALESCE(v_coins_awarded, 0);
    IF v_delta != 0 THEN
        PERFORM public.increment_room_coins(
            p_student_id, v_delta, '完成班務（寫手冊）', v_actor_id, NULL, false
        );
    END IF;

    UPDATE public.morning_duty_logs 
    SET handbook_written = true, 
        handbook_written_at = now(),
        coins_awarded = v_target_coins,
        updated_at = now()
    WHERE id = v_log_id;

    RETURN 'success';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

-- Redefine upsert to handle missing_items and coin reconciliations
DROP FUNCTION IF EXISTS public.upsert_morning_duty_log(
    date, uuid, text, text, text, text, boolean, boolean, timestamptz, text, text
);
DROP FUNCTION IF EXISTS public.upsert_morning_duty_log(
    date, uuid, text, text, text, text, boolean, boolean, timestamptz, text, jsonb, text
);

CREATE OR REPLACE FUNCTION public.upsert_morning_duty_log(
    p_log_date date, p_student_id uuid, p_status text, p_set_by text,
    p_snapshot_0830 text, p_snapshot_0835 text, p_reminded boolean,
    p_made_up boolean, p_made_up_at timestamptz, p_notes text, 
    p_missing_items jsonb DEFAULT NULL, p_event_type text DEFAULT NULL
) RETURNS void AS $$
DECLARE 
    v_class text; 
    v_actor_id uuid := auth.uid();
    v_current_awarded integer := 0;
    v_current_handbook boolean := false;
    v_target_coins integer := 0;
    v_delta integer;
    v_reason text;
BEGIN
    SELECT class INTO v_class FROM public.users WHERE id = p_student_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;
    IF NOT public.is_authorized_for_class(v_actor_id, v_class) THEN
        RAISE EXCEPTION 'Not authorized to manage logs for student in class %', v_class;
    END IF;

    -- Get current coins_awarded and handbook status
    SELECT coins_awarded, handbook_written INTO v_current_awarded, v_current_handbook
    FROM public.morning_duty_logs
    WHERE student_id = p_student_id AND log_date = p_log_date;

    IF p_event_type IS NOT NULL THEN
        PERFORM set_config('app.morning_duty_event_type', p_event_type, true);
    END IF;

    -- Determine target coins
    IF p_status = 'submitted' THEN
        v_target_coins := 20;
        v_reason := '完成班務（交齊功課）';
    ELSIF p_status = 'missing' THEN
        IF v_current_handbook THEN
            v_target_coins := 20;
            v_reason := '完成班務（寫手冊）';
        ELSE
            v_target_coins := 10;
            v_reason := '完成班務（欠功課）';
        END IF;
    ELSIF p_status = 'absent' THEN
        v_target_coins := 0;
        v_reason := '缺席';
    ELSE
        v_target_coins := 0;
        v_reason := 'Class Dashboard Revert';
    END IF;

    v_delta := v_target_coins - COALESCE(v_current_awarded, 0);

    -- Increment coins if delta != 0
    IF v_delta != 0 THEN
        PERFORM public.increment_room_coins(
            p_student_id, v_delta, v_reason, v_actor_id, NULL, false
        );
    END IF;

    -- Upsert
    INSERT INTO public.morning_duty_logs (
        log_date, student_id, class, status, set_by, snapshot_0830, snapshot_0835, 
        reminded, made_up, made_up_at, notes, missing_items, coins_awarded, updated_at
    )
    VALUES (
        p_log_date, p_student_id, v_class, p_status, p_set_by, p_snapshot_0830, p_snapshot_0835, 
        p_reminded, p_made_up, p_made_up_at, p_notes, p_missing_items, v_target_coins, now()
    )
    ON CONFLICT (log_date, student_id) DO UPDATE SET
        status = EXCLUDED.status, 
        set_by = EXCLUDED.set_by,
        snapshot_0830 = COALESCE(EXCLUDED.snapshot_0830, morning_duty_logs.snapshot_0830),
        snapshot_0835 = COALESCE(EXCLUDED.snapshot_0835, morning_duty_logs.snapshot_0835),
        reminded = EXCLUDED.reminded, 
        made_up = EXCLUDED.made_up,
        made_up_at = EXCLUDED.made_up_at, 
        notes = EXCLUDED.notes, 
        missing_items = COALESCE(EXCLUDED.missing_items, morning_duty_logs.missing_items),
        coins_awarded = EXCLUDED.coins_awarded,
        -- Reset handbook status if moving away from missing
        handbook_written = CASE WHEN EXCLUDED.status != 'missing' THEN false ELSE morning_duty_logs.handbook_written END,
        handbook_written_at = CASE WHEN EXCLUDED.status != 'missing' THEN NULL ELSE morning_duty_logs.handbook_written_at END,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.set_class_duty_pin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_class_duty_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_pin_attempts(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_handbook_written(uuid, text) TO authenticated;
