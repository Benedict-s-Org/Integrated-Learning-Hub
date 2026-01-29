/*
  # Add Assignment Tracking to Results Tables

  ## Overview
  This migration adds assignment tracking capabilities to practice results tables,
  enabling the system to properly track which practice and assignment each result belongs to.

  ## Changes Made

  1. **Spelling Practice Results**
     - Add `practice_id` column (references spelling_practices)
     - Add `assignment_id` column (references practice_assignments)

  2. **Memorization Results**
     - Add `assignment_id` column (references memorization_assignments)

  3. **Assignment Completion Function**
     - Create function to mark assignments as complete
     - Updates completed_at timestamp when student finishes

  ## Notes
  - Proofreading already has these columns from previous migration
  - All columns allow NULL for backward compatibility
  - RLS policies remain unchanged (inherited from table policies)
*/

-- Add tracking columns to spelling_practice_results
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spelling_practice_results' AND column_name = 'assignment_id'
  ) THEN
    ALTER TABLE spelling_practice_results ADD COLUMN assignment_id uuid REFERENCES practice_assignments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for spelling assignment tracking
CREATE INDEX IF NOT EXISTS idx_spelling_practice_results_assignment_id ON spelling_practice_results(assignment_id);

-- Add tracking columns to memorization_practice_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'memorization_practice_sessions' AND column_name = 'assignment_id'
  ) THEN
    ALTER TABLE memorization_practice_sessions ADD COLUMN assignment_id uuid REFERENCES memorization_assignments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for memorization assignment tracking
CREATE INDEX IF NOT EXISTS idx_memorization_practice_sessions_assignment_id ON memorization_practice_sessions(assignment_id);

-- Create function to mark assignment as complete
CREATE OR REPLACE FUNCTION mark_assignment_complete(
  p_assignment_id uuid,
  p_assignment_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Update the appropriate assignment table based on type
  IF p_assignment_type = 'spelling' THEN
    UPDATE practice_assignments
    SET 
      completed = true,
      completed_at = now()
    WHERE id = p_assignment_id
      AND user_id = v_user_id
      AND (completed = false OR completed IS NULL);
      
  ELSIF p_assignment_type = 'memorization' THEN
    UPDATE memorization_assignments
    SET 
      completed = true,
      completed_at = now()
    WHERE id = p_assignment_id
      AND user_id = v_user_id
      AND (completed = false OR completed IS NULL);
      
  ELSIF p_assignment_type = 'proofreading' THEN
    UPDATE proofreading_practice_assignments
    SET 
      completed = true,
      completed_at = now()
    WHERE id = p_assignment_id
      AND user_id = v_user_id
      AND (completed = false OR completed IS NULL);
      
  ELSE
    RAISE EXCEPTION 'Invalid assignment type: %', p_assignment_type;
  END IF;

  RETURN FOUND;
END;
$$;