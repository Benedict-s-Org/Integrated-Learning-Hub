-- Create class_timetables table
CREATE TABLE IF NOT EXISTS public.class_timetables (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    class_name text NOT NULL,
    lesson_number integer NOT NULL CHECK (lesson_number BETWEEN 1 AND 9),
    day_index integer NOT NULL CHECK (day_index BETWEEN 1 AND 6),
    subject text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(class_name, lesson_number, day_index)
);

-- Enable RLS
ALTER TABLE public.class_timetables ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.class_timetables
    FOR SELECT USING (true);

CREATE POLICY "Enable all access for admins" ON public.class_timetables
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_class_timetables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_class_timetables_updated_at
    BEFORE UPDATE ON public.class_timetables
    FOR EACH ROW
    EXECUTE FUNCTION update_class_timetables_updated_at();

-- Add this table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_timetables;
