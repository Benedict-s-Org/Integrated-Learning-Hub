-- Create daily_homework table
CREATE TABLE IF NOT EXISTS public.daily_homework (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date date DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Hong_Kong'),
    class_name text NOT NULL,
    assignments jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(date, class_name)
);

-- Enable RLS
ALTER TABLE public.daily_homework ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
CREATE POLICY "Admins can manage daily_homework" ON public.daily_homework
    FOR ALL
    TO authenticated
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') OR 
        (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    )
    WITH CHECK (
        (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') OR 
        (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    );

CREATE POLICY "Anyone can read daily_homework" ON public.daily_homework
    FOR SELECT
    TO public
    USING (true);

-- Grant permissions
GRANT ALL ON public.daily_homework TO authenticated;
GRANT SELECT ON public.daily_homework TO anon;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.daily_homework
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
