-- Disable RLS if we need to
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create classes table
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Alter publication to include classes
ALTER PUBLICATION supabase_realtime ADD TABLE public.classes;

-- Setup RLS for classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Enable all access for admins" ON public.classes TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- Create activities table
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Alter publication to include activities
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;

-- Setup RLS for activities
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.activities FOR SELECT USING (true);
CREATE POLICY "Enable all access for admins" ON public.activities TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- Add ecas column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ecas text[] DEFAULT '{}'::text[];

-- Update the schema cache
NOTIFY pgrst, 'reload schema';
