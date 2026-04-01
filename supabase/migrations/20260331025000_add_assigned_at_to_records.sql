-- Add assigned_at column to student_records
ALTER TABLE student_records ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;

-- Create an index for performance when filtering by assigned_at
CREATE INDEX IF NOT EXISTS idx_student_records_assigned_at ON student_records(assigned_at);

COMMENT ON COLUMN student_records.assigned_at IS 'The date the homework or task was assigned, separate from creation time.';
