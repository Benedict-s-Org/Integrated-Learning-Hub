-- Migration: Morning Duty System Database Schema
-- Description: Adds tables and functions for class morning duty logs, settings, and events.
-- Date: 2026-06-12 (Asia/Hong_Kong local timezone configured)

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS group_no integer,
ADD COLUMN IF NOT EXISTS is_group_leader boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.morning_duty_settings (
    class text PRIMARY KEY,
    enabled boolean NOT NULL DEFAULT true,
    alarm_url text,
    times jsonb,
    messages jsonb,
    weekdays integer[] NOT NULL DEFAULT '{}',
    silent_recess boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.morning_duty_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date date NOT NULL DEFAULT ((now() at time zone 'Asia/Hong_Kong')::date),
    student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    class text,
    status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'submitted', 'missing', 'absent', 'late')),
    set_by text NOT NULL DEFAULT 'system' CHECK (set_by IN ('self', 'leader', 'teacher', 'system')),
    snapshot_0830 text CHECK (snapshot_0830 IN ('todo', 'submitted', 'missing', 'absent', 'late')),
    snapshot_0835 text CHECK (snapshot_0835 IN ('todo', 'submitted', 'missing', 'absent', 'late')),
    reminded boolean NOT NULL DEFAULT false,
    made_up boolean NOT NULL DEFAULT false,
    made_up_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_log_date_student UNIQUE (log_date, student_id)
);

CREATE TABLE IF NOT EXISTS public.morning_duty_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id uuid REFERENCES public.morning_duty_logs(id) ON DELETE CASCADE,
    student_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    class text,
    event_type text NOT NULL CHECK (event_type IN ('student_click', 'leader_confirm', 'marked_absent', 'makeup_submitted', 'alarm_fired', 'snapshot_0830', 'snapshot_0835', 'system_init', 'status_change')),
    status_value text,
    actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_morning_duty_logs_date_class ON public.morning_duty_logs(log_date, class);
CREATE INDEX IF NOT EXISTS idx_morning_duty_logs_student ON public.morning_duty_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_morning_duty_events_student_created ON public.morning_duty_events(student_id, created_at);

CREATE OR REPLACE FUNCTION public.trg_morning_duty_logs_before_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.class IS NULL THEN
        SELECT class INTO NEW.class FROM public.users WHERE id = NEW.student_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_morning_duty_logs_before_insert
BEFORE INSERT ON public.morning_duty_logs
FOR EACH ROW EXECUTE FUNCTION public.trg_morning_duty_logs_before_insert();

CREATE OR REPLACE FUNCTION public.trg_morning_duty_logs_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_event_type text;
    v_status_value text;
