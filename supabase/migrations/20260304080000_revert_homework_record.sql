-- RPC to revert a student's homework record for today
-- This is used to allow "changing" a record by first clearing the old one.

CREATE OR REPLACE FUNCTION public.revert_homework_record(p_student_id UUID)
RETURNS VOID AS $$
DECLARE
    today_date_str TEXT;
    record_id UUID;
    record_amount INTEGER;
    record_message TEXT;
    orig_reason TEXT;
BEGIN
    today_date_str := to_char(now() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD');

    -- 1. Find the latest homework record for today in student_records
    -- We look for messages starting with the standard homework reasons or specific items format
    SELECT id, coin_amount, message INTO record_id, record_amount, record_message
    FROM public.student_records
    WHERE student_id = p_student_id
      AND (
          message LIKE '完成班務（交齊功課）%' 
          OR message LIKE '完成班務（欠功課）%' 
          OR message LIKE '功課:%'
      )
      AND created_at >= (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        -- 2. Update user_room_data: Reset morning_status and daily_counts
        -- Note: The subtraction from 'coins' is handled by the 'on_student_record_deleted' trigger 
        -- defined in 20260210100000_record_deletion_reversal.sql
        UPDATE public.user_room_data
        SET morning_status = 'todo',
            daily_counts = CASE 
                WHEN (daily_counts->>'date') = today_date_str THEN 
                    jsonb_set(
                        daily_counts, 
                        '{real_earned_amount}', 
                        ((COALESCE((daily_counts->>'real_earned_amount')::INTEGER, 0) - record_amount))::TEXT::JSONB
                    )
                ELSE daily_counts
            END,
            updated_at = NOW()
        WHERE user_id = p_student_id;

        -- 3. Extract the original reason to cleanup coin_transactions
        -- Remove the " (+XX)" suffix if present
        orig_reason := regexp_replace(record_message, ' \([+-]\d+\)$', '');

        -- 4. Delete from coin_transactions to keep it clean
        -- We find the most recent matching transaction for today
        DELETE FROM public.coin_transactions
        WHERE id = (
            SELECT id FROM public.coin_transactions
            WHERE user_id = p_student_id
              AND (reason = orig_reason OR reason = record_message)
              AND amount = record_amount
              AND created_at >= (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE
            ORDER BY created_at DESC
            LIMIT 1
        );

        -- 5. Finally, delete the student record (Triggers balance reversal)
        DELETE FROM public.student_records WHERE id = record_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
