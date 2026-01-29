/*
  # Add Voice Preferences and Recommendations System

  1. Changes to users table
    - Add `voice_name` column to store specific voice name (e.g., "Daniel", "Samantha")
    - Add `voice_lang` column to store the voice's language code for fallback matching
    - Add `voice_uri` column to store the unique voice identifier
    - These columns extend the existing `accent_preference` to ensure consistent voice across devices

  2. New Table: recommended_voices
    - `id` (uuid, primary key)
    - `accent_code` (text, not null) - The accent/language code (e.g., 'en-GB', 'en-US')
    - `voice_name` (text, not null) - The recommended voice name
    - `voice_uri` (text) - The unique voice identifier
    - `priority` (integer, default 0) - Priority level (higher = more preferred)
    - `is_ios_native` (boolean, default false) - Whether this is an iOS/iPadOS built-in voice
    - `notes` (text) - Admin notes about this voice recommendation
    - `created_by` (uuid) - Admin who created this recommendation
    - `created_at` (timestamptz, default now())
    - `updated_at` (timestamptz, default now())

  3. Security
    - Enable RLS on `recommended_voices` table
    - All authenticated users can read voice recommendations
    - Only admins can create, update, and delete voice recommendations

  4. Initial Data
    - Set default iOS native voices for common accents to help with consistency
    - These are the most reliable voices across iOS/iPadOS devices

  5. Notes
    - The voice fields in users table allow NULL to maintain backward compatibility
    - When voice_name is NULL, the system will use fallback logic based on accent_preference
    - iOS native voices are prioritized for consistency across school iPads
    - Admins can set school-wide recommended voices for each accent
*/

-- Add voice preference columns to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'voice_name'
  ) THEN
    ALTER TABLE users ADD COLUMN voice_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'voice_lang'
  ) THEN
    ALTER TABLE users ADD COLUMN voice_lang text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'voice_uri'
  ) THEN
    ALTER TABLE users ADD COLUMN voice_uri text;
  END IF;
END $$;

-- Create recommended_voices table
CREATE TABLE IF NOT EXISTS recommended_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accent_code text NOT NULL,
  voice_name text NOT NULL,
  voice_uri text,
  priority integer DEFAULT 0,
  is_ios_native boolean DEFAULT false,
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on recommended_voices
ALTER TABLE recommended_voices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recommended_voices
CREATE POLICY "All authenticated users can read voice recommendations"
  ON recommended_voices
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert voice recommendations"
  ON recommended_voices
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (current_setting('app.current_user_id', true))::uuid
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can update voice recommendations"
  ON recommended_voices
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (current_setting('app.current_user_id', true))::uuid
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (current_setting('app.current_user_id', true))::uuid
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete voice recommendations"
  ON recommended_voices
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (current_setting('app.current_user_id', true))::uuid
      AND u.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recommended_voices_accent_code ON recommended_voices(accent_code);
CREATE INDEX IF NOT EXISTS idx_recommended_voices_priority ON recommended_voices(priority DESC);
CREATE INDEX IF NOT EXISTS idx_users_voice_name ON users(voice_name);

-- Trigger to automatically update updated_at on recommended_voices
DROP TRIGGER IF EXISTS update_recommended_voices_updated_at ON recommended_voices;
CREATE TRIGGER update_recommended_voices_updated_at
  BEFORE UPDATE ON recommended_voices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default iOS native voice recommendations for consistency across iPads
-- These are the most common and reliable iOS voices for each accent

-- American English voices
INSERT INTO recommended_voices (accent_code, voice_name, priority, is_ios_native, notes)
VALUES
  ('en-US', 'Samantha', 100, true, 'Default iOS female voice - most consistent across devices'),
  ('en-US', 'Alex', 90, true, 'Default iOS male voice - highly reliable')
ON CONFLICT DO NOTHING;

-- British English voices
INSERT INTO recommended_voices (accent_code, voice_name, priority, is_ios_native, notes)
VALUES
  ('en-GB', 'Daniel', 100, true, 'Default iOS British male voice - excellent for iPad'),
  ('en-GB', 'Kate', 90, true, 'Default iOS British female voice - clear pronunciation')
ON CONFLICT DO NOTHING;

-- Australian English voices
INSERT INTO recommended_voices (accent_code, voice_name, priority, is_ios_native, notes)
VALUES
  ('en-AU', 'Karen', 100, true, 'Default iOS Australian female voice - reliable'),
  ('en-AU', 'Lee', 90, true, 'iOS Australian male voice - good consistency')
ON CONFLICT DO NOTHING;

-- Irish English voices
INSERT INTO recommended_voices (accent_code, voice_name, priority, is_ios_native, notes)
VALUES
  ('en-IE', 'Moira', 100, true, 'Default iOS Irish female voice - consistent across devices')
ON CONFLICT DO NOTHING;

-- Create a function to get recommended voice for an accent
CREATE OR REPLACE FUNCTION get_recommended_voice(p_accent_code text)
RETURNS TABLE(
  voice_name text,
  voice_uri text,
  is_ios_native boolean,
  notes text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rv.voice_name,
    rv.voice_uri,
    rv.is_ios_native,
    rv.notes
  FROM recommended_voices rv
  WHERE rv.accent_code = p_accent_code
  ORDER BY rv.priority DESC, rv.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
