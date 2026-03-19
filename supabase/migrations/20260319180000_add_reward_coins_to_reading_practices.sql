-- Add reward_coins to reading_practices
ALTER TABLE public.reading_practices ADD COLUMN IF NOT EXISTS reward_coins INTEGER DEFAULT 10;
