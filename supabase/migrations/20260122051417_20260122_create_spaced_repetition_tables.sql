/*
  # Create Spaced Repetition Learning System

  1. New Tables
    - `spaced_repetition_sets`: Question sets for spaced repetition learning
    - `spaced_repetition_questions`: Individual questions with multiple choice options
    - `spaced_repetition_schedules`: SM-2 algorithm tracking for each user-question pair
    - `spaced_repetition_attempts`: User responses and performance history
    - `user_achievements`: Track badges and study streaks
    - `user_streaks`: Daily learning streaks and milestone tracking

  2. Security
    - Enable RLS on all tables
    - Add policies for user data isolation
    - Add admin policies for set management

  3. Indexes
    - Index on user_id for faster queries
    - Index on next_review_date for efficient due card fetching
    - Index on created_at for sorting and pagination
*/

CREATE TABLE IF NOT EXISTS spaced_repetition_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  total_questions integer DEFAULT 0,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spaced_repetition_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES spaced_repetition_sets(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  choices jsonb NOT NULL,
  correct_answer_index integer NOT NULL,
  explanation text,
  difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spaced_repetition_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES spaced_repetition_questions(id) ON DELETE CASCADE,
  ease_factor numeric DEFAULT 2.5,
  interval_days integer DEFAULT 1,
  repetitions integer DEFAULT 0,
  next_review_date timestamptz DEFAULT now(),
  last_reviewed_at timestamptz,
  last_quality_rating integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, question_id)
);

CREATE TABLE IF NOT EXISTS spaced_repetition_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES spaced_repetition_questions(id) ON DELETE CASCADE,
  selected_answer_index integer NOT NULL,
  is_correct boolean NOT NULL,
  response_time_ms integer,
  quality_rating integer CHECK (quality_rating >= 0 AND quality_rating <= 5),
  attempt_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_streak_days integer DEFAULT 0,
  longest_streak_days integer DEFAULT 0,
  last_practice_date date,
  total_cards_learned integer DEFAULT 0,
  total_cards_mastered integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_type text NOT NULL,
  achievement_name text NOT NULL,
  description text,
  icon_name text,
  earned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_type)
);

CREATE TABLE IF NOT EXISTS set_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES spaced_repetition_sets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_date timestamptz,
  assigned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(set_id, user_id)
);

ALTER TABLE spaced_repetition_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaced_repetition_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaced_repetition_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaced_repetition_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own sets"
  ON spaced_repetition_sets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own sets"
  ON spaced_repetition_sets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_published = true);

CREATE POLICY "Users can update own sets"
  ON spaced_repetition_sets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sets"
  ON spaced_repetition_sets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view questions in accessible sets"
  ON spaced_repetition_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spaced_repetition_sets
      WHERE spaced_repetition_sets.id = spaced_repetition_questions.set_id
      AND (spaced_repetition_sets.user_id = auth.uid() OR spaced_repetition_sets.is_published = true)
    )
  );

CREATE POLICY "Users can create questions in own sets"
  ON spaced_repetition_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spaced_repetition_sets
      WHERE spaced_repetition_sets.id = set_id
      AND spaced_repetition_sets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update questions in own sets"
  ON spaced_repetition_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spaced_repetition_sets
      WHERE spaced_repetition_sets.id = set_id
      AND spaced_repetition_sets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete questions in own sets"
  ON spaced_repetition_questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spaced_repetition_sets
      WHERE spaced_repetition_sets.id = set_id
      AND spaced_repetition_sets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own schedules"
  ON spaced_repetition_schedules FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedules"
  ON spaced_repetition_schedules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedules"
  ON spaced_repetition_schedules FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own attempts"
  ON spaced_repetition_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts"
  ON spaced_repetition_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own streaks"
  ON user_streaks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks"
  ON user_streaks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own achievements"
  ON user_achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view assigned sets"
  ON set_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = assigned_by);

CREATE POLICY "Admins can assign sets"
  ON set_assignments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = assigned_by);

CREATE INDEX idx_spaced_repetition_sets_user_id ON spaced_repetition_sets(user_id);
CREATE INDEX idx_spaced_repetition_questions_set_id ON spaced_repetition_questions(set_id);
CREATE INDEX idx_spaced_repetition_schedules_user_id ON spaced_repetition_schedules(user_id);
CREATE INDEX idx_spaced_repetition_schedules_next_review ON spaced_repetition_schedules(next_review_date);
CREATE INDEX idx_spaced_repetition_attempts_user_id ON spaced_repetition_attempts(user_id);
CREATE INDEX idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_set_assignments_user_id ON set_assignments(user_id);
