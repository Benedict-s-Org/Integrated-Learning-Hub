-- Add category column to reading_questions
ALTER TABLE public.reading_questions 
ADD COLUMN IF NOT EXISTS category TEXT;

-- Index for faster filtering by category
CREATE INDEX IF NOT EXISTS idx_reading_questions_category ON public.reading_questions(category);
