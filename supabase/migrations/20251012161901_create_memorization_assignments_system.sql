/*
  # Create Memorization Content Assignments System

  1. New Tables
    - `memorization_assignments`
      - `id` (uuid, primary key)
      - `content_id` (uuid, foreign key to saved_contents)
      - `user_id` (uuid, foreign key to users) - Student assigned
      - `assigned_by` (uuid, foreign key to users) - Admin who assigned it
      - `assigned_at` (timestamptz)
      - `due_date` (timestamptz, nullable) - Optional due date
      - `completed` (boolean) - Whether student has completed it
      - `completed_at` (timestamptz, nullable)
      - Unique constraint on (content_id, user_id)

  2. Security
    - Enable RLS on memorization_assignments table
    - Admins can create, read, update, and delete assignments
    - Students can read their own assignments
    - Students can update only the completed status of their own assignments

  3. Important Notes
    - Each student can only have one assignment per memorization content
    - Admins can assign the same content to multiple students
    - Deletion of content cascades to assignments
    - Students can mark assignments as complete
    - Due dates are optional for flexible assignment management
*/

-- Create memorization_assignments table
CREATE TABLE IF NOT EXISTS memorization_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES saved_contents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  due_date timestamptz,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(content_id, user_id)
);

-- Enable RLS
ALTER TABLE memorization_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for memorization_assignments

-- Admins can view all assignments
CREATE POLICY "Admins can view all assignments"
  ON memorization_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can create assignments
CREATE POLICY "Admins can create assignments"
  ON memorization_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can update assignments
CREATE POLICY "Admins can update assignments"
  ON memorization_assignments FOR UPDATE
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
CREATE POLICY "Admins can delete assignments"
  ON memorization_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Students can view their own assignments
CREATE POLICY "Students can view own assignments"
  ON memorization_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Students can update completion status of their own assignments
CREATE POLICY "Students can update own completion status"
  ON memorization_assignments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND completed IS NOT NULL
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_memorization_assignments_content_id ON memorization_assignments(content_id);
CREATE INDEX IF NOT EXISTS idx_memorization_assignments_user_id ON memorization_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_memorization_assignments_assigned_by ON memorization_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_memorization_assignments_user_completed ON memorization_assignments(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_memorization_assignments_due_date ON memorization_assignments(due_date);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_memorization_assignments_updated_at
  BEFORE UPDATE ON memorization_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to get assigned content with details
CREATE OR REPLACE FUNCTION get_user_assigned_memorizations(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  content_id uuid,
  title text,
  original_text text,
  selected_word_indices jsonb,
  assigned_at timestamptz,
  due_date timestamptz,
  completed boolean,
  completed_at timestamptz,
  assigned_by_username text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    ma.id,
    sc.id AS content_id,
    sc.title,
    sc.original_text,
    sc.selected_word_indices,
    ma.assigned_at,
    ma.due_date,
    ma.completed,
    ma.completed_at,
    u.username AS assigned_by_username
  FROM memorization_assignments ma
  JOIN saved_contents sc ON ma.content_id = sc.id
  JOIN users u ON ma.assigned_by = u.id
  WHERE ma.user_id = target_user_id
  ORDER BY
    CASE WHEN ma.completed THEN 1 ELSE 0 END,
    ma.due_date NULLS LAST,
    ma.assigned_at DESC;
$$;

-- Create function to get assignment statistics
CREATE OR REPLACE FUNCTION get_memorization_assignment_stats(target_content_id uuid)
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
  FROM memorization_assignments
  WHERE content_id = target_content_id;
$$;
