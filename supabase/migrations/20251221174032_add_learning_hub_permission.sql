/*
  # Add Learning Hub Permission

  1. Changes
    - Add `can_access_learning_hub` column to the `users` table
    - Default value is `false` for new users
    - Admins automatically have access via role check in the application

  2. Security
    - Column follows existing permission pattern (can_access_spelling, can_access_proofreading)
    - Access control is handled at the application level

  3. Notes
    - This enables granular control over which users can access the Integrated Learning Hub feature
    - Admins can grant access to individual users through the admin panel
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'can_access_learning_hub'
  ) THEN
    ALTER TABLE public.users ADD COLUMN can_access_learning_hub boolean DEFAULT false;
  END IF;
END $$;
