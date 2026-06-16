-- Migration: English Homework Framework
-- Description: Creates schema for English materials, submissions, and RPCs for tracking homework. Includes one-way sync from morning_duty_logs.
-- Date: 2026-06-17

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tables and Triggers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.english_materials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    subject text NOT NULL DEFAULT 'English',
    type text,
    is_active boolean NOT NULL DEFAULT true,
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    notion_page_id text,
    last_synced_at timestamptz,
    CONSTRAINT unique_subject_name UNIQUE (subject, name),
    CONSTRAINT check_type_valid CHECK (type IN ('作業','課本','補充') OR type IS NULL)
);

CREATE TABLE IF NOT EXISTS public.english_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    material_id uuid NOT NULL REFERENCES public.english_materials(id) ON DELETE CASCADE,
    record_date date NOT NULL,
    class text,
    status text NOT NULL DEFAULT 'missing' CHECK (status IN ('submitted','missing','made_up','needs_correction','corrected','absent')),
    made_up_date date,
    late_days int GENERATED ALWAYS AS (
        CASE WHEN made_up_date IS NOT NULL THEN GREATEST(made_up_date - record_date, 0) ELSE NULL END
    ) STORED,
    needs_correction_followup boolean NOT NULL DEFAULT false,
    followup_started_at timestamptz,
    followup_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    notion_page_id text,
    last_synced_at timestamptz,
    CONSTRAINT unique_student_material_date UNIQUE (student_id, material_id, record_date)
);

CREATE INDEX IF NOT EXISTS idx_english_submissions_class_date ON public.english_submissions(class, record_date);
CREATE INDEX IF NOT EXISTS idx_english_submissions_student ON public.english_submissions(student_id);

-- Trigger: auto-touch updated_at
CREATE OR REPLACE FUNCTION public.trg_english_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_english_submissions_updated_at ON public.english_submissions;
CREATE TRIGGER trg_english_submissions_updated_at
BEFORE UPDATE ON public.english_submissions
FOR EACH ROW EXECUTE FUNCTION public.trg_english_submissions_updated_at();

-- Trigger: track followup_started_at
CREATE OR REPLACE FUNCTION public.trg_english_submissions_followup()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.needs_correction_followup = true AND OLD.needs_correction_followup = false THEN
        NEW.followup_started_at = now();
    ELSIF NEW.needs_correction_followup = false AND OLD.needs_correction_followup = true THEN
        NEW.followup_started_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_english_submissions_followup ON public.english_submissions;
