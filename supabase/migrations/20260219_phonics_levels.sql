-- Add level column to phonics_sounds for level-based filtering
ALTER TABLE phonics_sounds ADD COLUMN IF NOT EXISTS level integer DEFAULT 1;
