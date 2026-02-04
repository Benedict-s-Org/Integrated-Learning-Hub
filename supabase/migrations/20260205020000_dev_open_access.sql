-- Allow anon access for local development / learning hub usage
-- This ensures that even if auth state is flaky or mocked, the features work

-- Region Plots: Allow anon to claim and update
CREATE POLICY "Enable update for anon"
ON public.region_plots
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Public Facilities: Allow anon to insert/update
CREATE POLICY "Enable insert for anon"
ON public.public_facilities
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Enable update for anon"
ON public.public_facilities
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
