-- Update increment_room_coins to handle "absent" status
CREATE OR REPLACE FUNCTION public.increment_room_coins(
    target_user_id UUID,
    amount INTEGER,
    log_reason TEXT DEFAULT 'Gift',
    log_admin_id UUID DEFAULT auth.uid()
)
RETURNS VOID AS $$
DECLARE
    new_status TEXT;
    status_date DATE := CURRENT_DATE;
BEGIN
    -- Ensure user has a record in user_room_data
    INSERT INTO public.user_room_data (user_id, coins, morning_status, last_morning_update)
    VALUES (target_user_id, 0, 'todo', CURRENT_DATE)
    ON CONFLICT (user_id) DO NOTHING;

    -- Determine if we need to update morning status
    -- Logic:
    -- 完成班務（交齊功課） -> 'completed'
    -- 完成班務（欠功課） -> 'review'
    -- 完成班務（寫手冊） -> 'completed'
    -- 缺席 or Absent -> 'absent'

    IF log_reason = '完成班務（交齊功課）' THEN
        new_status := 'completed';
    ELSIF log_reason = '完成班務（欠功課）' THEN
        new_status := 'review';
    ELSIF log_reason = '完成班務（寫手冊）' THEN
        new_status := 'completed';
    ELSIF log_reason LIKE '%缺席%' OR log_reason ILIKE '%absent%' THEN
        new_status := 'absent';
    END IF;

    -- Update coins and optionally morning status
    UPDATE public.user_room_data
    SET coins = COALESCE(coins, 0) + amount,
        updated_at = NOW(),
        morning_status = CASE 
            WHEN new_status IS NOT NULL THEN new_status 
            ELSE morning_status 
        END,
        last_morning_update = CASE 
            WHEN new_status IS NOT NULL THEN status_date
            ELSE last_morning_update 
        END
    WHERE user_id = target_user_id;

    -- Log transaction
    INSERT INTO public.coin_transactions (user_id, amount, reason, created_by)
    VALUES (target_user_id, amount, log_reason, log_admin_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
