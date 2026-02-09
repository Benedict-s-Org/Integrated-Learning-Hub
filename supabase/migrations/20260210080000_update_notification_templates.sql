-- Add visual properties to notification_templates
ALTER TABLE public.notification_templates 
ADD COLUMN IF NOT EXISTS icon text DEFAULT 'MessageSquare',
ADD COLUMN IF NOT EXISTS color text DEFAULT 'text-blue-500 bg-blue-100';

-- Update existing templates with defaults if needed
UPDATE public.notification_templates 
SET icon = 'MessageSquare', color = 'text-blue-500 bg-blue-100' 
WHERE icon IS NULL;

-- Make student_id nullable in student_records to support "General/Admin" messages
ALTER TABLE public.student_records
ALTER COLUMN student_id DROP NOT NULL;

-- Add is_internal flag to student_records
ALTER TABLE public.student_records
ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false;

-- Add index for is_internal
CREATE INDEX IF NOT EXISTS idx_student_records_is_internal ON public.student_records(is_internal);

-- Update RLS for student_records to hide internal messages from students
DROP POLICY IF EXISTS "Students can view own records" ON public.student_records;

CREATE POLICY "Students can view own records" ON public.student_records
    FOR SELECT TO authenticated
    USING (
        auth.uid() = student_id AND is_internal = false
    );
