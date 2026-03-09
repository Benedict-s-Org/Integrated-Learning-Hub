-- Migration: Add reversion support to student_records
-- Path: supabase/migrations/20260308000000_add_revert_support_to_records.sql

-- 1. Add new columns
ALTER TABLE public.student_records 
ADD COLUMN IF NOT EXISTS is_reverted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reverted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT FALSE;

-- 2. Create index for performance on the log views
CREATE INDEX IF NOT EXISTS idx_student_records_reverted ON public.student_records(is_reverted);
CREATE INDEX IF NOT EXISTS idx_student_records_created_at ON public.student_records(created_at DESC);

-- 3. Create the reversion RPC
CREATE OR REPLACE FUNCTION public.revert_student_record(p_record_id UUID)
RETURNS VOID AS $$
DECLARE
    r_student_id UUID;
    r_amount INTEGER;
    r_is_virtual BOOLEAN;
    r_is_reverted BOOLEAN;
BEGIN
    -- Get record details
    SELECT student_id, coin_amount, is_virtual, is_reverted 
    INTO r_student_id, r_amount, r_is_virtual, r_is_reverted
    FROM public.student_records
    WHERE id = p_record_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Record not found';
    END IF;

    IF r_is_reverted THEN
        RAISE EXCEPTION 'Record is already reverted';
    END IF;

    -- Update student balance
    IF r_is_virtual THEN
        UPDATE public.user_room_data
        SET virtual_coins = COALESCE(virtual_coins, 0) - r_amount,
            updated_at = NOW()
        WHERE user_id = r_student_id;
    ELSE
        UPDATE public.user_room_data
        SET coins = COALESCE(coins, 0) - r_amount,
            updated_at = NOW()
        WHERE user_id = r_student_id;
    END IF;

    -- Mark record as reverted
    UPDATE public.student_records
    SET is_reverted = TRUE,
        reverted_at = NOW()
    WHERE id = p_record_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create cleanup RPC for 30-day retention
CREATE OR REPLACE FUNCTION public.cleanup_old_reverted_records()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.student_records
    WHERE is_reverted = TRUE
      AND reverted_at < (NOW() - INTERVAL '30 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Redefine authoritative increment_room_coins to include student_records logging
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
        IF is_answering_question AND amount > 0 THEN
            IF daily_real_count < 3 THEN
                daily_real_count := daily_real_count + 1;
                daily_real_amount := daily_real_amount + amount;
            ELSE
                is_virtual := TRUE;
            END IF;
        ELSIF amount > 0 THEN
            daily_real_amount := daily_real_amount + amount;
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
