-- RESET ENTIRE "TEST" CLASS TO ORIGINAL TODO STATE (NUKES ALL HISTORY)

DO $$
BEGIN


    -- 2. Delete ALL morning duty logs for the class
    DELETE FROM public.morning_duty_logs
    WHERE student_id IN (
        SELECT id FROM public.users WHERE class ILIKE 'Test'
    );

    -- 3. Delete ALL progress logs (student_records) for the class
    DELETE FROM public.student_records
    WHERE student_id IN (
        SELECT id FROM public.users WHERE class ILIKE 'Test'
    );

    -- 4. Delete ALL coin transactions for the class
    DELETE FROM public.coin_transactions
    WHERE user_id IN (
        SELECT id FROM public.users WHERE class ILIKE 'Test'
    );

    -- 5. Delete ALL daily homework for the class
    DELETE FROM public.daily_homework
    WHERE class_name ILIKE 'Test';

    -- 6. Delete ALL English homework tracker records for the class
    DELETE FROM public.english_submissions
    WHERE student_id IN (
        SELECT id FROM public.users WHERE class ILIKE 'Test'
    );

    -- 7. Reset all total coins, virtual coins, and daily counts AT THE VERY END
    -- This ensures any triggers (like on_student_record_deleted) that subtract coins
    -- run before we forcefully set the balance back to 0.
    UPDATE public.user_room_data
    SET coins = 0,
        virtual_coins = 0,
        daily_counts = '{}'::jsonb,
        morning_status = 'todo'
    WHERE user_id IN (
        SELECT id FROM public.users WHERE class ILIKE 'Test'
    );

END;
$$ LANGUAGE plpgsql;
