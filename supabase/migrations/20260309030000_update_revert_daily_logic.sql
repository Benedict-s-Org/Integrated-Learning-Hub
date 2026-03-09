-- Migration: Update revert_student_record to handle daily_counts
-- Path: supabase/migrations/20260309030000_update_revert_daily_logic.sql

CREATE OR REPLACE FUNCTION public.revert_student_record(p_record_id UUID)
RETURNS VOID AS $$
DECLARE
    r_student_id UUID;
    r_amount INTEGER;
    r_is_virtual BOOLEAN;
    r_is_reverted BOOLEAN;
    r_message TEXT;
    r_created_at TIMESTAMPTZ;
    r_hk_today TEXT;
    r_record_date TEXT;
    r_current_counts JSONB;
    r_new_real_amount INTEGER;
    r_new_real_count INTEGER;
BEGIN
    -- 1. Get record details
    SELECT student_id, coin_amount, is_virtual, is_reverted, message, created_at 
    INTO r_student_id, r_amount, r_is_virtual, r_is_reverted, r_message, r_created_at
    FROM public.student_records
    WHERE id = p_record_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Record not found';
    END IF;

    IF r_is_reverted THEN
        RAISE EXCEPTION 'Record is already reverted';
    END IF;

    -- 2. Update total student balance
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

    -- 3. Update daily counts if record was created today (HK time)
    r_hk_today := to_char(now() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD');
    r_record_date := to_char(r_created_at AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD');

    IF NOT r_is_virtual AND r_hk_today = r_record_date THEN
        SELECT daily_counts INTO r_current_counts
        FROM public.user_room_data
        WHERE user_id = r_student_id;

        IF r_current_counts IS NOT NULL AND (r_current_counts->>'date') = r_hk_today THEN
            -- Calculate new amount
            r_new_real_amount := COALESCE((r_current_counts->>'real_earned_amount')::INTEGER, 0) - r_amount;
            IF r_new_real_amount < 0 THEN r_new_real_amount := 0; END IF;

            -- Calculate new count for 'Answering Questions'
            r_new_real_count := COALESCE((r_current_counts->>'real_earned_count')::INTEGER, 0);
            IF r_message LIKE '%回答問題%' THEN
                r_new_real_count := r_new_real_count - 1;
                IF r_new_real_count < 0 THEN r_new_real_count := 0; END IF;
            END IF;

            -- Apply update to daily_counts
            UPDATE public.user_room_data
            SET daily_counts = jsonb_build_object(
                    'date', r_hk_today,
                    'real_earned_count', r_new_real_count,
                    'real_earned_amount', r_new_real_amount
                ),
                updated_at = NOW()
            WHERE user_id = r_student_id;
        END IF;
    END IF;

    -- 4. Mark record as reverted
    UPDATE public.student_records
    SET is_reverted = TRUE,
        reverted_at = NOW()
    WHERE id = p_record_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
