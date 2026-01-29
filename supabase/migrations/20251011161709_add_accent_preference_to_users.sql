/*
  # Add Accent Preference to Users Table

  1. Changes
    - Add `accent_preference` column to `users` table
      - Type: text with default value 'en-US'
      - Stores the user's preferred TTS accent/language code
      - Supported values: 'en-US', 'en-GB', 'en-AU', 'en-IE'
  
  2. Notes
    - Default accent is 'en-US' (American English)
    - Column allows users to customize their text-to-speech experience
    - No RLS changes needed as existing policies already cover this table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'accent_preference'
  ) THEN
    ALTER TABLE users ADD COLUMN accent_preference text DEFAULT 'en-US';
  END IF;
END $$;