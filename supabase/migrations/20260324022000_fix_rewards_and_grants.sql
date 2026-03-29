
-- Add reward_coins column to spelling_practices and proofreading_practices
ALTER TABLE public.spelling_practices ADD COLUMN IF NOT EXISTS reward_coins integer DEFAULT 5;
ALTER TABLE public.proofreading_practices ADD COLUMN IF NOT EXISTS reward_coins integer DEFAULT 5;

-- Update existing records to 5 if null
UPDATE public.spelling_practices SET reward_coins = 5 WHERE reward_coins IS NULL;
UPDATE public.proofreading_practices SET reward_coins = 5 WHERE reward_coins IS NULL;

-- Grant EXECUTE on coin-awarding RPCs to authenticated role
GRANT EXECUTE ON FUNCTION public.increment_room_coins(UUID, integer, text, UUID, UUID, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_assignment_complete(UUID, text) TO authenticated;

-- Ensure is_admin is also executable (already granted but doubling checking)
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
