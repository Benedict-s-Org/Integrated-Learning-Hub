-- Comprehensive reward and status update function
-- This merges:
-- 1. Virtual coin logic for "回答問題" (max 3 real per day)
-- 2. Morning duties status tracking
-- 3. Absent student logic
-- 4. Transaction logging

CREATE OR REPLACE FUNCTION public.increment_room_coins(
    target_user_id UUID,
    amount INTEGER,
    log_reason TEXT DEFAULT 'Gift',
    log_admin_id UUID DEFAULT auth.uid()
)
RETURNS VOID AS $$
DECLARE
    today_date_str TEXT;
    status_date DATE;
    current_counts JSONB;
    daily_usage INTEGER;
    daily_real_earned INTEGER;
    is_answering_question BOOLEAN;
    new_morning_status TEXT;
    is_virtual BOOLEAN := FALSE;
    final_amount INTEGER;
BEGIN
    -- Initialize variables
    -- HK time for resets
    today_date_str := to_char(now() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD');
    status_date := (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE;
    is_answering_question := log_reason LIKE '%回答問題%';
    final_amount := amount;

    -- Ensure user has a record in user_room_data
    INSERT INTO public.user_room_data (user_id, coins, virtual_coins, daily_counts, morning_status, last_morning_update)
    VALUES (target_user_id, 0, 0, '{}'::jsonb, 'todo', status_date)
    ON CONFLICT (user_id) DO NOTHING;

    -- Get current counts and stats
    SELECT daily_counts, morning_status INTO current_counts, new_morning_status
    FROM public.user_room_data
    WHERE user_id = target_user_id;

    -- Initialize daily tracking
    IF (current_counts->>'date') = today_date_str THEN
        daily_usage := COALESCE((current_counts->>'count')::INTEGER, 0);
        daily_real_earned := COALESCE((current_counts->>'real_earned')::INTEGER, 0);
    ELSE
        daily_usage := 0;
        daily_real_earned := 0;
    END IF;

    -- Determine Morning Duties Status Update
    IF log_reason = '完成班務（交齊功課）' THEN
        new_morning_status := 'completed';
    ELSIF log_reason = '完成班務（欠功課）' THEN
        new_morning_status := 'review';
    ELSIF log_reason = '完成班務（寫手冊）' THEN
        new_morning_status := 'completed';
    ELSIF log_reason LIKE '%缺席%' OR log_reason ILIKE '%absent%' THEN
        new_morning_status := 'absent';
    END IF;

    -- Handle Reward Logic (Virtual vs Real)
    IF is_answering_question AND amount > 0 THEN
        IF daily_usage < 3 THEN
            -- Real Coins
            daily_real_earned := daily_real_earned + amount;
            UPDATE public.user_room_data
            SET coins = COALESCE(coins, 0) + final_amount,
                daily_counts = jsonb_build_object('date', today_date_str, 'count', daily_usage + 1, 'real_earned', daily_real_earned),
                morning_status = new_morning_status,
                last_morning_update = status_date,
                updated_at = NOW()
            WHERE user_id = target_user_id;
        ELSE
            -- Virtual Coins
            is_virtual := TRUE;
            UPDATE public.user_room_data
            SET virtual_coins = COALESCE(virtual_coins, 0) + final_amount,
                daily_counts = jsonb_build_object('date', today_date_str, 'count', daily_usage + 1, 'real_earned', daily_real_earned),
                morning_status = new_morning_status,
                last_morning_update = status_date,
                updated_at = NOW()
            WHERE user_id = target_user_id;
        END IF;
    ELSE
        -- Standard Coins update
        IF amount > 0 THEN
            daily_real_earned := daily_real_earned + amount;
        END IF;

        UPDATE public.user_room_data
        SET coins = COALESCE(coins, 0) + final_amount,
            daily_counts = jsonb_build_object('date', today_date_str, 'count', daily_usage, 'real_earned', daily_real_earned),
            morning_status = new_morning_status,
            last_morning_update = status_date,
            updated_at = NOW()
        WHERE user_id = target_user_id;
    END IF;

    -- Log transaction
    INSERT INTO public.coin_transactions (user_id, amount, reason, created_by)
    VALUES (
        target_user_id, 
        final_amount, 
        CASE WHEN is_virtual THEN log_reason || ' (Virtual)' ELSE log_reason END, 
        log_admin_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
