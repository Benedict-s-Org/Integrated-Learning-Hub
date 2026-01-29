/*
  # Create Saved Contents Table

  1. New Tables
    - `saved_contents`
      - `id` (uuid, primary key) - Unique identifier for saved content
      - `user_id` (uuid, not null) - References users table
      - `title` (text, not null) - Title of the saved content
      - `original_text` (text, not null) - The original text content
      - `selected_word_indices` (jsonb, not null) - Array of selected word indices
      - `is_published` (boolean, default false) - Whether content is publicly accessible
      - `public_id` (text, unique) - Public identifier for sharing
      - `created_at` (timestamptz, default now()) - Creation timestamp
      - `updated_at` (timestamptz, default now()) - Last update timestamp

  2. Security
    - Enable RLS on `saved_contents` table
    - Users can read their own saved contents
    - Users can insert their own saved contents
    - Users can update their own saved contents
    - Users can delete their own saved contents
    - Anyone can read published contents by public_id

  3. Notes
    - Links to the custom users table (not auth.users)
    - Supports both private and public content
    - Public content is accessible via public_id without authentication
*/

CREATE TABLE IF NOT EXISTS saved_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  original_text text NOT NULL,
  selected_word_indices jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean DEFAULT false,
  public_id text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE saved_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved contents"
  ON saved_contents
  FOR SELECT
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can insert own saved contents"
  ON saved_contents
  FOR INSERT
  WITH CHECK (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can update own saved contents"
  ON saved_contents
  FOR UPDATE
  USING (user_id = (current_setting('app.current_user_id', true))::uuid)
  WITH CHECK (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can delete own saved contents"
  ON saved_contents
  FOR DELETE
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Anyone can read published contents"
  ON saved_contents
  FOR SELECT
  USING (is_published = true AND public_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_saved_contents_user_id ON saved_contents(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_contents_public_id ON saved_contents(public_id);
CREATE INDEX IF NOT EXISTS idx_saved_contents_created_at ON saved_contents(created_at DESC);

DROP TRIGGER IF EXISTS update_saved_contents_updated_at ON saved_contents;
CREATE TRIGGER update_saved_contents_updated_at
  BEFORE UPDATE ON saved_contents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();