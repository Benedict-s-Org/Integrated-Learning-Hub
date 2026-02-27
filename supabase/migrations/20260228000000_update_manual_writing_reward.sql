-- Migration: Update Manual Writing Reward
-- Description: Updates the "完成班務（寫手冊）" reward to 10 coins and removes sub-options to ensure immediate reward behavior.

UPDATE public.class_rewards
SET coins = 10,
    sub_options = '{}'::jsonb
WHERE title = '完成班務（寫手冊）';
