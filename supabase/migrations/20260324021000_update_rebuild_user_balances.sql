-- Migration: Update rebuild_user_balances to include practice progress
-- Path: supabase/migrations/20260324021000_update_rebuild_user_balances.sql

CREATE OR REPLACE FUNCTION public.rebuild_user_balances(p_user_id UUID DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    r RECORD;
    v_today_str TEXT;
BEGIN
    -- Set timezone for consistent string conversion
    v_today_str := to_char(now() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD');

    -- 1. Reset balances for targeted users
    -- We reset everything to 0 and then reconstruct from history and progress records.
    UPDATE public.user_room_data
    SET coins = 0,
        virtual_coins = 0,
        daily_counts = jsonb_build_object(
            'date', v_today_str, 
            'real_earned_count', 0, 
            'real_earned_amount', 0
        ),
        updated_at = NOW()
    WHERE (p_user_id IS NULL OR user_id = p_user_id);

    -- 2. Process all non-reverted manual student_records
    -- (These include toilet deductions, manual awards, etc.)
    -- This is now the ONLY source of truth for coin balances.
    FOR r IN (
        SELECT 
            student_id, 
            coin_amount, 
            is_virtual, 
            message,
            to_char(created_at AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD') as record_date
        FROM public.student_records
        WHERE (p_user_id IS NULL OR student_id = p_user_id)
          AND is_reverted = FALSE
        ORDER BY created_at ASC
    ) LOOP
        IF r.is_virtual THEN
            UPDATE public.user_room_data 
            SET virtual_coins = COALESCE(virtual_coins, 0) + r.coin_amount 
            WHERE user_id = r.student_id;
        ELSE
            UPDATE public.user_room_data 
            SET coins = COALESCE(coins, 0) + r.coin_amount 
            WHERE user_id = r.student_id;
            
            -- Update daily counts for today
            IF r.record_date = v_today_str AND r.coin_amount > 0 THEN
                UPDATE public.user_room_data
                SET daily_counts = jsonb_set(
                    daily_counts,
                    '{real_earned_amount}',
                    (COALESCE((daily_counts->>'real_earned_amount')::INTEGER, 0) + r.coin_amount)::TEXT::jsonb
                )
                WHERE user_id = r.student_id;
            END IF;
        END IF;
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
