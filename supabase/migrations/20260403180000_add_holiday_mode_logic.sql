-- Migration: Update system_config and transfer_toilet_coins_weekly for Holiday Mode
-- This migration adds holiday tracking and adjusts the weekly toilet bonus proportionally.

-- 1. Ensure keys exist in system_config
INSERT INTO public.system_config (key, value)
VALUES 
  ('holiday_mode', 'false'),
  ('manual_holiday_dates', '[]')
ON CONFLICT (key) DO NOTHING;

-- 2. Update transfer_toilet_coins_weekly to handle holidays
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
    -- The previous week's Monday was 7 days ago.
    v_mon_date := v_mon_date - interval '7 days';
    v_fri_date := v_fri_date - interval '7 days';

    -- Simple count: for each day between mon and fri, is it a holiday?
    -- For now, we only use manual_holiday_dates stored in system_config.
    -- (Notion sync should push holidays here or we should query them if possible)
    
    SELECT COUNT(*) INTO v_holiday_count
    FROM generate_series(v_mon_date, v_fri_date, '1 day'::interval) AS d
    WHERE v_manual_holidays ? d::date::text;

    -- Transfer logic for each user
    FOR r IN 
        SELECT user_id, toilet_coins 
        FROM public.user_room_data 
        WHERE toilet_coins > 0
    LOOP
        -- Proportional logic: Bonus = max(0, toilet_coins - (v_holiday_count * 20))
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
