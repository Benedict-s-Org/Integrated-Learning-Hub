/*
  # Create Student Progress Tracking System

  1. New Tables
    - `spelling_practice_results`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users) - Student who completed the practice
      - `practice_id` (uuid, nullable, foreign key to spelling_practices) - Link to assigned practice if applicable
      - `title` (text) - Title of the practice
      - `words` (text[]) - Array of spelling words in the practice
      - `user_answers` (jsonb) - Array of user's answers with format: [{ word, userAnswer, isCorrect, level }]
      - `correct_count` (integer) - Number of correct answers
      - `total_count` (integer) - Total number of words
      - `accuracy_percentage` (integer) - Percentage score (0-100)
      - `practice_level` (integer) - Level used (1 = Letter Click, 2 = Typing)
      - `time_spent_seconds` (integer) - Time spent on practice in seconds
      - `completed_at` (timestamptz) - When the practice was completed
      - `created_at` (timestamptz) - When the record was created

    - `proofreading_practice_results`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users) - Student who completed the practice
      - `sentences` (text[]) - Array of sentences in the practice
      - `correct_answers` (jsonb) - Array of correct answers with format: [{ lineNumber, wordIndex, correction }]
      - `user_answers` (jsonb) - Array of user's answers with same format
      - `correct_count` (integer) - Number of correct answers
      - `total_count` (integer) - Total number of questions
      - `accuracy_percentage` (integer) - Percentage score (0-100)
      - `time_spent_seconds` (integer) - Time spent on practice in seconds
      - `completed_at` (timestamptz) - When the practice was completed
      - `created_at` (timestamptz) - When the record was created

    - `memorization_practice_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users) - Student who practiced
      - `content_id` (uuid, nullable, foreign key to saved_contents) - Link to saved content if applicable
      - `title` (text) - Title of the memorization content
      - `original_text` (text) - The original text that was memorized
      - `total_words` (integer) - Total number of words in the text
      - `hidden_words_count` (integer) - Number of words that were hidden
      - `session_duration_seconds` (integer) - Time spent in the session
      - `completed_at` (timestamptz) - When the session ended
      - `created_at` (timestamptz) - When the record was created

  2. Security
    - Enable RLS on all three tables
    - Students can view only their own progress records
    - Students can insert their own progress records
    - Admins can view all progress records
    - Admins cannot modify existing progress records (data integrity)

  3. Performance
    - Create indexes on user_id for efficient queries
    - Create indexes on completed_at for date-based filtering
    - Create composite indexes for common query patterns

  4. Important Notes
    - All timestamps use timestamptz for proper timezone handling
    - JSONB format allows flexible storage of detailed results
    - Separate tables for each practice type allow for type-specific queries
    - Retroactive tracking is supported - can save results from any practice
    - Time tracking is in seconds for precision and easy conversion
*/

-- Create spelling_practice_results table
CREATE TABLE IF NOT EXISTS spelling_practice_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practice_id uuid REFERENCES spelling_practices(id) ON DELETE SET NULL,
  title text NOT NULL,
  words text[] NOT NULL,
  user_answers jsonb NOT NULL,
  correct_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  accuracy_percentage integer NOT NULL DEFAULT 0,
  practice_level integer NOT NULL DEFAULT 1,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create proofreading_practice_results table
CREATE TABLE IF NOT EXISTS proofreading_practice_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sentences text[] NOT NULL,
  correct_answers jsonb NOT NULL,
  user_answers jsonb NOT NULL,
  correct_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  accuracy_percentage integer NOT NULL DEFAULT 0,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create memorization_practice_sessions table
CREATE TABLE IF NOT EXISTS memorization_practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id uuid REFERENCES saved_contents(id) ON DELETE SET NULL,
  title text NOT NULL,
  original_text text NOT NULL,
  total_words integer NOT NULL DEFAULT 0,
  hidden_words_count integer NOT NULL DEFAULT 0,
  session_duration_seconds integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE spelling_practice_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE proofreading_practice_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorization_practice_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for spelling_practice_results

CREATE POLICY "Users can view own spelling results"
  ON spelling_practice_results FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own spelling results"
  ON spelling_practice_results FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all spelling results"
  ON spelling_practice_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policies for proofreading_practice_results

