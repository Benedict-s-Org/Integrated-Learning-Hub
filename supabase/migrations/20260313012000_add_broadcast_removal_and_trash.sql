-- Add columns for Student Removal & Trash System to student_records
ALTER TABLE student_records 
ADD COLUMN IF NOT EXISTS broadcast_group_id UUID,
ADD COLUMN IF NOT EXISTS hidden_on_board BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_trash BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMP WITH TIME ZONE;

-- Add index for performance in grouping and filtering
CREATE INDEX IF NOT EXISTS idx_student_records_broadcast_group ON student_records(broadcast_group_id) WHERE broadcast_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_records_board_visibility ON student_records(hidden_on_board, is_trash);

-- Helper function to move a whole group to trash
CREATE OR REPLACE FUNCTION trash_broadcast_group(p_group_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE student_records
  SET is_trash = true,
      trashed_at = now()
  WHERE broadcast_group_id = p_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simple cleanup function to permanently delete old trashed records
CREATE OR REPLACE FUNCTION purge_old_trashed_broadcasts()
RETURNS void AS $$
BEGIN
  DELETE FROM student_records
  WHERE is_trash = true 
    AND trashed_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
