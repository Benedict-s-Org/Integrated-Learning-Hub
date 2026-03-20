/*
  # Fix Progress Tracking Columns and RLS

  1. Changes
    - Add missing `assignment_id` and `is_srs` columns to `spelling_practice_results`
    - Add missing `assignment_id` and `practice_id` columns to `proofreading_practice_results`
    - Add missing `assignment_id` column to `memorization_practice_sessions`
    - Update RLS policies to allow admins to insert practice results for any user
    - Add indexes for the new columns

  2. Purpose
    - Fixes the issue where progress tracking data fails to save due to missing columns
    - Enables proper progress tracking for assigned homework
    - Allows admins to correctly record and view progress when using "User View" (impersonation)
*/

-- 1. Fix spelling_practice_results
DO $$
BEGIN
  -- Add assignment_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spelling_practice_results' AND column_name = 'assignment_id'
  ) THEN
    ALTER TABLE spelling_practice_results ADD COLUMN assignment_id uuid REFERENCES practice_assignments(id) ON DELETE CASCADE;
  END IF;

  -- Add is_srs if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spelling_practice_results' AND column_name = 'is_srs'
  ) THEN
    ALTER TABLE spelling_practice_results ADD COLUMN is_srs boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_spelling_results_assignment_id ON spelling_practice_results(assignment_id);

-- 2. Fix proofreading_practice_results
DO $$
BEGIN
  -- Add assignment_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofreading_practice_results' AND column_name = 'assignment_id'
  ) THEN
    ALTER TABLE proofreading_practice_results ADD COLUMN assignment_id uuid REFERENCES proofreading_practice_assignments(id) ON DELETE CASCADE;
  END IF;

  -- Add practice_id if it doesn't exist (should be added by previous migrations, but ensuring)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofreading_practice_results' AND column_name = 'practice_id'
  ) THEN
    ALTER TABLE proofreading_practice_results ADD COLUMN practice_id uuid REFERENCES proofreading_practices(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proofreading_results_assignment_id ON proofreading_practice_results(assignment_id);
CREATE INDEX IF NOT EXISTS idx_proofreading_results_practice_id ON proofreading_practice_results(practice_id);

-- 3. Fix memorization_practice_sessions
DO $$
BEGIN
  -- Add assignment_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'memorization_practice_sessions' AND column_name = 'assignment_id'
  ) THEN
    ALTER TABLE memorization_practice_sessions ADD COLUMN assignment_id uuid REFERENCES memorization_assignments(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_memorization_sessions_assignment_id ON memorization_practice_sessions(assignment_id);

-- 4. Update RLS Policies to allow Admin Impersonation

-- Spelling
DROP POLICY IF EXISTS "Admins can insert any spelling results" ON spelling_practice_results;
CREATE POLICY "Admins can insert any spelling results"
  ON spelling_practice_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Proofreading
DROP POLICY IF EXISTS "Admins can insert any proofreading results" ON proofreading_practice_results;
CREATE POLICY "Admins can insert any proofreading results"
  ON proofreading_practice_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Memorization
DROP POLICY IF EXISTS "Admins can insert any memorization sessions" ON memorization_practice_sessions;
CREATE POLICY "Admins can insert any memorization sessions"
  ON memorization_practice_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
