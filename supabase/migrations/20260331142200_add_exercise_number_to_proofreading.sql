-- Add exercise_number column to proofreading_practices table
ALTER TABLE public.proofreading_practices 
ADD COLUMN IF NOT EXISTS exercise_number TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.proofreading_practices.exercise_number IS 'The exercise name or number fetched from Notion or entered by teacher';
