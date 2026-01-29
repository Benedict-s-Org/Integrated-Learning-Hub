/*
  # Create Memorization Assignments Table

  ## Overview
  This migration creates the missing memorization_assignments table that should track
  which memorization content is assigned to which students.

  ## Changes Made

  1. **New Table: memorization_assignments**
     - `id` (uuid, primary key)
     - `content_id` (uuid, references saved_contents)
     - `user_id` (uuid, references users) - Student assigned
     - `assigned_by` (uuid, references users) - Admin who assigned it
     - `assigned_at` (timestamptz)
     - `due_date` (timestamptz, nullable)
     - `completed` (boolean)
     - `completed_at` (timestamptz, nullable)
     - Unique constraint on (content_id, user_id)

  2. **Security**
     - Enable RLS
     - Admins can manage all assignments
     - Students can view and update their own assignments

  3. **Indexes**
     - Create performance indexes for common queries
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

-- Admins can view all assignments
CREATE POLICY "Admins can view all memorization assignments"
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
CREATE POLICY "Admins can create memorization assignments"
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
CREATE POLICY "Admins can update memorization assignments"
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
CREATE POLICY "Admins can delete memorization assignments"
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
CREATE POLICY "Students can view own memorization assignments"
  ON memorization_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Students can update completion status of their own assignments
CREATE POLICY "Students can update own memorization completion"
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

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_memorization_assignments_updated_at
  BEFORE UPDATE ON memorization_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();