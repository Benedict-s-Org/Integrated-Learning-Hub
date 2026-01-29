/*
  # Add Spaced Repetition Permission to Users

  1. New Column
    - `can_access_spaced_repetition`: Boolean permission flag for accessing spaced repetition features

  2. Update
    - Adds permission column to existing users table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'can_access_spaced_repetition'
  ) THEN
    ALTER TABLE users ADD COLUMN can_access_spaced_repetition boolean DEFAULT false;
  END IF;
END $$;
