-- Create notification_templates table
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL CHECK (type IN ('positive', 'neutral', 'negative')),
    category text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- Enable RLS for notification_templates
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with templates
CREATE POLICY "Admins can manage notification_templates" ON public.notification_templates
    FOR ALL TO authenticated
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' OR 
        (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    );

-- Create student_records table
CREATE TABLE IF NOT EXISTS public.student_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid REFERENCES public.users(id) NOT NULL,
    type text NOT NULL CHECK (type IN ('positive', 'neutral', 'negative')),
    message text NOT NULL,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    is_read boolean DEFAULT false
);

-- Enable RLS for student_records
ALTER TABLE public.student_records ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with student_records
CREATE POLICY "Admins can manage student_records" ON public.student_records
    FOR ALL TO authenticated
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' OR 
        (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    );

-- Students can view their own records
CREATE POLICY "Students can view own records" ON public.student_records
    FOR SELECT TO authenticated
    USING (
        auth.uid() = student_id
    );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_records_student_id ON public.student_records(student_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON public.notification_templates(type);

-- Grant access to service_role (standard practice)
GRANT ALL ON TABLE public.notification_templates TO service_role;
GRANT ALL ON TABLE public.student_records TO service_role;
