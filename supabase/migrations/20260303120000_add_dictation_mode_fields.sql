-- Add columns to memorization_practice_sessions to support Dictation Mode
ALTER TABLE public.memorization_practice_sessions 
ADD COLUMN IF NOT EXISTS practice_mode text DEFAULT 'memorization',
ADD COLUMN IF NOT EXISTS correct_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS accuracy_percentage integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS user_answers jsonb;

-- Update existing records to reflect 'memorization' mode
UPDATE public.memorization_practice_sessions 
SET practice_mode = 'memorization' 
WHERE practice_mode IS NULL;
