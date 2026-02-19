-- Drop existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Users can create own sets" ON spaced_repetition_sets;
DROP POLICY IF EXISTS "Users can view own sets" ON spaced_repetition_sets;
DROP POLICY IF EXISTS "Users can update own sets" ON spaced_repetition_sets;
DROP POLICY IF EXISTS "Users can delete own sets" ON spaced_repetition_sets;

DROP POLICY IF EXISTS "Users can create questions in own sets" ON spaced_repetition_questions;
DROP POLICY IF EXISTS "Users can view questions in accessible sets" ON spaced_repetition_questions;
DROP POLICY IF EXISTS "Users can update questions in own sets" ON spaced_repetition_questions;
DROP POLICY IF EXISTS "Users can delete questions in own sets" ON spaced_repetition_questions;

-- Re-create policies with explicit permissions
-- Sets
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

-- Questions
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
