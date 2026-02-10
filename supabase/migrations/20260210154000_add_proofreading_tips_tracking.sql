-- Add tips_used column to proofreading_practice_results
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofreading_practice_results' AND column_name = 'tips_used'
  ) THEN
    ALTER TABLE proofreading_practice_results ADD COLUMN tips_used jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
