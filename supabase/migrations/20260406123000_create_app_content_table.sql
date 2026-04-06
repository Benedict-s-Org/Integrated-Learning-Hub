-- Create app_content table for custom UI strings/content
CREATE TABLE IF NOT EXISTS public.app_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    content JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.app_content ENABLE ROW LEVEL SECURITY;

-- Allow public read access to content
CREATE POLICY "Allow public read access to app_content" 
ON public.app_content FOR SELECT 
USING (true);

-- Allow admins to manage content
CREATE POLICY "Allow admins to manage app_content" 
ON public.app_content FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
);

-- Initial seed data for Anagram Experiment
INSERT INTO public.app_content (key, content, description)
VALUES 
('anagram_welcome', '{
    "title": "Cognitive Task Experiment",
    "subtitle": "Things Are Harder Than They Seem: Self vs. Other Predictions",
    "study_info_title": "📋 Study Information",
    "study_info_items": [
        "You will complete two sets of <strong>anagram puzzles</strong> — rearranging scrambled letters to form English words.",
        "Before each set, you will be asked to <strong>predict how many seconds</strong> it will take you to complete each puzzle.",
        "Each set has <strong>10 puzzles</strong>. You have up to <strong>5 attempts</strong> per puzzle. If you can''t solve it, you can skip."
    ],
    "notes_title": "⚠️ Important Notes",
    "notes_items": [
        "Each timer starts when you see the puzzle",
        "Type your answer and press Enter or click Submit",
        "You can skip any puzzle (max 5 attempts)",
        "Your data will be used for research purposes only"
    ],
    "consent_text": "I understand the study and agree to participate",
    "start_button_text": "Start Experiment →"
}', 'Content for the Anagram Experiment Welcome page'),
('anagram_survey', '{
    "title": "Post-Task Questionnaire",
    "subtitle": "Please answer the following questions honestly. There are no right or wrong answers.",
    "sections": {
        "optimism": {
            "title": "🌟 Optimism Scale",
            "description": "Rate how much you agree with each statement (1 = Strongly Disagree, 7 = Strongly Agree)"
        },
        "thinking": {
            "title": "🧠 Thinking Style",
            "description": "Rate how much you agree with each statement (1 = Strongly Disagree, 7 = Strongly Agree)"
        },
        "perception": {
            "title": "📊 Task Perception",
            "description": "How difficult did you find each task? (1 = Very Easy, 7 = Very Difficult)"
        },
        "experience": {
            "title": "📚 Past Experience",
            "description": ""
        },
        "check": {
            "title": "✅ Comprehension Check",
            "description": "When you made your time predictions, who were you predicting for?"
        }
    }
}', 'Content for the Anagram Experiment Post-Survey page')
ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content;
