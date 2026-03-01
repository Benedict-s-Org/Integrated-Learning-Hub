-- Create spaced_repetition_study_plans table
CREATE TABLE IF NOT EXISTS public.spaced_repetition_study_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    set_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    target_date timestamptz NOT NULL,
    strategy text NOT NULL CHECK (strategy IN ('balanced', 'sequential')),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Ensure a user can only have one active plan at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_study_plan_per_user 
ON public.spaced_repetition_study_plans (user_id) 
WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.spaced_repetition_study_plans ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own plans
CREATE POLICY "Users can manage own study plans"
  ON public.spaced_repetition_study_plans FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Optional: Create a trigger to auto-update updated_at if needed, but we can manage it from code or just let it be.