CREATE POLICY "Users can view own proofreading results"
  ON proofreading_practice_results FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own proofreading results"
  ON proofreading_practice_results FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all proofreading results"
  ON proofreading_practice_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policies for memorization_practice_sessions

CREATE POLICY "Users can view own memorization sessions"
  ON memorization_practice_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own memorization sessions"
  ON memorization_practice_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all memorization sessions"
  ON memorization_practice_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create indexes for performance

CREATE INDEX IF NOT EXISTS idx_spelling_results_user_id ON spelling_practice_results(user_id);
CREATE INDEX IF NOT EXISTS idx_spelling_results_completed_at ON spelling_practice_results(completed_at);
CREATE INDEX IF NOT EXISTS idx_spelling_results_user_completed ON spelling_practice_results(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_spelling_results_practice_id ON spelling_practice_results(practice_id);

CREATE INDEX IF NOT EXISTS idx_proofreading_results_user_id ON proofreading_practice_results(user_id);
CREATE INDEX IF NOT EXISTS idx_proofreading_results_completed_at ON proofreading_practice_results(completed_at);
CREATE INDEX IF NOT EXISTS idx_proofreading_results_user_completed ON proofreading_practice_results(user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_memorization_sessions_user_id ON memorization_practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_memorization_sessions_completed_at ON memorization_practice_sessions(completed_at);
CREATE INDEX IF NOT EXISTS idx_memorization_sessions_user_completed ON memorization_practice_sessions(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_memorization_sessions_content_id ON memorization_practice_sessions(content_id);

-- Create helper function to get user progress summary
CREATE OR REPLACE FUNCTION get_user_progress_summary(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'spelling', (
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage)), 0),
        'total_time_minutes', COALESCE(ROUND(SUM(time_spent_seconds) / 60.0), 0),
        'best_score', COALESCE(MAX(accuracy_percentage), 0)
      )
      FROM spelling_practice_results
      WHERE user_id = target_user_id
    ),
    'proofreading', (
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage)), 0),
        'total_time_minutes', COALESCE(ROUND(SUM(time_spent_seconds) / 60.0), 0),
        'best_score', COALESCE(MAX(accuracy_percentage), 0)
      )
      FROM proofreading_practice_results
      WHERE user_id = target_user_id
    ),
    'memorization', (
      SELECT jsonb_build_object(
        'total_sessions', COUNT(*),
        'total_time_minutes', COALESCE(ROUND(SUM(session_duration_seconds) / 60.0), 0),
        'total_words_practiced', COALESCE(SUM(total_words), 0)
      )
      FROM memorization_practice_sessions
      WHERE user_id = target_user_id
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Create function to get class rankings for a specific practice type
CREATE OR REPLACE FUNCTION get_spelling_rankings()
RETURNS TABLE (
  user_id uuid,
  username text,
  total_practices bigint,
  average_accuracy numeric,
  rank bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    u.id AS user_id,
    u.username,
    COUNT(spr.id) AS total_practices,
    COALESCE(ROUND(AVG(spr.accuracy_percentage), 1), 0) AS average_accuracy,
    RANK() OVER (ORDER BY COALESCE(AVG(spr.accuracy_percentage), 0) DESC, COUNT(spr.id) DESC) AS rank
  FROM users u
  LEFT JOIN spelling_practice_results spr ON u.id = spr.user_id
  WHERE u.role = 'user'
  GROUP BY u.id, u.username
  HAVING COUNT(spr.id) > 0
  ORDER BY rank;
$$;

CREATE OR REPLACE FUNCTION get_proofreading_rankings()
RETURNS TABLE (
  user_id uuid,
  username text,
  total_practices bigint,
  average_accuracy numeric,
  rank bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    u.id AS user_id,
    u.username,
    COUNT(ppr.id) AS total_practices,
    COALESCE(ROUND(AVG(ppr.accuracy_percentage), 1), 0) AS average_accuracy,
    RANK() OVER (ORDER BY COALESCE(AVG(ppr.accuracy_percentage), 0) DESC, COUNT(ppr.id) DESC) AS rank
  FROM users u
  LEFT JOIN proofreading_practice_results ppr ON u.id = ppr.user_id
  WHERE u.role = 'user'
  GROUP BY u.id, u.username
  HAVING COUNT(ppr.id) > 0
  ORDER BY rank;
$$;
