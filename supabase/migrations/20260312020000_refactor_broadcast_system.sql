-- Add columns for robust broadcast categorization
ALTER TABLE public.student_records 
ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'log',
ADD COLUMN IF NOT EXISTS source text NULL,
ADD COLUMN IF NOT EXISTS target_classes text[] NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_records_type_created ON public.student_records (record_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_records_source_created ON public.student_records (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_records_target_classes ON public.student_records USING GIN (target_classes);

-- Backfill existing broadcast records
-- We identify them by the double pipe ' ||{' or at symbol ' @@{' markers
UPDATE public.student_records
SET 
    record_type = 'broadcast',
    source = 'broadcast_management',
    -- Extract target classes from @@{Class1, Class2} if present
    target_classes = CASE 
        WHEN message ~ ' @@\{([^}]*)\}' THEN 
            array_remove(string_to_array(substring(message from ' @@\{([^}]*)\}'), ', '), '')
        ELSE NULL 
    END
WHERE 
    message LIKE '% ||{%' OR 
    message LIKE '% @@{%';

-- Note: We don't remove the markers from the message text in this migration 
-- to avoid accidental data loss if the regex isn't perfect. 
-- The board logic will handle stripping them for display.
