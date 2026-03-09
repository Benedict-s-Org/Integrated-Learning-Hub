-- Migration: Restrict daily counts to Answering Questions only
-- Path: supabase/migrations/20260309133000_restrict_daily_count_to_answering_questions.sql

CREATE OR REPLACE FUNCTION public.increment_room_coins(
    target_user_id UUID,
    amount INTEGER,
    log_reason TEXT DEFAULT 'Gift',
    log_admin_id UUID DEFAULT auth.uid(),
    p_batch_id UUID DEFAULT NULL,
    p_skip_daily_count BOOLEAN DEFAULT FALSE
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
    display_amount_str TEXT;
BEGIN
    -- Initialize variables
    today_date_str := to_char(now() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD');
    status_date := (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE;
    is_answering_question := log_reason LIKE '%回答問題%';
    final_amount := amount;
    display_amount_str := CASE WHEN amount >= 0 THEN '+' || amount::TEXT ELSE amount::TEXT END;

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
    ELSIF log_reason = '完成班務（欠功課）' OR log_reason LIKE '功課:%' THEN
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

    -- Logic for incrementing daily counts
    IF NOT p_skip_daily_count THEN
        -- ONLY increment daily counts if it is Answering Questions
        IF is_answering_question AND amount > 0 THEN
            IF daily_real_count < 3 THEN
                daily_real_count := daily_real_count + 1;
                daily_real_amount := daily_real_amount + amount;
            ELSE
                is_virtual := TRUE;
            END IF;
        END IF;
    END IF;

    -- Apply Updates
    IF is_virtual THEN
        UPDATE public.user_room_data
        SET virtual_coins = COALESCE(virtual_coins, 0) + final_amount,
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

    -- Log transaction for audit
    INSERT INTO public.coin_transactions (user_id, amount, reason, created_by, batch_id)
    VALUES (
        target_user_id, 
        final_amount, 
        CASE WHEN is_virtual THEN log_reason || ' (Virtual)' ELSE log_reason END, 
        log_admin_id,
        p_batch_id
    );

    -- Log to student_records for unified progress log
    INSERT INTO public.student_records (student_id, type, message, coin_amount, created_by, is_virtual)
    VALUES (
        target_user_id,
        CASE WHEN amount >= 0 THEN 'positive' ELSE 'negative' END,
        log_reason || ' (' || display_amount_str || ')',
        final_amount,
        log_admin_id,
        is_virtual
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
