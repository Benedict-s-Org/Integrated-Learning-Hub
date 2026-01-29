/*
  # Add Saved Contents Count Helper Function

  1. New Functions
    - `get_user_saved_contents_count(user_uuid uuid)` - Returns the count of saved contents for a specific user

  2. Purpose
    - Provides a reusable function to check how many saved contents a user has
    - Used to enforce save limits (3 for regular users, unlimited for admins)
    - Improves performance by centralizing the count logic

  3. Notes
    - Function is marked as STABLE since it reads from the database but doesn't modify data
    - Uses SECURITY DEFINER to ensure proper RLS policy evaluation
    - Returns 0 if user has no saved contents
*/

CREATE OR REPLACE FUNCTION get_user_saved_contents_count(user_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  content_count integer;
BEGIN
  SELECT COUNT(*)::integer
  INTO content_count
  FROM saved_contents
  WHERE user_id = user_uuid;

  RETURN COALESCE(content_count, 0);
END;
$$;
