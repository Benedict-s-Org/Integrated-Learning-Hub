/*
  # Add Display Name to Users Table

  1. Changes to Tables
    - Add `display_name` column to `users` table
      - `display_name` (text, nullable) - User's display name shown in UI
      - Defaults to username if not provided

  2. Data Migration
    - Set existing users' display_name to their username as default

  3. Security
    - No RLS changes needed, inherits from existing users table policies

  4. Notes
    - Display name is used in the UI (e.g., next to sign out button)
    - If display_name is null or empty, the application should fall back to username
*/

-- Add display_name column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE users ADD COLUMN display_name text;
  END IF;
END $$;

-- Set existing users' display_name to their username
UPDATE users
SET display_name = username
WHERE display_name IS NULL;