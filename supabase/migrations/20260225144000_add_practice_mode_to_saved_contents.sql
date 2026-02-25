-- Add practice_mode column to saved_contents table
ALTER TABLE saved_contents ADD COLUMN IF NOT EXISTS practice_mode text DEFAULT 'memorization';

-- Update RLS policies if necessary (usually not needed for a new column unless it affects access logic)
-- Existing policies use user_id which remains unchanged.
