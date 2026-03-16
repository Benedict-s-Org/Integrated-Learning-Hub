-- RPC to revert ALL of a student's homework/handbook records for today
-- This is used to allow "changing" a record by first clearing all old ones.

CREATE OR REPLACE FUNCTION public.revert_homework_record(p_student_id UUID)
RETURNS VOID AS $$
DECLARE
    today_date_str TEXT;
    record_row RECORD;
    v_total_coins_to_revert INTEGER := 0;
    v_actor_id UUID := auth.uid();
BEGIN
    today_date_str := to_char(now() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD');

    -- 1. Loop through all homework/handbook records for today and sum their coins
    FOR record_row IN 
        SELECT id, coin_amount, message 
        FROM public.student_records
        WHERE student_id = p_student_id
          AND (
              message LIKE '完成班務（交齊功課）%' 
              OR message LIKE '完成班務（欠功課）%' 
              OR message LIKE '完成班務（寫手冊）%'
              OR message LIKE '功課:%'
          )
          AND created_at >= (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE
    LOOP
        v_total_coins_to_revert := v_total_coins_to_revert + record_row.coin_amount;
        
        -- 2. Delete from coin_transactions to keep it clean
        -- We find matching transactions for this record
        DELETE FROM public.coin_transactions
        WHERE user_id = p_student_id
          AND (reason = record_row.message OR reason = regexp_replace(record_row.message, ' \([+-]\d+\)$', ''))
          AND amount = record_row.coin_amount
          AND created_at >= (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE;

        -- 3. Delete the student record (The trigger on_student_record_deleted handles basic coin reversal)
        DELETE FROM public.student_records WHERE id = record_row.id;
    END LOOP;

    -- 4. Correct user_room_data: Reset morning_status and daily_counts
    -- The trigger already subtracted record_row.coin_amount from 'coins'.
    -- Here we only need to adjust the jsonb 'real_earned_amount' in daily_counts.
    IF v_total_coins_to_revert != 0 THEN
        UPDATE public.user_room_data
        SET morning_status = 'todo',
            daily_counts = CASE 
                WHEN (daily_counts->>'date') = today_date_str THEN 
                    jsonb_set(
                        daily_counts, 
                        '{real_earned_amount}', 
                        ((COALESCE((daily_counts->>'real_earned_amount')::INTEGER, 0) - v_total_coins_to_revert))::TEXT::JSONB
                    )
                ELSE daily_counts
            END,
            updated_at = NOW()
        WHERE user_id = p_student_id;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
