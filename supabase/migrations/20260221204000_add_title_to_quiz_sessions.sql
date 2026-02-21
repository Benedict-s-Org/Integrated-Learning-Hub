-- Add title to interactive_quiz_sessions
ALTER TABLE public.interactive_quiz_sessions 
ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Untitled Quiz';
