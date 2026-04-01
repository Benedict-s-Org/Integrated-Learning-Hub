-- Migration: Restore 4D Toilet Coins and Revert Weekly Bonuses
-- Path: supabase/migrations/20260328000000_restore_4d_toilet_coins.sql

DO $$
DECLARE
    r RECORD;
    v_bonus_amount INTEGER;
    v_4d_student_ids UUID[];
BEGIN
    -- 1. Identify all students currently in Class 4D
    SELECT array_agg(id) INTO v_4d_student_ids
    FROM public.users
    WHERE class = '4D';

    IF v_4d_student_ids IS NULL OR array_length(v_4d_student_ids, 1) = 0 THEN
        RAISE NOTICE 'No students found in Class 4D. Skipping restoration.';
        RETURN;
    END IF;

    -- 2. Restore spent Toilet/Break coins (20 each)
    FOR r IN 
        SELECT id, student_id 
        FROM public.student_records 
        WHERE student_id = ANY(v_4d_student_ids)
          AND message = 'Toilet/Break'
          AND is_reverted = FALSE
    LOOP
        -- Add 20 back to toilet_coins
        UPDATE public.user_room_data
        SET toilet_coins = COALESCE(toilet_coins, 100) + 20,
            updated_at = NOW()
        WHERE user_id = r.student_id;

        -- Mark record as reverted
        UPDATE public.student_records
        SET is_reverted = TRUE,
            reverted_at = NOW()
        WHERE id = r.id;
        
        RAISE NOTICE 'Restored 20 toilet coins for student % (record %)', r.student_id, r.id;
    END LOOP;

    -- 3. Revert Weekly Toilet/Break Bonuses
    FOR r IN 
        SELECT id, student_id, message 
        FROM public.student_records 
        WHERE student_id = ANY(v_4d_student_ids)
          AND message LIKE 'Weekly Toilet/Break Bonus (+%)'
          AND is_reverted = FALSE
    LOOP
        -- Parse amount from message like 'Weekly Toilet/Break Bonus (+80)'
        -- Using substring with regex to get the numeric part
        BEGIN
            v_bonus_amount := substring(r.message from '\+(\d+)')::INTEGER;
            
            IF v_bonus_amount IS NOT NULL AND v_bonus_amount > 0 THEN
                -- Subtract from regular coins
                UPDATE public.user_room_data
                SET coins = GREATEST(0, COALESCE(coins, 0) - v_bonus_amount),
                    updated_at = NOW()
                WHERE user_id = r.student_id;

                -- Mark record as reverted
                UPDATE public.student_records
                SET is_reverted = TRUE,
                    reverted_at = NOW()
                WHERE id = r.id;
                
                RAISE NOTICE 'Reverted weekly bonus of % for student % (record %)', v_bonus_amount, r.student_id, r.id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not parse bonus amount from message: %. Skipping record %.', r.message, r.id;
        END;
    END LOOP;

    -- 4. Reset toilet_coins to 100 for all 4D students and disable logic effectively by UI
    UPDATE public.user_room_data
    SET toilet_coins = 100,
        updated_at = NOW()
    WHERE user_id = ANY(v_4d_student_ids);

END $$;
