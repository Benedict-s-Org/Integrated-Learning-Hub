-- Migration: Update transfer_toilet_coins_weekly for Persistent Holiday Mode
-- This migration updates the logic to treat the entire week as holidays if holiday_mode is 'true'.

CREATE OR REPLACE FUNCTION transfer_toilet_coins_weekly()
RETURNS void AS $$
DECLARE
    r RECORD;
    transfer_amount INTEGER;
    batch_uuid UUID;
    v_holiday_count INTEGER;
    v_holiday_mode TEXT;
    v_manual_holidays JSONB;
    v_mon_date DATE;
    v_fri_date DATE;
BEGIN
    batch_uuid := gen_random_uuid();
    
    -- Get current Monday and Friday for this week (HK time)
    v_mon_date := (date_trunc('week', NOW() AT TIME ZONE 'Asia/Hong_Kong') + interval '0 days')::date;
    v_fri_date := (v_mon_date + interval '4 days')::date;

    -- Fetch holiday settings
    SELECT value INTO v_holiday_mode FROM public.system_config WHERE key = 'holiday_mode';
    SELECT COALESCE(value::jsonb, '[]'::jsonb) INTO v_manual_holidays FROM public.system_config WHERE key = 'manual_holiday_dates';

    -- Logic: We need to count how many holidays occurred during the week that just passed.
    -- Assuming this function is called on Monday morning (HK time) for the *previous* week.
    v_mon_date := v_mon_date - interval '7 days';
    v_fri_date := v_fri_date - interval '7 days';

    -- If global holiday mode is ON, we treat all 5 school days as holidays.
    IF v_holiday_mode = 'true' THEN
        v_holiday_count := 5;
    ELSE
        -- Simple count: for each day between mon and fri, is it a holiday?
        SELECT COUNT(*) INTO v_holiday_count
        FROM generate_series(v_mon_date, v_fri_date, '1 day'::interval) AS d
        WHERE v_manual_holidays ? d::date::text;
    END IF;

    -- Transfer logic for each user
    FOR r IN 
        SELECT user_id, toilet_coins 
        FROM public.user_room_data 
        WHERE toilet_coins > 0
    LOOP
        -- Proportional logic: Bonus = max(0, toilet_coins - (v_holiday_count * 20))
        -- If v_holiday_count is 5, then transfer_amount := GREATEST(0, r.toilet_coins - 100);
        -- Since toilet_coins starts at 100, this effectively means 0 coins deducted if they didn't use any extra.
        -- Wait, the logic is: transfer_amount is what they GET.
        -- If they have 100 coins and it's a 5-day holiday week, they get 100 - (5 * 20) = 0? 
        -- No, let's look at the original logic.
        -- "Bonus = max(0, toilet_coins - (v_holiday_count * 20))"
        -- If it's a normal 0-holiday week, they get toilet_coins - 0 = toilet_coins. (Full bonus)
        -- If it's a 5-day holiday week, they get toilet_coins - 100.
        -- If they have 100 coins, they get 0. 
        -- Oh! The logic seems to be: toilet_coins is a LIMIT that decreases.
        -- Wait, let's re-read the original migration.
        
        -- Original line 55: transfer_amount := GREATEST(0, r.toilet_coins - (v_holiday_count * 20));
        -- If toilet_coins starts at 100 and they use 20, they have 80.
        -- If v_holiday_count = 0, transfer_amount = 80. They get 80 coins.
        -- If v_holiday_count = 5 (all week holiday), transfer_amount = GREATEST(0, 80 - 100) = 0.
        -- This means they get NOTHING if it's a holiday week? That sounds WRONG.
        
        -- Usually, holiday means you DON'T deduct.
        -- If the user used toilet breaks during a holiday week, should they be penalized?
        -- Actually, if it's a holiday, they shouldn't even HAVE toilet coins deducted in the first place because they aren't at school.
        
        -- Wait, I should probably clarify the intent of `v_holiday_count * 20` deduction.
        -- Ah, I see: `toilet_coins` is a balance that starts at 100. Every break costs 20.
        -- If you DON'T take breaks, you have 100 at the end of the week.
        -- If you take 1 break, you have 80.
        -- The "Bonus" is what remains.
        -- BUT, if there are holidays, we expect you to have MORE remaining? No, that doesn't make sense.
        
        -- Let's rethink. If there are 2 holidays, there are only 3 school days.
        -- You are expected to have at least 40 coins left (because you didn't need them for 2 days)? No.
        
        -- Let's look at the comment: "adjust the weekly toilet bonus proportionally".
        -- If v_holiday_count = 1, then you get `toilet_coins - 20`? 
        -- This means if you have 100, you get 80. You LOST 20 coins because of the holiday? That's definitely not what "bonus" usually means.
        
        -- Wait, if the user said "proportionally calculate toilet break coin rewards", maybe the MAX you can get is lower?
        -- If there are 5 school days, max bonus is 100.
        -- If there are 3 school days, max bonus is 60.
        -- So `transfer_amount := GREATEST(0, r.toilet_coins - (v_holiday_count * 20))`
        -- If you have 100 coins (didn't use any) and there were 2 holidays:
        -- transfer_amount = 100 - (2 * 20) = 60.
        -- Yes, this matches "proportional". You get 60 coins instead of 100 because you only "earned" them for 3 days.
        
        -- So if it's a 5-day holiday week, you get 100 - 100 = 0.
        -- This makes sense. You don't get a "school attendance bonus" if there was no school.
        
        -- So my logic for `v_holiday_count := 5` is correct for the "long lasting" holiday mode.
        
        transfer_amount := GREATEST(0, r.toilet_coins - (v_holiday_count * 20));
        
        -- Add to regular coins and reset toilet_coins to 100
        UPDATE public.user_room_data
        SET coins = COALESCE(coins, 0) + transfer_amount,
            toilet_coins = 100,
            updated_at = NOW()
        WHERE user_id = r.user_id;

        -- Log transaction
        IF transfer_amount > 0 THEN
            INSERT INTO public.coin_transactions (user_id, amount, reason, created_by, batch_id)
            VALUES (r.user_id, transfer_amount, 'Weekly Toilet/Break Transfer', NULL, batch_uuid);

            -- Log progress
            INSERT INTO public.student_records (student_id, type, message, coin_amount, created_by)
            VALUES (r.user_id, 'positive', 'Weekly Toilet/Break Bonus (+' || transfer_amount || ')', transfer_amount, NULL);
        END IF;
    END LOOP;

    -- Reset users who are already at 0 or null back to 100
    UPDATE public.user_room_data
    SET toilet_coins = 100,
        updated_at = NOW()
    WHERE COALESCE(toilet_coins, 0) <= 0;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
