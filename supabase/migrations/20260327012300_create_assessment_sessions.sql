-- ============================================================
-- Handwriting Assessment System — Database Schema
-- ============================================================
-- Single-table design for assessment sessions.
-- Each row holds a full session: grip + pressure + handwriting.
-- Synced between iPhone and iPad via Supabase Realtime.
-- ============================================================

-- ─── Table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.assessment_sessions (
    -- Identity
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_code          TEXT UNIQUE NOT NULL,
    student_name          TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'in_progress'
                            CHECK (status IN ('in_progress', 'grip_done', 'writing_done', 'complete')),

    -- Grip analysis (iPhone)
    grip_type             TEXT,
    grip_confidence       FLOAT,
    grip_snapshot_url     TEXT,
    grip_thumb_position   TEXT,
    grip_completed_at     TIMESTAMPTZ,

    -- Pressure analysis (iPad)
    avg_pressure          FLOAT,
    max_pressure          FLOAT,
    pressure_variance     FLOAT,
    fatigue_index         FLOAT,
    pressure_zone         TEXT,
    pressure_data         JSONB,            -- Raw [{ time, pressure, x, y }] samples
    writing_completed_at  TIMESTAMPTZ,

    -- Handwriting analysis (Gemini Vision)
    letter_clarity        INT CHECK (letter_clarity    BETWEEN 1 AND 5),
    size_consistency      INT CHECK (size_consistency  BETWEEN 1 AND 5),
    line_adherence        INT CHECK (line_adherence    BETWEEN 1 AND 5),
    letter_formation      INT CHECK (letter_formation  BETWEEN 1 AND 5),
    spacing               INT CHECK (spacing           BETWEEN 1 AND 5),
    problem_letters       JSONB,            -- e.g. ["b", "d", "p"]
    handwriting_sample_url TEXT,
    ai_suggestions        TEXT,
    analysis_completed_at TIMESTAMPTZ,

    -- Teacher / meta
    teacher_notes         TEXT,
    writing_prompt        TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add a comment to the table for documentation
COMMENT ON TABLE public.assessment_sessions IS
  'Handwriting assessment sessions for P.3/P.4 students. '
  'Each row tracks one dual-device session across grip, pressure, and AI analysis phases.';

-- ─── Index ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_assessment_sessions_session_code
    ON public.assessment_sessions (session_code);

CREATE INDEX IF NOT EXISTS idx_assessment_sessions_status
    ON public.assessment_sessions (status)
    WHERE status != 'complete';

-- ─── Row Level Security ──────────────────────────────────────

ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users full access (for now).
-- This will be tightened in a future migration once user roles
-- and ownership semantics for assessments are finalised.

CREATE POLICY "Authenticated users can read assessment sessions"
    ON public.assessment_sessions
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create assessment sessions"
    ON public.assessment_sessions
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update assessment sessions"
    ON public.assessment_sessions
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Admins can delete sessions
CREATE POLICY "Admins can delete assessment sessions"
    ON public.assessment_sessions
    FOR DELETE
    USING (
        public.is_admin() OR
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ─── Realtime ────────────────────────────────────────────────
-- Enable Realtime so iPhone ↔ iPad can sync via Supabase channels.

ALTER PUBLICATION supabase_realtime ADD TABLE public.assessment_sessions;

-- ─── Session Code Generator ─────────────────────────────────
-- Generates a random 6-digit numeric code and retries if a
-- collision is found among active (non-complete) sessions.

CREATE OR REPLACE FUNCTION public.generate_session_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a random 6-digit string (000000–999999)
        new_code := lpad(floor(random() * 1000000)::int::text, 6, '0');

        -- Check if this code is already in use by a non-complete session
        SELECT EXISTS (
            SELECT 1
            FROM public.assessment_sessions
            WHERE session_code = new_code
              AND status != 'complete'
        ) INTO code_exists;

        -- If unique among active sessions, return it
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_session_code() IS
  'Generates a unique 6-digit numeric session code for device pairing. '
  'Only checks uniqueness against active (non-complete) sessions.';

-- ─── Storage Bucket ──────────────────────────────────────────
-- Bucket for grip snapshots and handwriting sample images.

INSERT INTO storage.buckets (id, name, public)
VALUES ('assessment-snapshots', 'assessment-snapshots', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for assessment-snapshots bucket
CREATE POLICY "Authenticated users can upload assessment snapshots"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'assessment-snapshots'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can update assessment snapshots"
    ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'assessment-snapshots'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Public read access for assessment snapshots"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'assessment-snapshots');

CREATE POLICY "Admins can delete assessment snapshots"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'assessment-snapshots'
        AND (
            public.is_admin() OR
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
    );
