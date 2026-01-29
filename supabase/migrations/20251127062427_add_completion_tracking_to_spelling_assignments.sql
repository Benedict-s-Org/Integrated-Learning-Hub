/*
  # Add Completion Tracking to Spelling Practice Assignments

  This migration enhances the practice_assignments table to track completion status,
  making it consistent with memorization and proofreading assignments.

  1. Changes to practice_assignments table
    - Add `completed` (boolean) - Whether assignment is completed
    - Add `completed_at` (timestamptz) - When assignment was completed
    - Add `due_date` (timestamptz) - Optional due date for assignment
    - Add `assigned_by` (uuid) - Admin who assigned it (for consistency)

  2. Updates
    - Add indexes for filtering and performance
    - Update RLS policies if needed
    - Add trigger for updated_at

  3. Important Notes
    - Existing assignments will have completed = false by default
    - Students can update completion status
    - Admins can manage all assignment properties
*/

-- Add new columns to practice_assignments table
DO $$
BEGIN
  -- Add completed column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'practice_assignments' AND column_name = 'completed'
  ) THEN
    ALTER TABLE practice_assignments ADD COLUMN completed boolean DEFAULT false;
  END IF;

  -- Add completed_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'practice_assignments' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE practice_assignments ADD COLUMN completed_at timestamptz;
  END IF;

  -- Add due_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'practice_assignments' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE practice_assignments ADD COLUMN due_date timestamptz;
  END IF;

  -- Add assigned_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'practice_assignments' AND column_name = 'assigned_by'
  ) THEN
    ALTER TABLE practice_assignments ADD COLUMN assigned_by uuid REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  -- Add updated_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'practice_assignments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE practice_assignments ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  -- Add created_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'practice_assignments' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE practice_assignments ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_practice_assignments_user_completed 
  ON practice_assignments(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_practice_assignments_due_date 
  ON practice_assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_practice_assignments_assigned_by 
  ON practice_assignments(assigned_by);

-- Drop existing policies before recreating
DROP POLICY IF EXISTS "Students can update own spelling completion" ON practice_assignments;
DROP POLICY IF EXISTS "Admins can update spelling assignments" ON practice_assignments;

-- Add policy for students to update completion status
CREATE POLICY "Students can update own spelling completion"
  ON practice_assignments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND completed IS NOT NULL
  );

-- Add policy for admins to update assignments
CREATE POLICY "Admins can update spelling assignments"
  ON practice_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create or replace trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_practice_assignments_updated_at ON practice_assignments;
CREATE TRIGGER update_practice_assignments_updated_at
  BEFORE UPDATE ON practice_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();