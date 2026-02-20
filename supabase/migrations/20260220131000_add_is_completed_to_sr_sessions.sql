-- Add is_completed column to spaced_repetition_sessions
-- This helps avoid race conditions where a completed session might be re-saved as uncompleted

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spaced_repetition_sessions' AND column_name = 'is_completed'
  ) THEN
    ALTER TABLE public.spaced_repetition_sessions ADD COLUMN is_completed boolean DEFAULT false;
  END IF;
END $$;
