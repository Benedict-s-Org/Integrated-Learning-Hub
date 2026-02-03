-- Comprehensive Repair migration for Memorization System

-- 1. Ensure memorization_assignments table exists (Student view)
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

-- 2. Ensure memorization_practice_sessions exists (Tracking history)
CREATE TABLE IF NOT EXISTS memorization_practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id uuid REFERENCES saved_contents(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES memorization_assignments(id) ON DELETE SET NULL,
  title text NOT NULL,
  original_text text NOT NULL,
  total_words integer NOT NULL DEFAULT 0,
  hidden_words_count integer NOT NULL DEFAULT 0,
  session_duration_seconds integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE memorization_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorization_practice_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Policies for memorization_assignments
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Admins can view all memorization assignments" ON memorization_assignments;
    CREATE POLICY "Admins can view all memorization assignments"
      ON memorization_assignments FOR SELECT
      TO authenticated
      USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

    DROP POLICY IF EXISTS "Admins can create memorization assignments" ON memorization_assignments;
    CREATE POLICY "Admins can create memorization assignments"
      ON memorization_assignments FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

    DROP POLICY IF EXISTS "Admins can update memorization assignments" ON memorization_assignments;
    CREATE POLICY "Admins can update memorization assignments"
      ON memorization_assignments FOR UPDATE
      TO authenticated
      USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

    DROP POLICY IF EXISTS "Admins can delete memorization assignments" ON memorization_assignments;
    CREATE POLICY "Admins can delete memorization assignments"
      ON memorization_assignments FOR DELETE
      TO authenticated
      USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

    DROP POLICY IF EXISTS "Students can view own memorization assignments" ON memorization_assignments;
    CREATE POLICY "Students can view own memorization assignments"
      ON memorization_assignments FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());

    DROP POLICY IF EXISTS "Students can update own memorization completion" ON memorization_assignments;
    CREATE POLICY "Students can update own memorization completion"
      ON memorization_assignments FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
END $$;

-- 5. Policies for memorization_practice_sessions
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view own memorization sessions" ON memorization_practice_sessions;
    CREATE POLICY "Users can view own memorization sessions"
      ON memorization_practice_sessions FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());

    DROP POLICY IF EXISTS "Users can insert own memorization sessions" ON memorization_practice_sessions;
    CREATE POLICY "Users can insert own memorization sessions"
      ON memorization_practice_sessions FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS "Admins can view all memorization sessions" ON memorization_practice_sessions;
    CREATE POLICY "Admins can view all memorization sessions"
      ON memorization_practice_sessions FOR SELECT
      TO authenticated
      USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
END $$;

-- 6. Grant basic permissions
GRANT ALL ON TABLE memorization_practice_sessions TO postgres, service_role, authenticated;
GRANT ALL ON TABLE memorization_assignments TO postgres, service_role, authenticated;

-- 7. Ensure indexes
CREATE INDEX IF NOT EXISTS idx_mem_asgn_content_repair ON memorization_assignments(content_id);
CREATE INDEX IF NOT EXISTS idx_mem_asgn_user_repair ON memorization_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_mem_sess_user_repair ON memorization_practice_sessions(user_id);
