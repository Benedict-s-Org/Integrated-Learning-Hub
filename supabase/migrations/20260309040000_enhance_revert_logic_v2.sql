-- Migration: Enhance revert_student_record with status reset and NULL safety
-- Path: supabase/migrations/20260309040000_enhance_revert_logic_v2.sql

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
    r_clean_message TEXT;
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

    -- NULL safety for amount
    r_amount := COALESCE(r_amount, 0);

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

    -- 3. Update daily counts and status if record was created today (HK time)
    r_hk_today := to_char(now() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD');
    r_record_date := to_char(r_created_at AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD');

    -- Base clean message (no coin suffix) for logic checks
    r_clean_message := regexp_replace(r_message, '\s\([+-]?\d+\)$', '');

    IF r_hk_today = r_record_date THEN
        -- A. Reset status for homework records
        IF r_clean_message = '完成班務（交齊功課）' 
           OR r_clean_message = '完成班務（欠功課）' 
           OR r_clean_message LIKE '功課:%'
        THEN
            UPDATE public.user_room_data
            SET morning_status = 'todo',
                updated_at = NOW()
            WHERE user_id = r_student_id;
        END IF;

        -- B. Update daily counts for real rewards
        IF NOT r_is_virtual THEN
            SELECT daily_counts INTO r_current_counts
            FROM public.user_room_data
            WHERE user_id = r_student_id;

            IF r_current_counts IS NOT NULL AND (r_current_counts->>'date') = r_hk_today THEN
                -- Calculate new amount
                r_new_real_amount := COALESCE((r_current_counts->>'real_earned_amount')::INTEGER, 0) - r_amount;
                IF r_new_real_amount < 0 THEN r_new_real_amount := 0; END IF;

                -- Calculate new count for 'Answering Questions'
                r_new_real_count := COALESCE((r_current_counts->>'real_earned_count')::INTEGER, 0);
                IF r_clean_message LIKE '%回答問題%' THEN
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
    END IF;

    -- 4. Mark record as reverted
    UPDATE public.student_records
    SET is_reverted = TRUE,
        reverted_at = NOW()
    WHERE id = p_record_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
