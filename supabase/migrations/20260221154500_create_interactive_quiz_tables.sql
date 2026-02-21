
-- Create interactive quiz tables

-- Sessions table
CREATE TABLE IF NOT EXISTS public.interactive_quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    class_id TEXT, -- Can be linked to a specific class string
    status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'polling', 'revealed')),
    current_question_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Questions table
CREATE TABLE IF NOT EXISTS public.interactive_quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interactive_quiz_sessions(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL, -- Format: {"A": "Choice 1", "B": "Choice 2", ...}
    correct_answer TEXT CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add foreign key constraint after both tables are created
ALTER TABLE public.interactive_quiz_sessions 
ADD CONSTRAINT fk_current_question 
FOREIGN KEY (current_question_id) REFERENCES public.interactive_quiz_questions(id) ON DELETE SET NULL;

-- Responses table
CREATE TABLE IF NOT EXISTS public.interactive_quiz_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interactive_quiz_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.interactive_quiz_questions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    answer TEXT NOT NULL CHECK (answer IN ('A', 'B', 'C', 'D')),
    timestamp TIMESTAMPTZ DEFAULT now(),
    UNIQUE(session_id, question_id, student_id) -- Only one response per student per question
);

-- Enable RLS
ALTER TABLE public.interactive_quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactive_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactive_quiz_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Sessions: Host can do everything, others can read active ones
CREATE POLICY "Hosts can manage their own sessions" 
ON public.interactive_quiz_sessions 
FOR ALL USING (auth.uid() = host_id);

CREATE POLICY "Anyone can view active sessions" 
ON public.interactive_quiz_sessions 
FOR SELECT USING (true);

-- Questions: Host can manage, others can read
CREATE POLICY "Hosts can manage questions" 
ON public.interactive_quiz_questions 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.interactive_quiz_sessions 
        WHERE id = session_id AND host_id = auth.uid()
    )
);

CREATE POLICY "Anyone can view questions" 
ON public.interactive_quiz_questions 
FOR SELECT USING (true);

-- Responses: Host can read all, students can insert their own
CREATE POLICY "Hosts can view all responses" 
ON public.interactive_quiz_responses 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.interactive_quiz_sessions 
        WHERE id = session_id AND host_id = auth.uid()
    )
);

CREATE POLICY "Students can insert their own responses" 
ON public.interactive_quiz_responses 
FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can view their own responses" 
ON public.interactive_quiz_responses 
FOR SELECT USING (auth.uid() = student_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.interactive_quiz_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interactive_quiz_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interactive_quiz_responses;
