-- Create dashboard_shortcuts table
CREATE TABLE IF NOT EXISTS public.dashboard_shortcuts (
    name TEXT PRIMARY KEY,
    shortcuts JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for dashboard_shortcuts
ALTER TABLE public.dashboard_shortcuts ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read shortcuts
CREATE POLICY "Enable read access for all authenticated users" 
ON public.dashboard_shortcuts 
FOR SELECT 
TO authenticated 
USING (true);

-- Allow admins full access
CREATE POLICY "Enable all access for admins" 
ON public.dashboard_shortcuts 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role = 'admin'
    )
);

-- Realtime for dashboard_shortcuts
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_shortcuts;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
