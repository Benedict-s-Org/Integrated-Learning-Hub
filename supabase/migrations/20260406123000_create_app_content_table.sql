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

-- Allow admins to manage content (using user_profiles role check)
CREATE POLICY "Allow admins to manage app_content" 
ON public.app_content FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- Initial seed data for all Anagram Experiment keys
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
}', 'Welcome & Consent content'),
('anagram_demographics', '{
    "title": "Background Information",
    "subtitle": "Please provide some basic information before we begin.",
    "button_text": "Continue →",
    "validation_error": "Please fill in all fields"
}', 'Demographics page labels'),
('anagram_task1_prediction', '{
    "title": "Time Prediction",
    "question_text": "How many <strong>seconds</strong> do you think <strong class=\"text-indigo-600\">[target]</strong> will need to solve <strong>each puzzle</strong>?",
    "input_placeholder": "Enter seconds",
    "confirm_button": "Confirm Prediction →",
    "min_val": 1,
    "max_val": 600
}', 'Task 1 Prediction labels'),
('anagram_task2_prediction', '{
    "title": "Time Prediction",
    "question_text": "How many <strong>seconds</strong> do you think <strong class=\"text-indigo-600\">[target]</strong> will need to solve <strong>each puzzle</strong>?",
    "input_placeholder": "Enter seconds",
    "confirm_button": "Confirm Prediction →",
    "min_val": 1,
    "max_val": 600
}', 'Task 2 Prediction labels'),
('anagram_task1_feedback', '{
    "title": "Task 1 (Easy) Complete!",
    "pfi_label": "Planning Fallacy Index (PFI)",
    "pfi_underestimate_text": "You underestimated the time needed",
    "pfi_overestimate_text": "You overestimated the time needed",
    "pfi_invalid_text": "N/A (invalid data — all skipped)",
    "breakdown_label": "Question breakdown:",
    "button_text": "Continue to Next Task →"
}', 'Task 1 Feedback labels'),
('anagram_task2_feedback', '{
    "title": "Task 2 (Hard) Complete!",
    "pfi_label": "Planning Fallacy Index (PFI)",
    "pfi_underestimate_text": "You underestimated the time needed",
    "pfi_overestimate_text": "You overestimated the time needed",
    "pfi_invalid_text": "N/A (invalid data — all skipped)",
    "breakdown_label": "Question breakdown:",
    "button_text": "View Results →"
}', 'Task 2 Feedback labels'),
('anagram_survey', '{
    "title": "Post-Task Questionnaire",
    "subtitle": "Please answer the following questions honestly. There are no right or wrong answers.",
    "sections": {
        "optimism": { "title": "🌟 Optimism Scale", "description": "Rate how much you agree with each statement (1 = Strongly Disagree, 7 = Strongly Agree)" },
        "thinking": { "title": "🧠 Thinking Style", "description": "Rate how much you agree with each statement (1 = Strongly Disagree, 7 = Strongly Agree)" },
        "perception": { "title": "📊 Task Perception", "description": "How difficult did you find each task? (1 = Very Easy, 7 = Very Difficult)" },
        "experience": { "title": "📚 Past Experience", "description": "" },
        "check": { "title": "✅ Comprehension Check", "description": "When you made your time predictions, who were you predicting for?" }
    }
}', 'Survey labels'),
('anagram_debrief', '{
    "title": "Thank You! — Debrief",
    "results_header": "📊 Your Results",
    "pfi_formula": "PFI = (Actual Time − Predicted Time) / Predicted Time",
    "pfi_legend": "Positive = underestimated · Negative = overestimated",
    "about_header": "🔬 About This Study",
    "about_description": "Investigation into the Planning Fallacy — underestimating how long tasks take.",
    "about_group_prefix": "Your group:",
    "about_conclusion": "Analyzing differences between self and other predictions based on task difficulty.",
    "data_collection_header": "💾 Data Collection",
    "download_csv_button": "📥 Download CSV File",
    "copy_json_button": "📋 Copy Full Data as JSON",
    "auto_send_header": "Auto-Send to Google Sheets",
    "auto_send_description": "Connect experiment to a Google Sheet for automated data collection."
}', 'Debrief page content')
ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content;
