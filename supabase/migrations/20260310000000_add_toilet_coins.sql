-- Add toilet_coins to user_room_data
ALTER TABLE public.user_room_data
ADD COLUMN IF NOT EXISTS toilet_coins integer DEFAULT 100;

-- Update existing records to have 100 toilet_coins if null
UPDATE public.user_room_data
SET toilet_coins = 100
WHERE toilet_coins IS NULL;
