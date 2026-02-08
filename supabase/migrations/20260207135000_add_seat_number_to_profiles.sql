-- Add seat_number to user_profiles to support manual reordering within classes
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS seat_number integer;

-- Update existing users to have a seat_number based on their creation order if not set
-- (Optional, but good for initial state)
WITH ranked_users AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY COALESCE((SELECT class FROM users WHERE users.id = user_profiles.id), 'none') ORDER BY created_at ASC) as rank
  FROM public.user_profiles
)
UPDATE public.user_profiles
SET seat_number = ranked_users.rank
FROM ranked_users
WHERE user_profiles.id = ranked_users.id AND user_profiles.seat_number IS NULL;
