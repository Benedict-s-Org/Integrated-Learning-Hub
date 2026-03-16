-- Add question_image_url to reading_questions
-- This allows each question to have its own cropped passage image
ALTER TABLE public.reading_questions 
ADD COLUMN IF NOT EXISTS question_image_url TEXT;

-- Update existing records to use the practice's image URL as a fallback
UPDATE public.reading_questions q
SET question_image_url = p.passage_image_url
FROM public.reading_practices p
WHERE q.practice_id = p.id
AND q.question_image_url IS NULL;
