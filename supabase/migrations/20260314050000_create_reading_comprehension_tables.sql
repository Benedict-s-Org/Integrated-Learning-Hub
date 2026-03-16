-- Reading Comprehension Learning Mode Schema
-- Supports Rearranging (L1-2), Proofreading (L1-3), Evidence Highlighting, and Interaction Tracking

-- 1. Reading Practices (The Container)
CREATE TABLE IF NOT EXISTS public.reading_practices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    passage_image_url TEXT NOT NULL, -- The cropped image from the PDF
    source_pdf_url TEXT,            -- URL to the original PDF for reference
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    is_deleted BOOLEAN DEFAULT false
);

-- 2. Reading Questions
CREATE TABLE IF NOT EXISTS public.reading_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES public.reading_practices(id) ON DELETE CASCADE,
    question_text TEXT,
    correct_answer TEXT NOT NULL,    -- The full correct sentence/target
    interaction_type TEXT NOT NULL, -- 'rearrange' or 'proofreading'
    level INTEGER DEFAULT 1,         -- 1, 2, or 3
    evidence_coords JSONB,           -- {x, y, w, h} for bonus coin highlight
    metadata JSONB,                  -- {chunks: [], dropdown_options: {}}
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Student Responses (Tracking & Analytics)
CREATE TABLE IF NOT EXISTS public.reading_student_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.reading_questions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES auth.users(id) NOT NULL,
    session_id UUID,                -- To group responses in one sitting
    answer_status TEXT NOT NULL,    -- 'perfect', 'with_hint', 'skipped', 'incorrect'
    hint_used_count INTEGER DEFAULT 0,
    bonus_evidence_completed BOOLEAN DEFAULT false,
    student_input TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.reading_practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_student_responses ENABLE ROW LEVEL SECURITY;

-- Policies for reading_practices
CREATE POLICY "Staff can manage reading practices" ON public.reading_practices
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'class_staff')));

CREATE POLICY "Students can view assigned reading practices" ON public.reading_practices
    FOR SELECT TO authenticated
    USING (true); -- Simplified view for now, will refine with assignments table

-- Policies for reading_questions
CREATE POLICY "Staff can manage reading questions" ON public.reading_questions
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'class_staff')));

CREATE POLICY "Students can view questions" ON public.reading_questions
    FOR SELECT TO authenticated
    USING (true);

-- Policies for reading_student_responses
CREATE POLICY "Students can manage their own responses" ON public.reading_student_responses
    FOR ALL TO authenticated
    USING (student_id = auth.uid())
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "Staff can view all student responses" ON public.reading_student_responses
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'class_staff')));
