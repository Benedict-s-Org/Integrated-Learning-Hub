-- Add coins column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0;

-- Function to increment coins safely
CREATE OR REPLACE FUNCTION increment_coins(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_profiles
  SET coins = coins + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
