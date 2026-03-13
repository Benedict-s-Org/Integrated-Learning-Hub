-- Make student_id nullable to support consolidated whole-class broadcasts
ALTER TABLE public.student_records 
ALTER COLUMN student_id DROP NOT NULL;

-- Add a check constraint to ensure data integrity
-- Either student_id must be present OR it must be a broadcast/audit log
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_student_id_or_broadcast'
    ) THEN
        ALTER TABLE public.student_records
        ADD CONSTRAINT check_student_id_or_broadcast 
        CHECK (student_id IS NOT NULL OR record_type = 'broadcast');
    END IF;
END $$;
