-- Allow users to claim (update) empty plots
-- We allow update if the current owner is NULL
-- And we verify they set themselves as owner in the check
CREATE POLICY "Allow users to claim empty plots" 
ON public.region_plots 
FOR UPDATE 
USING (owner_id IS NULL)
WITH CHECK (owner_id = auth.uid());

-- Allow authenticated users to create public facilities (Admin MVP)
-- In a real app we'd check for specific admin role claims
CREATE POLICY "Allow authenticated users to create facilities" 
ON public.public_facilities 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update facilities (e.g. for simple config interactions if needed)
CREATE POLICY "Allow authenticated users to update facilities" 
ON public.public_facilities 
FOR UPDATE 
USING (auth.role() = 'authenticated');
