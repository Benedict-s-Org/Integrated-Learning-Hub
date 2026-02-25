-- Migration: Update Homework Reward Coins
-- Description: Updates the "完成班務（交齊功課）" reward to 20 coins to match the new logic.

UPDATE public.class_rewards
SET coins = 20
WHERE title = '完成班務（交齊功課）';
