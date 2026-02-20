-- Create Spaced Repetition Sessions table for persistence
-- Allows users to resume interrupted learning sessions

CREATE TABLE IF NOT EXISTS public.spaced_repetition_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  set_id text NOT NULL, -- UUID string or 'global'
  current_question_index integer NOT NULL DEFAULT 0,
  questions jsonb NOT NULL, -- Snapshot of questions for the session
  results jsonb NOT NULL DEFAULT '[]'::jsonb, -- Accumulated results
  session_start_time timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, set_id)
);

-- Enable RLS
ALTER TABLE public.spaced_repetition_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own sessions"
  ON public.spaced_repetition_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can maintain all sessions"
  ON public.spaced_repetition_sessions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_sr_sessions_user_set ON public.spaced_repetition_sessions(user_id, set_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_sr_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_sr_sessions_updated_at
  BEFORE UPDATE ON public.spaced_repetition_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_sr_sessions_updated_at();
