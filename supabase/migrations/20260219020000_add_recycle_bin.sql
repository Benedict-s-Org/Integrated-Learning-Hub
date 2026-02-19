-- Add deleted_at column to spaced_repetition_sets for soft-deletion
ALTER TABLE spaced_repetition_sets ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Update RLS policies to exclude deleted sets from normal view
DROP POLICY IF EXISTS "Users can view own sets" ON spaced_repetition_sets;
CREATE POLICY "Users can view own sets"
  ON spaced_repetition_sets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL OR (is_published = true AND deleted_at IS NULL));

-- Allow users to see their own deleted sets (for the Recycle Bin)
CREATE POLICY "Users can view own deleted sets"
  ON spaced_repetition_sets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NOT NULL);

-- Ensure updates and deletes (now soft-deletes) respect the state
DROP POLICY IF EXISTS "Users can update own sets" ON spaced_repetition_sets;
CREATE POLICY "Users can update own sets"
  ON spaced_repetition_sets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Explicitly allow permanent deletion (or updates to deleted_at)
DROP POLICY IF EXISTS "Users can delete own sets" ON spaced_repetition_sets;
CREATE POLICY "Users can delete own sets"
  ON spaced_repetition_sets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
