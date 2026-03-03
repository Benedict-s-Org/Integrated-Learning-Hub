-- Ultimate Comprehensive Reward Function Fix
-- Addresses:
-- 1. Morning Duties daily reset (yesterday's status no longer carries over incorrectly)
-- 2. p_batch_id support for Undo functionality
-- 3. Standardized daily_counts fields (real_earned_count, real_earned_amount)

CREATE OR REPLACE FUNCTION public.increment_room_coins(
    target_user_id UUID,
    amount INTEGER,
    log_reason TEXT DEFAULT 'Gift',
    log_admin_id UUID DEFAULT auth.uid(),
    p_batch_id UUID DEFAULT NULL
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
BEGIN
    -- Initialize variables
    -- HK time for resets
    today_date_str := to_char(now() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD');
    status_date := (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE;
    is_answering_question := log_reason LIKE '%回答問題%';
    final_amount := amount;

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
    ELSIF log_reason = '完成班務（欠功課）' THEN
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

    -- Handle Reward Logic
    IF is_answering_question AND amount > 0 THEN
        IF daily_real_count < 3 THEN
            -- Real Reward
            daily_real_count := daily_real_count + 1;
            daily_real_amount := daily_real_amount + amount;
            
            UPDATE public.user_room_data
            SET coins = COALESCE(coins, 0) + final_amount,
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
            -- Virtual Reward
            is_virtual := TRUE;
            UPDATE public.user_room_data
            SET virtual_coins = COALESCE(virtual_coins, 0) + final_amount,
                daily_counts = jsonb_build_object(
                    'date', today_date_str, 
                    'real_earned_count', daily_real_count, -- maintains count 
                    'real_earned_amount', daily_real_amount
                ),
                morning_status = new_morning_status,
                last_morning_update = status_date,
                updated_at = NOW()
            WHERE user_id = target_user_id;
        END IF;
    ELSE
        -- Standard Reward/Correction
        IF amount > 0 THEN
            daily_real_amount := daily_real_amount + amount;
        END IF;

        UPDATE public.user_room_data
        SET coins = COALESCE(coins, 0) + final_amount,
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

    -- Log transaction with optional batch_id
    INSERT INTO public.coin_transactions (user_id, amount, reason, created_by, batch_id)
    VALUES (
        target_user_id, 
        final_amount, 
        CASE WHEN is_virtual THEN log_reason || ' (Virtual)' ELSE log_reason END, 
        log_admin_id,
        p_batch_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
