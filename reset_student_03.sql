-- RESET STUDENT 03 (CLASS TEST) TO A CLEAN SLATE FOR TODAY

DO $$
DECLARE
    v_student_id uuid;
    v_today date := (now() AT TIME ZONE 'Asia/Hong_Kong')::date;
BEGIN
    -- 1. Get the ID for student 03 of Class test (case-insensitive for class name)
    SELECT id INTO v_student_id
    FROM public.users
    WHERE class ILIKE 'Class test' AND (class_number = '03' OR class_number = '3');

    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Student 03 not found in Class Test';
    END IF;

    -- 2. Reset their total coins and daily counts
    UPDATE public.user_room_data
    SET coins = 0,
        daily_counts = '{}'::jsonb,
        morning_status = 'todo'
    WHERE user_id = v_student_id;

    -- 3. Delete any buggy morning duty logs from today
    DELETE FROM public.morning_duty_logs
    WHERE student_id = v_student_id AND log_date = v_today;

    -- 4. Delete the buggy progress logs (student_records) from today
    DELETE FROM public.student_records
    WHERE student_id = v_student_id 
    AND created_at >= v_today::timestamp;

    -- 5. Delete coin transactions from today (if any)
    DELETE FROM public.coin_transactions
    WHERE user_id = v_student_id
    AND created_at >= v_today::timestamp;

END;
$$ LANGUAGE plpgsql;
