-- Create table for persistent homework problem options
CREATE TABLE IF NOT EXISTS public.homework_problem_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    category TEXT, -- NULL means it's a flat top-level option
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(category, label)
);

-- Enable RLS
ALTER TABLE public.homework_problem_options ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read options
CREATE POLICY "Allow authenticated to read homework options" 
ON public.homework_problem_options FOR SELECT 
TO authenticated 
USING (true);

-- Allow admins to manage options
CREATE POLICY "Allow admins to insert homework options" 
ON public.homework_problem_options FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin')
    )
);

CREATE POLICY "Allow admins to delete homework options" 
ON public.homework_problem_options FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin')
    )
);

-- Update schema cache
NOTIFY pgrst, 'reload schema';
