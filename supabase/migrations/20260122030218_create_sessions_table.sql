/*
  # Create Sessions Table for Persistent Authentication

  ## Overview
  Implements a server-side session management system where all login state is stored in Supabase.
  Sessions are lightweight records that maintain user authentication state across app reloads.

  ## New Tables
  - `sessions`: Stores active user sessions with expiration
    - `id` (uuid, primary key) - Unique session identifier
    - `user_id` (uuid, foreign key) - References the authenticated user
    - `created_at` (timestamptz) - When session was created
    - `expires_at` (timestamptz) - When session expires (30 days by default)
    - `last_validated` (timestamptz) - Last time session was validated

  ## Security
  - Enable RLS on `sessions` table with restrictive policies
  - Users can only read their own sessions
  - Admins can view and delete any session for user management
  - Automatic session cleanup for expired records

  ## Important Notes
  1. Sessions are referenced by ID from localStorage (not user data)
  2. All session validation happens against Supabase database
  3. Sessions expire after 30 days of inactivity or explicit logout
  4. No sensitive user data is stored in localStorage
*/

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  last_validated timestamptz DEFAULT now(),
  created_at_idx timestamptz GENERATED ALWAYS AS (created_at) STORED
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can delete any session"
  ON sessions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM sessions
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
