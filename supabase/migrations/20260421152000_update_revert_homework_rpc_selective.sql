-- Migration to update revert_homework_record to be selective
-- This allows "sets" like (欠功課 + 寫手冊) to coexist.

CREATE OR REPLACE FUNCTION public.revert_homework_record(
    p_student_id UUID,
    p_new_reason TEXT DEFAULT 'all'
)
RETURNS VOID AS $$
DECLARE
    today_date_str TEXT;
    record_row RECORD;
    v_total_coins_to_revert INTEGER := 0;
    v_actor_id UUID := auth.uid();
BEGIN
    today_date_str := to_char(now() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD');

    -- 1. Loop through records that should be reverted based on the new reason
    FOR record_row IN 
        SELECT id, coin_amount, message 
        FROM public.student_records
        WHERE student_id = p_student_id
          AND (
              -- If 'all' or '完成班務（交齊功課）', revert EVERYTHING in the homework/handbook set
              (p_new_reason = 'all' OR p_new_reason = '完成班務（交齊功課）') AND (
                  message LIKE '完成班務（交齊功課）%' 
                  OR message LIKE '完成班務（欠功課）%' 
                  OR message LIKE '完成班務（寫手冊）%'
                  OR message LIKE '功課:%'
              )
              OR
              -- If homework status record, revert other status records AND '交齊功課' master record
              ((p_new_reason = '完成班務（欠功課）' OR p_new_reason LIKE '功課:%') AND (
                  message LIKE '完成班務（交齊功課）%' 
                  OR message LIKE '完成班務（欠功課）%' 
                  OR message LIKE '功課:%'
              ))
              OR
              -- If handbook record, revert other handbook records AND '交齊功課' master record
              (p_new_reason = '完成班務（寫手冊）' AND (
                  message LIKE '完成班務（交齊功課）%' 
                  OR message LIKE '完成班務（寫手冊）%'
              ))
          )
          AND created_at >= (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE
    LOOP
        v_total_coins_to_revert := v_total_coins_to_revert + record_row.coin_amount;
        
        -- 2. Delete from coin_transactions to keep it clean
        -- Find matching transactions for this record
        DELETE FROM public.coin_transactions
        WHERE user_id = p_student_id
          AND (reason = record_row.message OR reason = regexp_replace(record_row.message, ' \([+-]\d+\)$', ''))
          AND amount = record_row.coin_amount
          AND created_at >= (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE;

        -- 3. Delete the student record (trigger handles coin balance reversal)
        DELETE FROM public.student_records WHERE id = record_row.id;
    END LOOP;

    -- 4. Correct user_room_data: Reset morning_status if EVERYTHING was reverted
    -- Wait, if it was a partial revert, we might not want to reset morning_status to 'todo'.
    -- However, the frontend will update the status immediately after this RPC call.
    -- For safety, if we reverted '交齊功課', we definitely need to reset it.
    
    IF v_total_coins_to_revert != 0 THEN
        UPDATE public.user_room_data
        SET daily_counts = CASE 
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
