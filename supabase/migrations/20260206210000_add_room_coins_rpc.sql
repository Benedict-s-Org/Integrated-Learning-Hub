-- Create RPC to increment coins in user_room_data
CREATE OR REPLACE FUNCTION increment_room_coins(target_user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_room_data
  SET coins = COALESCE(coins, 0) + amount
  WHERE user_id = target_user_id;
  
  -- Logic to handle cases where user might not have a record yet could go here if needed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
