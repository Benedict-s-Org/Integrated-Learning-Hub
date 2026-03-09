CREATE OR REPLACE FUNCTION transfer_toilet_coins_weekly()
RETURNS void AS $$
DECLARE
    r RECORD;
    transfer_amount INTEGER;
    batch_uuid UUID;
BEGIN
    batch_uuid := gen_random_uuid();
    
    FOR r IN 
        SELECT user_id, toilet_coins 
        FROM public.user_room_data 
        WHERE toilet_coins > 0
    LOOP
        transfer_amount := r.toilet_coins;
        
        -- Add to regular coins and reset toilet_coins to 100
        UPDATE public.user_room_data
        SET coins = COALESCE(coins, 0) + transfer_amount,
            toilet_coins = 100,
            updated_at = NOW()
        WHERE user_id = r.user_id;

        -- Log transaction
        INSERT INTO public.coin_transactions (user_id, amount, reason, created_by, batch_id)
        VALUES (r.user_id, transfer_amount, 'Weekly Toilet/Break Transfer', NULL, batch_uuid);

        -- Log progress
        INSERT INTO public.student_records (student_id, type, message, created_by)
        VALUES (r.user_id, 'positive', 'Weekly Toilet/Break Bonus (+' || transfer_amount || ')', NULL);
    END LOOP;

    -- Reset users who are already at 0 or null back to 100
    UPDATE public.user_room_data
    SET toilet_coins = 100,
        updated_at = NOW()
    WHERE COALESCE(toilet_coins, 0) <= 0;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
