-- Create Spelling Word Schedules for Spaced Repetition
-- Each user will have their own progress for individual words

CREATE TABLE IF NOT EXISTS public.spelling_word_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    word text NOT NULL,
    ease_factor numeric DEFAULT 2.5,
    interval_days integer DEFAULT 0,
    repetitions integer DEFAULT 0,
    next_review_date timestamptz DEFAULT now(),
    last_reviewed_at timestamptz,
    last_quality_rating integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, word)
);

-- Enable RLS
ALTER TABLE public.spelling_word_schedules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own spelling schedules"
    ON public.spelling_word_schedules FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own spelling schedules"
    ON public.spelling_word_schedules FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own spelling schedules"
    ON public.spelling_word_schedules FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_spelling_word_schedules_user_id ON public.spelling_word_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_spelling_word_schedules_next_review ON public.spelling_word_schedules(next_review_date);
CREATE INDEX IF NOT EXISTS idx_spelling_word_schedules_word ON public.spelling_word_schedules(word);
