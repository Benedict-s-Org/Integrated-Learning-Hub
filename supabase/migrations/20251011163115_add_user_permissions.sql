/*
  # Add User Permissions System

  1. Changes
    - Add `can_access_proofreading` column to `users` table
      - Type: boolean with default value false
      - Controls whether user can access proofreading exercises
    - Add `can_access_spelling` column to `users` table
      - Type: boolean with default value false
      - Controls whether user can access spelling practice
  
  2. Notes
    - Default permissions are false (restricted access)
    - Admin users should be granted all permissions
    - These permissions allow granular control over feature access
    - No RLS changes needed as existing policies already cover this table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'can_access_proofreading'
  ) THEN
    ALTER TABLE users ADD COLUMN can_access_proofreading boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'can_access_spelling'
  ) THEN
    ALTER TABLE users ADD COLUMN can_access_spelling boolean DEFAULT false;
  END IF;
END $$;

UPDATE users SET can_access_proofreading = true, can_access_spelling = true WHERE role = 'admin';