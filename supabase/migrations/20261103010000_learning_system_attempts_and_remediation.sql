-- Learning System runtime tables (no Notion question dependency).
-- Attempts are LS-owned (DEC-20261102-11). Remediation / teacher follow-up (DEC-20261102-15…17).

CREATE TABLE IF NOT EXISTS public.learning_system_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('first_mix', 'ordinary_review', 'remediation')),
  target_skill_id text REFERENCES public.grammar_micro_skills(id) ON DELETE SET NULL,
  grade_key text CHECK (grade_key IN ('P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6')),
  question_count integer NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  assignment_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_system_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  set_id uuid REFERENCES public.learning_system_sets(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('srs', 'proofreading')),
  skill_id text REFERENCES public.grammar_micro_skills(id) ON DELETE SET NULL,
  notion_page_id text,
  question_version text,
  is_valid boolean NOT NULL DEFAULT false,
  is_remediation boolean NOT NULL DEFAULT false,
  is_demonstration boolean NOT NULL DEFAULT false,
  selected_answer text,
  is_correct boolean,
  -- Proofreading split (nullable for SRS)
  detection_correct boolean,
  correction_correct boolean,
  response_time_ms integer,
  answered_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_system_skill_states (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  skill_id text NOT NULL REFERENCES public.grammar_micro_skills(id) ON DELETE CASCADE,
  potential_weakness boolean NOT NULL DEFAULT false,
  remediation_loop integer NOT NULL DEFAULT 0 CHECK (remediation_loop >= 0 AND remediation_loop <= 2),
  remediation_paused boolean NOT NULL DEFAULT false,
  teacher_intervention_open boolean NOT NULL DEFAULT false,
  ordinary_since_pass integer NOT NULL DEFAULT 0,
  teacher_pin boolean NOT NULL DEFAULT false,
  last_evaluated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS public.learning_system_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  skill_id text NOT NULL REFERENCES public.grammar_micro_skills(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now(),
  notify_sent_at timestamptz,
  followed_up_at timestamptz,
  followed_up_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'followed_up', 'closed')),
  notes text
);

-- Only one open intervention episode per user+skill
CREATE UNIQUE INDEX IF NOT EXISTS learning_system_interventions_one_open
  ON public.learning_system_interventions (user_id, skill_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_ls_attempts_user_skill_valid
  ON public.learning_system_attempts (user_id, skill_id, answered_at DESC)
  WHERE is_valid = true;
CREATE INDEX IF NOT EXISTS idx_ls_sets_user
  ON public.learning_system_sets (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ls_skill_states_weakness
  ON public.learning_system_skill_states (potential_weakness, remediation_paused);

ALTER TABLE public.learning_system_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_system_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_system_skill_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_system_interventions ENABLE ROW LEVEL SECURITY;

-- Students: own rows; staff: all
DROP POLICY IF EXISTS "LS sets select" ON public.learning_system_sets;
CREATE POLICY "LS sets select" ON public.learning_system_sets FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff'))
  );
DROP POLICY IF EXISTS "LS sets insert own" ON public.learning_system_sets;
CREATE POLICY "LS sets insert own" ON public.learning_system_sets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "LS sets update own or staff" ON public.learning_system_sets;
CREATE POLICY "LS sets update own or staff" ON public.learning_system_sets FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff'))
  );

DROP POLICY IF EXISTS "LS attempts select" ON public.learning_system_attempts;
CREATE POLICY "LS attempts select" ON public.learning_system_attempts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff'))
  );
DROP POLICY IF EXISTS "LS attempts insert own" ON public.learning_system_attempts;
CREATE POLICY "LS attempts insert own" ON public.learning_system_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "LS skill states select" ON public.learning_system_skill_states;
CREATE POLICY "LS skill states select" ON public.learning_system_skill_states FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff'))
  );
DROP POLICY IF EXISTS "LS skill states upsert own or staff" ON public.learning_system_skill_states;
CREATE POLICY "LS skill states upsert own or staff" ON public.learning_system_skill_states FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff'))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff'))
  );

DROP POLICY IF EXISTS "LS interventions select" ON public.learning_system_interventions;
CREATE POLICY "LS interventions select" ON public.learning_system_interventions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff'))
  );
DROP POLICY IF EXISTS "LS interventions staff write" ON public.learning_system_interventions;
CREATE POLICY "LS interventions staff write" ON public.learning_system_interventions FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff'))
  );
-- Allow system/student path to open intervention rows via insert own
DROP POLICY IF EXISTS "LS interventions insert related" ON public.learning_system_interventions;
CREATE POLICY "LS interventions insert related" ON public.learning_system_interventions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff'))
  );
