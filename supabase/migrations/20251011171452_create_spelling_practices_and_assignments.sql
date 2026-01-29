/*
  # Create Spelling Practices and Assignments System

  1. New Tables
    - `spelling_practices`
      - `id` (uuid, primary key)
      - `title` (text) - Name of the practice
      - `words` (text[]) - Array of spelling words
      - `created_by` (uuid, foreign key to users) - Admin who created it
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `practice_assignments`
      - `id` (uuid, primary key)
      - `practice_id` (uuid, foreign key to spelling_practices)
      - `user_id` (uuid, foreign key to users)
      - `assigned_at` (timestamptz)
      - Unique constraint on (practice_id, user_id)

  2. Security
    - Enable RLS on both tables
    - Admins can create, read, update, and delete practices
    - Admins can manage assignments
    - Users can only read practices assigned to them
    - Users can only read their own assignments

  3. Important Notes
    - Practices can be assigned to multiple users
    - Each user can only have one assignment per practice
    - Deletion of a practice cascades to assignments
*/

-- Create spelling_practices table
CREATE TABLE IF NOT EXISTS spelling_practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  words text[] NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create practice_assignments table
CREATE TABLE IF NOT EXISTS practice_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES spelling_practices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(practice_id, user_id)
);

-- Enable RLS
ALTER TABLE spelling_practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for spelling_practices

-- Admins can do everything with practices
CREATE POLICY "Admins can view all practices"
  ON spelling_practices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can create practices"
  ON spelling_practices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update practices"
  ON spelling_practices FOR UPDATE
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

CREATE POLICY "Admins can delete practices"
  ON spelling_practices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Users can view practices assigned to them
CREATE POLICY "Users can view assigned practices"
  ON spelling_practices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM practice_assignments
      WHERE practice_assignments.practice_id = spelling_practices.id
      AND practice_assignments.user_id = auth.uid()
    )
  );

-- Policies for practice_assignments

-- Admins can manage all assignments
CREATE POLICY "Admins can view all assignments"
  ON practice_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can create assignments"
  ON practice_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete assignments"
  ON practice_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Users can view their own assignments
CREATE POLICY "Users can view own assignments"
  ON practice_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_spelling_practices_created_by ON spelling_practices(created_by);
CREATE INDEX IF NOT EXISTS idx_practice_assignments_practice_id ON practice_assignments(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_assignments_user_id ON practice_assignments(user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_spelling_practices_updated_at
  BEFORE UPDATE ON spelling_practices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();