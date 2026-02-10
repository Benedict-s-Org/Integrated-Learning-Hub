-- Add seat_number to users to support manual reordering within classes
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS seat_number integer;

-- Update existing users to have a seat_number based on their creation order if not set
-- (Optional, but good for initial state)
WITH ranked_users AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY COALESCE((SELECT class FROM users WHERE users.id = users.id), 'none') ORDER BY created_at ASC) as rank
  FROM public.users
)
UPDATE public.users
SET seat_number = ranked_users.rank
FROM ranked_users
WHERE users.id = ranked_users.id AND users.seat_number IS NULL;