BEGIN
    v_event_type := NULLIF(current_setting('app.morning_duty_event_type', true), '');
    IF v_event_type IS NULL THEN
        IF TG_OP = 'INSERT' THEN
            v_event_type := 'system_init';
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.status = 'absent' AND OLD.status IS DISTINCT FROM 'absent' THEN
                v_event_type := 'marked_absent';
            ELSIF NEW.made_up = true AND OLD.made_up IS DISTINCT FROM true THEN
                v_event_type := 'makeup_submitted';
            ELSIF NEW.snapshot_0830 IS NOT NULL AND OLD.snapshot_0830 IS NULL THEN
                v_event_type := 'snapshot_0830';
            ELSIF NEW.snapshot_0835 IS NOT NULL AND OLD.snapshot_0835 IS NULL THEN
                v_event_type := 'snapshot_0835';
            ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
                v_event_type := 'student_click';
            ELSE
                v_event_type := 'status_change';
            END IF;
        END IF;
    END IF;

    v_status_value := NEW.status;

    INSERT INTO public.morning_duty_events (
        log_id, student_id, class, event_type, status_value, actor_id, created_at
    ) VALUES (
        NEW.id, NEW.student_id, NEW.class, v_event_type, v_status_value, v_actor_id, now()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_morning_duty_logs_audit_after
AFTER INSERT OR UPDATE ON public.morning_duty_logs
FOR EACH ROW EXECUTE FUNCTION public.trg_morning_duty_logs_audit();

ALTER TABLE public.morning_duty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morning_duty_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morning_duty_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff/Admins can read settings" ON public.morning_duty_settings
    FOR SELECT TO authenticated
    USING (public.is_authorized_for_class(auth.uid(), class));

CREATE POLICY "Staff/Admins can read logs" ON public.morning_duty_logs
    FOR SELECT TO authenticated
    USING (public.is_authorized_for_class(auth.uid(), class));

CREATE POLICY "Staff/Admins can read events" ON public.morning_duty_events
    FOR SELECT TO authenticated
    USING (public.is_authorized_for_class(auth.uid(), class));

CREATE OR REPLACE FUNCTION public.save_morning_duty_settings(
    p_class text, p_enabled boolean, p_alarm_url text, p_times jsonb,
    p_messages jsonb, p_weekdays int[], p_silent_recess boolean
) RETURNS void AS $$
DECLARE v_actor_id uuid := auth.uid();
BEGIN
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized to manage settings for class %', p_class;
    END IF;
    INSERT INTO public.morning_duty_settings (class, enabled, alarm_url, times, messages, weekdays, silent_recess, updated_at)
    VALUES (p_class, p_enabled, p_alarm_url, p_times, p_messages, p_weekdays, p_silent_recess, now())
    ON CONFLICT (class) DO UPDATE SET
        enabled = EXCLUDED.enabled, alarm_url = EXCLUDED.alarm_url, times = EXCLUDED.times,
        messages = EXCLUDED.messages, weekdays = EXCLUDED.weekdays,
        silent_recess = EXCLUDED.silent_recess, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.upsert_morning_duty_log(
    p_log_date date, p_student_id uuid, p_status text, p_set_by text,
    p_snapshot_0830 text, p_snapshot_0835 text, p_reminded boolean,
    p_made_up boolean, p_made_up_at timestamptz, p_notes text, p_event_type text DEFAULT NULL
) RETURNS void AS $$
DECLARE v_class text; v_actor_id uuid := auth.uid();
BEGIN
    SELECT class INTO v_class FROM public.users WHERE id = p_student_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;
    IF NOT public.is_authorized_for_class(v_actor_id, v_class) THEN
        RAISE EXCEPTION 'Not authorized to manage logs for student in class %', v_class;
    END IF;
    IF p_event_type IS NOT NULL THEN
        PERFORM set_config('app.morning_duty_event_type', p_event_type, true);
    END IF;
    INSERT INTO public.morning_duty_logs (log_date, student_id, class, status, set_by, snapshot_0830, snapshot_0835, reminded, made_up, made_up_at, notes, updated_at)
    VALUES (p_log_date, p_student_id, v_class, p_status, p_set_by, p_snapshot_0830, p_snapshot_0835, p_reminded, p_made_up, p_made_up_at, p_notes, now())
    ON CONFLICT (log_date, student_id) DO UPDATE SET
        status = EXCLUDED.status, set_by = EXCLUDED.set_by,
        snapshot_0830 = COALESCE(EXCLUDED.snapshot_0830, morning_duty_logs.snapshot_0830),
        snapshot_0835 = COALESCE(EXCLUDED.snapshot_0835, morning_duty_logs.snapshot_0835),
        reminded = EXCLUDED.reminded, made_up = EXCLUDED.made_up,
        made_up_at = EXCLUDED.made_up_at, notes = EXCLUDED.notes, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.initialize_morning_duty_logs(
    p_class text, p_date date DEFAULT ((now() at time zone 'Asia/Hong_Kong')::date)
) RETURNS void AS $$
DECLARE v_actor_id uuid := auth.uid();
BEGIN
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized for class %', p_class;
    END IF;
    INSERT INTO public.morning_duty_logs (log_date, student_id, class, status, set_by)
    SELECT p_date, id, p_class, 'todo', 'system'
    FROM public.users WHERE class = p_class AND role = 'user'
    ON CONFLICT (log_date, student_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.capture_morning_duty_snapshot_0830(
    p_class text, p_date date DEFAULT ((now() at time zone 'Asia/Hong_Kong')::date)
) RETURNS void AS $$
DECLARE v_actor_id uuid := auth.uid();
BEGIN
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized for class %', p_class;
    END IF;
    INSERT INTO public.morning_duty_logs (log_date, student_id, class, status, set_by)
    SELECT p_date, id, p_class, 'todo', 'system'
    FROM public.users WHERE class = p_class AND role = 'user'
    ON CONFLICT (log_date, student_id) DO NOTHING;
    PERFORM set_config('app.morning_duty_event_type', 'snapshot_0830', true);
    UPDATE public.morning_duty_logs l SET snapshot_0830 = l.status, updated_at = now()
    WHERE l.class = p_class AND l.log_date = p_date AND l.snapshot_0830 IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.capture_morning_duty_snapshot_0835(
    p_class text, p_date date DEFAULT ((now() at time zone 'Asia/Hong_Kong')::date)
) RETURNS void AS $$
DECLARE v_actor_id uuid := auth.uid();
BEGIN
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized for class %', p_class;
    END IF;
    INSERT INTO public.morning_duty_logs (log_date, student_id, class, status, set_by)
    SELECT p_date, id, p_class, 'todo', 'system'
    FROM public.users WHERE class = p_class AND role = 'user'
    ON CONFLICT (log_date, student_id) DO NOTHING;
    PERFORM set_config('app.morning_duty_event_type', 'snapshot_0835', true);
    UPDATE public.morning_duty_logs l SET snapshot_0835 = l.status, updated_at = now()
    WHERE l.class = p_class AND l.log_date = p_date AND l.snapshot_0835 IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.log_morning_duty_event(
    p_class text, p_event_type text, p_status_value text DEFAULT NULL,
    p_student_id uuid DEFAULT NULL, p_log_id uuid DEFAULT NULL
) RETURNS void AS $$
DECLARE v_actor_id uuid := auth.uid();
BEGIN
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized for class %', p_class;
    END IF;
    INSERT INTO public.morning_duty_events (log_id, student_id, class, event_type, status_value, actor_id, created_at)
    VALUES (p_log_id, p_student_id, p_class, p_event_type, p_status_value, v_actor_id, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_morning_duty_stats(
    p_class text, p_start date, p_end date
) RETURNS TABLE (
    student_id uuid, username text, display_name text,
    total_days bigint, submitted_days bigint, missing_days bigint, absent_days bigint,
    needs_reminding_days bigint, ignored_after_reminding_days bigint,
    outstanding_days bigint, submission_rate numeric
) AS $$
DECLARE v_actor_id uuid := auth.uid();
BEGIN
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized to view stats for class %', p_class;
    END IF;
    RETURN QUERY
    SELECT
        u.id AS student_id, u.username, u.display_name,
        COALESCE(COUNT(l.id), 0)::bigint AS total_days,
        COALESCE(SUM(CASE WHEN l.status = 'submitted' THEN 1 ELSE 0 END), 0)::bigint AS submitted_days,
        COALESCE(SUM(CASE WHEN l.status = 'missing' THEN 1 ELSE 0 END), 0)::bigint AS missing_days,
        COALESCE(SUM(CASE WHEN l.status = 'absent' THEN 1 ELSE 0 END), 0)::bigint AS absent_days,
        COALESCE(SUM(CASE WHEN l.snapshot_0830 = 'todo' AND l.status = 'submitted' THEN 1 ELSE 0 END), 0)::bigint AS needs_reminding_days,
        COALESCE(SUM(CASE WHEN l.snapshot_0835 IN ('todo', 'missing') THEN 1 ELSE 0 END), 0)::bigint AS ignored_after_reminding_days,
        COALESCE(SUM(CASE WHEN l.status = 'missing' AND l.made_up = false THEN 1 ELSE 0 END), 0)::bigint AS outstanding_days,
        CASE WHEN COUNT(l.id) > 0
            THEN ROUND((SUM(CASE WHEN l.status = 'submitted' THEN 1 ELSE 0 END)::numeric / COUNT(l.id)::numeric) * 100, 2)
            ELSE 0.00 END AS submission_rate
    FROM public.users u
    LEFT JOIN public.morning_duty_logs l ON u.id = l.student_id AND l.log_date BETWEEN p_start AND p_end
    WHERE u.class = p_class AND u.role = 'user'
    GROUP BY u.id, u.username, u.display_name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.save_morning_duty_settings(text, boolean, text, jsonb, jsonb, int[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_morning_duty_log(date, uuid, text, text, text, text, boolean, boolean, timestamptz, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_morning_duty_logs(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_morning_duty_snapshot_0830(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_morning_duty_snapshot_0835(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_morning_duty_event(text, text, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_morning_duty_stats(text, date, date) TO authenticated;
