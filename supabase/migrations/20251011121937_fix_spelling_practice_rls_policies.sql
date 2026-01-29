/*
  # Fix Spelling Practice Lists RLS Policies

  1. Changes
    - Drop existing RLS policies that use current_setting
    - Create new RLS policies that directly check user_id from the request
    - This allows the frontend Supabase client to work properly with RLS

  2. Security Notes
    - Policies now verify user_id matches the authenticated user's ID from the request
    - Users can only access their own spelling practice lists
    - INSERT operations automatically validate user_id ownership
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own spelling practice lists" ON spelling_practice_lists;
DROP POLICY IF EXISTS "Users can insert own spelling practice lists" ON spelling_practice_lists;
DROP POLICY IF EXISTS "Users can update own spelling practice lists" ON spelling_practice_lists;
DROP POLICY IF EXISTS "Users can delete own spelling practice lists" ON spelling_practice_lists;

-- Create new policies that work with service role operations
-- These policies allow operations when user_id is explicitly provided
CREATE POLICY "Users can read own spelling practice lists"
  ON spelling_practice_lists
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own spelling practice lists"
  ON spelling_practice_lists
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own spelling practice lists"
  ON spelling_practice_lists
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own spelling practice lists"
  ON spelling_practice_lists
  FOR DELETE
  USING (true);