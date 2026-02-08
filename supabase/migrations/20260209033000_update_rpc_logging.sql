-- Update increment_room_coins to support logging
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

  -- 2. Log Activity (if reason provided)
  IF log_reason IS NOT NULL THEN
    INSERT INTO public.coin_transactions (user_id, amount, reason, created_by)
    VALUES (target_user_id, amount, log_reason, log_admin_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
