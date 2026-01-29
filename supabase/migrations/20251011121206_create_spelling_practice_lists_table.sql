/*
  # Create Spelling Practice Lists Table

  1. New Tables
    - `spelling_practice_lists`
      - `id` (uuid, primary key) - Unique identifier for spelling practice list
      - `user_id` (uuid, not null) - References users table
      - `title` (text, not null) - Title/name of the word list
      - `words` (jsonb, not null) - Array of words for spelling practice
      - `created_at` (timestamptz, default now()) - Creation timestamp
      - `updated_at` (timestamptz, default now()) - Last update timestamp

  2. Security
    - Enable RLS on `spelling_practice_lists` table
    - Users can read their own spelling practice lists
    - Users can insert their own spelling practice lists
    - Users can update their own spelling practice lists
    - Users can delete their own spelling practice lists

  3. Notes
    - Links to the custom users table (not auth.users)
    - Words are stored as JSONB array for flexibility
    - Each word list is private to the creating user
*/

CREATE TABLE IF NOT EXISTS spelling_practice_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  words jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE spelling_practice_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own spelling practice lists"
  ON spelling_practice_lists
  FOR SELECT
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can insert own spelling practice lists"
  ON spelling_practice_lists
  FOR INSERT
  WITH CHECK (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can update own spelling practice lists"
  ON spelling_practice_lists
  FOR UPDATE
  USING (user_id = (current_setting('app.current_user_id', true))::uuid)
  WITH CHECK (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can delete own spelling practice lists"
  ON spelling_practice_lists
  FOR DELETE
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE INDEX IF NOT EXISTS idx_spelling_practice_lists_user_id ON spelling_practice_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_spelling_practice_lists_created_at ON spelling_practice_lists(created_at DESC);

DROP TRIGGER IF EXISTS update_spelling_practice_lists_updated_at ON spelling_practice_lists;
CREATE TRIGGER update_spelling_practice_lists_updated_at
  BEFORE UPDATE ON spelling_practice_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();