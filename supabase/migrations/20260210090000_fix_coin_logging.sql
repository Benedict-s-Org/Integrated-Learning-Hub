-- Update increment_room_coins to support logging to both audit tables
CREATE OR REPLACE FUNCTION increment_room_coins(
    target_user_id UUID, 
    amount INTEGER,
    log_reason TEXT DEFAULT NULL,
    log_admin_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- 1. Update Balance
  UPDATE public.user_room_data
  SET coins = COALESCE(coins, 0) + amount
  WHERE user_id = target_user_id;

  -- 2. Log Activity (Historical Audit)
  IF log_reason IS NOT NULL THEN
    INSERT INTO public.coin_transactions (user_id, amount, reason, created_by)
    VALUES (target_user_id, amount, log_reason, log_admin_id);
    
    -- 3. Log to Student Records (For the new History UI)
    -- This ensures the data shows up in the "Performance" / "Notifications" tabs
    INSERT INTO public.student_records (student_id, type, message, created_by, is_internal)
    VALUES (
        target_user_id, 
        CASE WHEN amount >= 0 THEN 'positive' ELSE 'negative' END,
        log_reason,
        log_admin_id,
        false -- Student-facing messages from this RPC are usually public feedback
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
