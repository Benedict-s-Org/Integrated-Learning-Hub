-- Add is_phrase_mode to spelling_practices
ALTER TABLE public.spelling_practices 
ADD COLUMN IF NOT EXISTS is_phrase_mode BOOLEAN DEFAULT false;
