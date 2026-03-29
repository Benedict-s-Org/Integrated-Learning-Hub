-- ============================================================
-- Handwriting Assessment System — Grip Snapshots
-- ============================================================
-- Table to store multiple grip observations per session.
-- This allows teachers to capture different angles or
-- progress shots during a single session.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.grip_snapshots (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
    grip_type         TEXT NOT NULL,
    confidence        FLOAT NOT NULL,
    recommendation_en TEXT,
    recommendation_zh TEXT,
    snapshot_url      TEXT, -- URL for the image
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_grip_snapshots_session_id
    ON public.grip_snapshots (session_id);

-- ─── RLS ─────────────────────────────────────────────────────

ALTER TABLE public.grip_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read grip snapshots"
    ON public.grip_snapshots
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create grip snapshots"
    ON public.grip_snapshots
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Enable Realtime for snapshots
ALTER PUBLICATION supabase_realtime ADD TABLE public.grip_snapshots;
