-- Migration: Add Proofreading Fields to Reading Questions
-- Description: Adds error_sentence and error columns to support proofreading mode.

ALTER TABLE public.reading_questions 
ADD COLUMN IF NOT EXISTS error_sentence TEXT,
ADD COLUMN IF NOT EXISTS error TEXT;

-- Update RLS or other things if necessary (already enabled for reading_questions)
