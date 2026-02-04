-- Fix permissions and RLS for district map tables
-- This migration ensures both RLS policies AND strict table permissions are set correctly

-- 1. Ensure RLS is enabled
ALTER TABLE public.region_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_facilities ENABLE ROW LEVEL SECURITY;

-- 2. Explicitly GRANT permissions to roles
-- authenticated: needs full access for claimed plots and facilities (in this MVP)
GRANT ALL ON TABLE public.regions TO authenticated;
GRANT ALL ON TABLE public.region_plots TO authenticated;
GRANT ALL ON TABLE public.public_facilities TO authenticated;
-- GRANT USAGE, SELECT ON SEQUENCE public.regions_id_seq TO authenticated; -- Removed as it uses UUID

-- anon: read-only
GRANT SELECT ON TABLE public.regions TO anon;
GRANT SELECT ON TABLE public.region_plots TO anon;
GRANT SELECT ON TABLE public.public_facilities TO anon;

-- 3. Clean up existing potential conflict policies
DROP POLICY IF EXISTS "Allow users to claim empty plots" ON public.region_plots;
DROP POLICY IF EXISTS "Allow users to update their own plots" ON public.region_plots;
DROP POLICY IF EXISTS "Allow authenticated users to create facilities" ON public.public_facilities;
DROP POLICY IF EXISTS "Allow authenticated users to update facilities" ON public.public_facilities;
DROP POLICY IF EXISTS "Allow authenticated users to create facilities" ON public.public_facilities;

-- 4. Define robust RLS policies

-- Region Plots:
-- Allow reading by everyone (already exists: "Allow public read access...")
-- Allow claiming: UPDATE where owner_id IS NULL -> owner_id = auth.uid()
-- Allow updating own: UPDATE where owner_id = auth.uid()

CREATE POLICY "Enable update for owners and claimers"
ON public.region_plots
FOR UPDATE
TO authenticated
USING (
    owner_id IS NULL                   -- Case 1: Claiming an empty plot
    OR 
    owner_id = auth.uid()              -- Case 2: Updating own plot
)
WITH CHECK (
    owner_id = auth.uid()              -- Result must be owned by the user
);

-- Public Facilities:
-- Allow reading by everyone (already exists)
-- Allow creating by any authenticated user (for MVP functionality)
CREATE POLICY "Enable insert for authenticated users"
ON public.public_facilities
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow updating by any authenticated user (for MVP functionality, e.g. upgrading)
CREATE POLICY "Enable update for authenticated users"
ON public.public_facilities
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow deleting by authenticated users? (Maybe restriction needed, but allowing for now for admin usage)
CREATE POLICY "Enable delete for authenticated users"
ON public.public_facilities
FOR DELETE
TO authenticated
USING (true);
