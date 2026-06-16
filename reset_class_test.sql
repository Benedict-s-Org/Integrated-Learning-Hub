-- RESET ENTIRE "TEST" CLASS FOR TODAY TO ORIGINAL TODO STATE

DO $$
DECLARE
    v_today date := (now() AT TIME ZONE 'Asia/Hong_Kong')::date;
BEGIN
    -- 1. Reset all total coins, virtual coins, and daily counts for the entire class
    UPDATE public.user_room_data
    SET coins = 0,
        virtual_coins = 0,
        daily_counts = '{}'::jsonb,
        morning_status = 'todo'
    WHERE user_id IN (
        SELECT id FROM public.users WHERE class ILIKE 'Test'
    );

    -- 2. Delete ALL morning duty logs from today for the class
    DELETE FROM public.morning_duty_logs
    WHERE log_date = v_today
    AND student_id IN (
        SELECT id FROM public.users WHERE class ILIKE 'Test'
    );

    -- 3. Delete the progress logs (student_records) from today
    DELETE FROM public.student_records
    WHERE created_at >= v_today::timestamp
    AND student_id IN (
        SELECT id FROM public.users WHERE class ILIKE 'Test'
    );

    -- 4. Delete coin transactions from today (if any)
    DELETE FROM public.coin_transactions
    WHERE created_at >= v_today::timestamp
    AND user_id IN (
        SELECT id FROM public.users WHERE class ILIKE 'Test'
    );

END;
$$ LANGUAGE plpgsql;
