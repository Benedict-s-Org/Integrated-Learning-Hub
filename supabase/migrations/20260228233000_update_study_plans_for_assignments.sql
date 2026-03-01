-- Drop the previous study plan table if it exists as we're restructuring it
DROP TABLE IF EXISTS public.spaced_repetition_study_plans CASCADE;

-- Create spaced_repetition_study_plans table (Template/Admin Level)
CREATE TABLE IF NOT EXISTS public.spaced_repetition_study_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title text NOT NULL DEFAULT 'Study Plan',
    set_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    target_date timestamptz NOT NULL,
    strategy text NOT NULL CHECK (strategy IN ('balanced', 'sequential')),
    is_template boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create study_plan_assignments table (Student Level)
CREATE TABLE IF NOT EXISTS public.study_plan_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES public.spaced_repetition_study_plans(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    UNIQUE(plan_id, user_id)
);

-- Ensure a user can only have one active assigned plan at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_assigned_plan_per_user 
ON public.study_plan_assignments (user_id) 
WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.spaced_repetition_study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plan_assignments ENABLE ROW LEVEL SECURITY;

-- Plan Policies
CREATE POLICY "Users can view plans they created"
  ON public.spaced_repetition_study_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = creator_id);

CREATE POLICY "Users can view plans assigned to them"
  ON public.spaced_repetition_study_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.study_plan_assignments
      WHERE plan_id = spaced_repetition_study_plans.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage plans"
  ON public.spaced_repetition_study_plans FOR ALL
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Assignment Policies
CREATE POLICY "Users can view their assignments"
  ON public.study_plan_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = assigned_by);

CREATE POLICY "Admins can manage assignments"
  ON public.study_plan_assignments FOR ALL
  TO authenticated
  USING (auth.uid() = assigned_by)
  WITH CHECK (auth.uid() = assigned_by);
