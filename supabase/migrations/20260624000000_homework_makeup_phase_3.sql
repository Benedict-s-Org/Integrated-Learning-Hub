-- Migration: Homework Makeup Phase 3
-- Description: Adds homework_makeup_actions table and toggle RPC for interactive marking.

-- 1. Table
CREATE TABLE IF NOT EXISTS public.homework_makeup_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id uuid NOT NULL REFERENCES public.morning_duty_logs(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    class text NOT NULL,
    log_date date NOT NULL,
    subject text NOT NULL,
    item text NOT NULL,
    is_made_up boolean NOT NULL DEFAULT true,
    marked_by uuid NOT NULL REFERENCES auth.users(id),
    marked_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_log_subject_item UNIQUE (log_id, subject, item)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_homework_makeup_actions_log_id ON public.homework_makeup_actions(log_id);
CREATE INDEX IF NOT EXISTS idx_homework_makeup_actions_class_date ON public.homework_makeup_actions(class, log_date);

-- 3. RLS
ALTER TABLE public.homework_makeup_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff/Admins can read homework makeup actions" ON public.homework_makeup_actions
    FOR SELECT TO authenticated
    USING (public.is_authorized_for_class(auth.uid(), class));

-- 4. RPC
CREATE OR REPLACE FUNCTION public.toggle_homework_makeup(p_log_id uuid, p_subject text, p_item text)
RETURNS public.homework_makeup_actions AS $$
DECLARE
    v_log record;
    v_actor_id uuid := auth.uid();
    v_action public.homework_makeup_actions;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Load log info
    SELECT class, log_date, student_id INTO v_log
    FROM public.morning_duty_logs
    WHERE id = p_log_id;

    IF v_log IS NULL THEN
        RAISE EXCEPTION 'Morning duty log not found';
    END IF;

    -- Permission check
    IF NOT public.is_authorized_for_class(v_actor_id, v_log.class) THEN
        RAISE EXCEPTION 'Not authorized for class %', v_log.class;
    END IF;

    -- Upsert action
    INSERT INTO public.homework_makeup_actions (
        log_id, student_id, class, log_date, subject, item, is_made_up, marked_by, marked_at
    ) VALUES (
        p_log_id, v_log.student_id, v_log.class, v_log.log_date, p_subject, p_item, true, v_actor_id, now()
    )
    ON CONFLICT (log_id, subject, item) DO UPDATE SET
        is_made_up = NOT public.homework_makeup_actions.is_made_up,
        marked_by = EXCLUDED.marked_by,
        marked_at = EXCLUDED.marked_at
    RETURNING * INTO v_action;

    RETURN v_action;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.toggle_homework_makeup(uuid, text, text) TO authenticated;
