/*
  # Create Proofreading Practices and Assignments System

  1. New Tables
    - `proofreading_practices`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users) - Admin who created it
      - `title` (text) - Practice title
      - `sentences` (jsonb) - Array of sentences for the practice
      - `answers` (jsonb) - Array of answer objects with lineNumber, wordIndex, correction
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `proofreading_practice_assignments`
      - `id` (uuid, primary key)
      - `practice_id` (uuid, foreign key to proofreading_practices)
      - `user_id` (uuid, foreign key to users) - Student assigned
      - `assigned_by` (uuid, foreign key to users) - Admin who assigned it
      - `assigned_at` (timestamptz)
      - `due_date` (timestamptz, nullable)
      - `completed` (boolean)
      - `completed_at` (timestamptz, nullable)
      - Unique constraint on (practice_id, user_id)

  2. Security
    - Enable RLS on both tables
    - Admins can create, read, update, and delete practices
    - Admins can create and manage all assignments
    - Students can read their own assignments
    - Students can update only the completed status of their assignments

  3. Updates to Existing Tables
    - Add `practice_id` column to proofreading_practice_results table

  4. Helper Functions
    - Function to get assigned practices with details for students
    - Function to get assignment statistics for admins

  5. Important Notes
    - Each student can only have one assignment per practice
    - Deletion of practice cascades to assignments
    - Results are linked to original practice for historical review
*/

-- Create proofreading_practices table
CREATE TABLE IF NOT EXISTS proofreading_practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  sentences jsonb NOT NULL,
  answers jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create proofreading_practice_assignments table
CREATE TABLE IF NOT EXISTS proofreading_practice_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES proofreading_practices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  due_date timestamptz,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(practice_id, user_id)
);

-- Enable RLS on proofreading_practices
ALTER TABLE proofreading_practices ENABLE ROW LEVEL SECURITY;

-- Enable RLS on proofreading_practice_assignments
ALTER TABLE proofreading_practice_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for proofreading_practices

-- Admins can view all practices
CREATE POLICY "Admins can view all practices"
  ON proofreading_practices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can create practices
CREATE POLICY "Admins can create practices"
  ON proofreading_practices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
    AND user_id = auth.uid()
  );

-- Admins can update their own practices
CREATE POLICY "Admins can update own practices"
  ON proofreading_practices FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can delete their own practices
CREATE POLICY "Admins can delete own practices"
  ON proofreading_practices FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Students can view practices assigned to them
CREATE POLICY "Students can view assigned practices"
  ON proofreading_practices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proofreading_practice_assignments
      WHERE proofreading_practice_assignments.practice_id = proofreading_practices.id
      AND proofreading_practice_assignments.user_id = auth.uid()
    )
  );

-- Policies for proofreading_practice_assignments

-- Admins can view all assignments
CREATE POLICY "Admins can view all proofreading assignments"
  ON proofreading_practice_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can create assignments
CREATE POLICY "Admins can create proofreading assignments"
  ON proofreading_practice_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can update assignments
CREATE POLICY "Admins can update proofreading assignments"
  ON proofreading_practice_assignments FOR UPDATE
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

-- Admins can delete assignments
CREATE POLICY "Admins can delete proofreading assignments"
  ON proofreading_practice_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Students can view their own assignments
CREATE POLICY "Students can view own proofreading assignments"
  ON proofreading_practice_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Students can update completion status of their own assignments
CREATE POLICY "Students can update own proofreading completion"
  ON proofreading_practice_assignments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND completed IS NOT NULL
  );

-- Add practice_id to proofreading_practice_results if column doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofreading_practice_results' AND column_name = 'practice_id'
  ) THEN
    ALTER TABLE proofreading_practice_results ADD COLUMN practice_id uuid REFERENCES proofreading_practices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add assignment_id to proofreading_practice_results if column doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofreading_practice_results' AND column_name = 'assignment_id'
  ) THEN
    ALTER TABLE proofreading_practice_results ADD COLUMN assignment_id uuid REFERENCES proofreading_practice_assignments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_proofreading_practices_user_id ON proofreading_practices(user_id);
CREATE INDEX IF NOT EXISTS idx_proofreading_practice_assignments_practice_id ON proofreading_practice_assignments(practice_id);
CREATE INDEX IF NOT EXISTS idx_proofreading_practice_assignments_user_id ON proofreading_practice_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_proofreading_practice_assignments_assigned_by ON proofreading_practice_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_proofreading_practice_assignments_user_completed ON proofreading_practice_assignments(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_proofreading_practice_results_practice_id ON proofreading_practice_results(practice_id);
CREATE INDEX IF NOT EXISTS idx_proofreading_practice_results_assignment_id ON proofreading_practice_results(assignment_id);

-- Create trigger to update updated_at timestamp for proofreading_practices
CREATE TRIGGER update_proofreading_practices_updated_at
  BEFORE UPDATE ON proofreading_practices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to update updated_at timestamp for proofreading_practice_assignments
CREATE TRIGGER update_proofreading_practice_assignments_updated_at
  BEFORE UPDATE ON proofreading_practice_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to get assigned proofreading practices with details
CREATE OR REPLACE FUNCTION get_user_assigned_proofreading_practices(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  practice_id uuid,
  title text,
  sentences jsonb,
  answers jsonb,
  assigned_at timestamptz,
  due_date timestamptz,
  completed boolean,
  completed_at timestamptz,
  assigned_by_username text,
  result_id uuid,
  accuracy_percentage numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    pa.id,
    pp.id AS practice_id,
    pp.title,
    pp.sentences,
    pp.answers,
    pa.assigned_at,
    pa.due_date,
    pa.completed,
    pa.completed_at,
    u.username AS assigned_by_username,
    pr.id AS result_id,
    pr.accuracy_percentage
  FROM proofreading_practice_assignments pa
  JOIN proofreading_practices pp ON pa.practice_id = pp.id
  JOIN users u ON pa.assigned_by = u.id
  LEFT JOIN proofreading_practice_results pr ON pr.assignment_id = pa.id
  WHERE pa.user_id = target_user_id
  ORDER BY
    CASE WHEN pa.completed THEN 1 ELSE 0 END,
    pa.due_date NULLS LAST,
    pa.assigned_at DESC;
$$;

-- Create function to get proofreading assignment statistics
CREATE OR REPLACE FUNCTION get_proofreading_assignment_stats(target_practice_id uuid)
RETURNS TABLE (
  total_assigned bigint,
  total_completed bigint,
  completion_rate numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    COUNT(*) AS total_assigned,
    COUNT(*) FILTER (WHERE completed = true) AS total_completed,
    CASE
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE completed = true)::numeric / COUNT(*)::numeric) * 100, 1)
      ELSE 0
    END AS completion_rate
  FROM proofreading_practice_assignments
  WHERE practice_id = target_practice_id;
$$;