CREATE TRIGGER trg_english_submissions_followup
BEFORE UPDATE ON public.english_submissions
FOR EACH ROW EXECUTE FUNCTION public.trg_english_submissions_followup();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Seed Data (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.english_materials (name, subject, sort_order)
VALUES 
    ('WS1', 'English', 1), ('WS2', 'English', 2), ('WS3', 'English', 3), 
    ('Pen', 'English', 4), ('GE(A)', 'English', 5), ('GE(B)', 'English', 6), 
    ('Word Bank', 'English', 7), ('RWD', 'English', 8), ('Dict C/S', 'English', 9), 
    ('Writing WS', 'English', 10), ('All-in-One', 'English', 11), 
    ('Handwriting', 'English', 12), ('Exam C/S', 'English', 13)
ON CONFLICT (subject, name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS Policies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.english_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can read english_materials" ON public.english_materials
    FOR SELECT TO authenticated USING (true); -- Publicly readable by authenticated

CREATE POLICY "Authorized users can read english_submissions" ON public.english_submissions
    FOR SELECT TO authenticated
    USING (public.is_authorized_for_class(auth.uid(), class) OR auth.uid() = student_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPCs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.add_english_material(
    p_name text, p_type text DEFAULT NULL
) RETURNS void AS $$
BEGIN
    -- Only staff/admin should call this, though auth check could be stricter
    INSERT INTO public.english_materials (name, type) VALUES (p_name, p_type)
    ON CONFLICT (subject, name) DO UPDATE SET is_active = true, type = COALESCE(EXCLUDED.type, english_materials.type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.archive_english_material(
    p_material_id uuid
) RETURNS void AS $$
BEGIN
    UPDATE public.english_materials SET is_active = false WHERE id = p_material_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.upsert_english_submission(
    p_student_id uuid, p_material_id uuid, p_record_date date,
    p_class text, p_status text, p_made_up_date date DEFAULT NULL
) RETURNS void AS $$
DECLARE v_actor_id uuid := auth.uid();
BEGIN
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized for class %', p_class;
    END IF;
    INSERT INTO public.english_submissions (student_id, material_id, record_date, class, status, made_up_date)
    VALUES (p_student_id, p_material_id, p_record_date, p_class, p_status, p_made_up_date)
    ON CONFLICT (student_id, material_id, record_date) DO UPDATE SET
        status = EXCLUDED.status,
        made_up_date = COALESCE(EXCLUDED.made_up_date, english_submissions.made_up_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_english_correction_followup(
    p_submission_id uuid, p_value boolean, p_notes text DEFAULT NULL
) RETURNS void AS $$
DECLARE 
    v_class text;
    v_actor_id uuid := auth.uid();
BEGIN
    SELECT class INTO v_class FROM public.english_submissions WHERE id = p_submission_id;
    IF NOT public.is_authorized_for_class(v_actor_id, v_class) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    UPDATE public.english_submissions 
    SET needs_correction_followup = p_value,
        followup_notes = COALESCE(p_notes, followup_notes)
    WHERE id = p_submission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_english_submissions(
    p_class text, p_start date, p_end date
) RETURNS TABLE (
    id uuid, student_id uuid, material_id uuid, record_date date, class text, 
    status text, made_up_date date, late_days int, needs_correction_followup boolean,
    followup_started_at timestamptz, followup_notes text
) AS $$
DECLARE v_actor_id uuid := auth.uid();
BEGIN
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    RETURN QUERY
    SELECT es.id, es.student_id, es.material_id, es.record_date, es.class, 
           es.status, es.made_up_date, es.late_days, es.needs_correction_followup,
           es.followup_started_at, es.followup_notes
    FROM public.english_submissions es
    WHERE es.class = p_class AND es.record_date BETWEEN p_start AND p_end;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_english_followup_queue(
    p_class text
) RETURNS TABLE (
    id uuid, student_id uuid, material_id uuid, record_date date, class text, 
    status text, made_up_date date, late_days int, needs_correction_followup boolean,
    followup_started_at timestamptz, followup_notes text
) AS $$
DECLARE v_actor_id uuid := auth.uid();
BEGIN
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    RETURN QUERY
    SELECT es.id, es.student_id, es.material_id, es.record_date, es.class, 
           es.status, es.made_up_date, es.late_days, es.needs_correction_followup,
           es.followup_started_at, es.followup_notes
    FROM public.english_submissions es
    WHERE es.class = p_class 
      AND es.needs_correction_followup = true 
      AND es.status <> 'corrected'
    ORDER BY es.followup_started_at ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.add_english_material(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_english_material(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_english_submission(uuid, uuid, date, text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_english_correction_followup(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_english_submissions(text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_english_followup_queue(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Modify existing upsert_morning_duty_log RPC to include One-Way Sync
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_morning_duty_log(
    p_log_date       date,
    p_student_id     uuid,
    p_status         text,
    p_set_by         text,
    p_snapshot_0830  text        DEFAULT NULL,
    p_snapshot_0835  text        DEFAULT NULL,
    p_reminded       boolean     DEFAULT NULL,
    p_made_up        boolean     DEFAULT NULL,
    p_made_up_at     timestamptz DEFAULT NULL,
    p_notes          text        DEFAULT NULL,
    p_missing_items  jsonb       DEFAULT NULL,
    p_event_type     text        DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_class             text;
    v_actor_id          uuid    := auth.uid();
    v_current_awarded   integer := 0;
    v_current_handbook  boolean := false;
    v_target_coins      integer := 0;
    v_delta             integer;
    v_reason            text;
    
    -- Sync variables
    v_final_missing_items jsonb;
    v_item_name text;
    v_material_id uuid;
    v_current_english_items text[] := '{}';
BEGIN
    -- Resolve class and authorise
    SELECT class INTO v_class FROM public.users WHERE id = p_student_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;
    IF NOT public.is_authorized_for_class(v_actor_id, v_class) THEN
        RAISE EXCEPTION 'Not authorized to manage logs for student in class %', v_class;
    END IF;

    -- Read existing coin and handbook state (for delta calculation)
    SELECT coins_awarded, handbook_written
    INTO   v_current_awarded, v_current_handbook
    FROM   public.morning_duty_logs
    WHERE  student_id = p_student_id AND log_date = p_log_date;

    -- Propagate event type into session config for downstream triggers
    IF p_event_type IS NOT NULL THEN
        PERFORM set_config('app.morning_duty_event_type', p_event_type, true);
    END IF;

    -- ── Coin target logic ────────────────────────────────────────────────────
    IF p_status = 'submitted' THEN
        v_target_coins := 20;
        v_reason       := '完成班務（交齊功課）';
    ELSIF p_status = 'missing' THEN
        IF v_current_handbook THEN
            v_target_coins := 20;
            v_reason       := '完成班務（寫手冊）';
        ELSE
            v_target_coins := 10;
            v_reason       := '完成班務（欠功課）';
        END IF;
    ELSE
        -- absent / todo / any other value → no coins
        v_target_coins := 0;
        v_reason       := 'Class Dashboard Revert';
    END IF;

    v_delta := v_target_coins - COALESCE(v_current_awarded, 0);

    IF v_delta != 0 THEN
        PERFORM public.increment_room_coins(
            p_student_id, v_delta, v_reason, v_actor_id, NULL, false
        );
    END IF;

    -- ── Upsert ───────────────────────────────────────────────────────────────
    INSERT INTO public.morning_duty_logs (
        log_date, student_id, class, status, set_by,
        snapshot_0830, snapshot_0835,
        reminded, made_up, made_up_at, notes,
        missing_items, coins_awarded, updated_at
    )
    VALUES (
        p_log_date, p_student_id, v_class, p_status, p_set_by,
        p_snapshot_0830, p_snapshot_0835,
        COALESCE(p_reminded, false), COALESCE(p_made_up, false),
        p_made_up_at, p_notes,
        p_missing_items, v_target_coins, now()
    )
    ON CONFLICT (log_date, student_id) DO UPDATE SET
        status       = EXCLUDED.status,
        set_by       = EXCLUDED.set_by,
        snapshot_0830  = COALESCE(EXCLUDED.snapshot_0830,  morning_duty_logs.snapshot_0830),
        snapshot_0835  = COALESCE(EXCLUDED.snapshot_0835,  morning_duty_logs.snapshot_0835),
        reminded       = COALESCE(EXCLUDED.reminded,       morning_duty_logs.reminded),
        made_up        = COALESCE(EXCLUDED.made_up,        morning_duty_logs.made_up),
        made_up_at     = COALESCE(EXCLUDED.made_up_at,     morning_duty_logs.made_up_at),
        notes          = COALESCE(EXCLUDED.notes,          morning_duty_logs.notes),
        missing_items  = COALESCE(EXCLUDED.missing_items,  morning_duty_logs.missing_items),
        coins_awarded  = EXCLUDED.coins_awarded,
        handbook_written    = CASE
                                  WHEN EXCLUDED.status != 'missing' THEN false
                                  ELSE morning_duty_logs.handbook_written
                              END,
        handbook_written_at = CASE
                                  WHEN EXCLUDED.status != 'missing' THEN NULL
                                  ELSE morning_duty_logs.handbook_written_at
                              END,
        updated_at = now();

    -- ── Sync English Homework ──────────────────────────────────────────────────
    SELECT missing_items INTO v_final_missing_items 
    FROM public.morning_duty_logs 
    WHERE log_date = p_log_date AND student_id = p_student_id;

    IF p_status != 'absent' THEN
        -- Upsert current english items from JSON
        IF v_final_missing_items ? '英文' THEN
            FOR v_item_name IN SELECT jsonb_array_elements_text(v_final_missing_items->'英文') LOOP
                SELECT id INTO v_material_id FROM public.english_materials WHERE name = v_item_name AND subject = 'English' AND is_active = true;
                IF FOUND THEN
                    v_current_english_items := array_append(v_current_english_items, v_item_name);
                    -- One-way sync: insert missing, DO NOTHING on conflict (don't overwrite made_up/corrected)
                    INSERT INTO public.english_submissions (student_id, material_id, record_date, class, status)
                    VALUES (p_student_id, v_material_id, p_log_date, v_class, 'missing')
                    ON CONFLICT (student_id, material_id, record_date) DO NOTHING;
                END IF;
            END LOOP;
        END IF;

        -- Reconcile: delete rows that are STILL 'missing' but no longer in the morning duty JSON
        DELETE FROM public.english_submissions es
        USING public.english_materials em
        WHERE es.material_id = em.id
          AND es.student_id = p_student_id
          AND es.record_date = p_log_date
          AND em.subject = 'English'
          AND es.status = 'missing'
          AND (cardinality(v_current_english_items) = 0 OR em.name != ALL(v_current_english_items));
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

