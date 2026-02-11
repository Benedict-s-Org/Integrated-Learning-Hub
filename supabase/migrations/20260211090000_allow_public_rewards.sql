-- Allow public (anon + authenticated) to read class_rewards
-- This is necessary for the Guest Dashboard to display rewards/consequences

-- Drop the existing "Public read access" policy which was restricted to authenticated users
DROP POLICY IF EXISTS "Public read access" ON public.class_rewards;

-- Create new policy allowing 'public' (which includes anon)
CREATE POLICY "Allow public select"
ON public.class_rewards FOR SELECT
TO public
USING (true);
