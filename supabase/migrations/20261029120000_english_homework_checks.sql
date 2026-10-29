-- English homework checkbox rows for Homework Management.
-- One row per class, date, item, page note, and student.

CREATE TABLE IF NOT EXISTS public.english_homework_checks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_name text NOT NULL,
    record_date date NOT NULL,
    subject text NOT NULL,
    item_name text NOT NULL,
    detail text NOT NULL DEFAULT '',
    student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    handed_in boolean NOT NULL DEFAULT false,
    needs_correction boolean NOT NULL DEFAULT false,
    is_complete boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid,
    CONSTRAINT unique_english_homework_check UNIQUE (class_name, record_date, subject, item_name, detail, student_id)
);

CREATE INDEX IF NOT EXISTS idx_english_homework_checks_class_date
    ON public.english_homework_checks (class_name, record_date);

ALTER TABLE public.english_homework_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read english homework checks" ON public.english_homework_checks;
CREATE POLICY "Staff can read english homework checks"
    ON public.english_homework_checks
    FOR SELECT
    TO authenticated
    USING (public.is_authorized_for_class(auth.uid(), class_name));

DROP FUNCTION IF EXISTS public.set_english_homework_check(text, date, text, text, text, uuid, boolean, boolean, boolean);

CREATE OR REPLACE FUNCTION public.set_english_homework_check(
    p_class text,
    p_date date,
    p_subject text,
    p_item text,
    p_detail text,
    p_student_id uuid,
    p_handed_in boolean,
    p_needs_correction boolean,
    p_is_complete boolean
) RETURNS public.english_homework_checks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_row public.english_homework_checks;
    v_handed_in boolean := COALESCE(p_handed_in, false);
    v_correction boolean := COALESCE(p_needs_correction, false);
    v_complete boolean := COALESCE(p_is_complete, false);
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized for class %', p_class;
    END IF;
    IF p_student_id IS NULL OR p_item IS NULL OR btrim(p_item) = '' THEN
        RAISE EXCEPTION 'Student and homework item are required';
    END IF;

    IF v_complete THEN
        v_handed_in := true;
    END IF;
    IF v_correction THEN
        v_handed_in := true;
    END IF;
    IF NOT v_handed_in THEN
        v_correction := false;
        v_complete := false;
    END IF;

    INSERT INTO public.english_homework_checks (
        class_name, record_date, subject, item_name, detail, student_id,
        handed_in, needs_correction, is_complete, updated_at, updated_by
    ) VALUES (
        p_class, p_date, p_subject, btrim(p_item), COALESCE(p_detail, ''), p_student_id,
        v_handed_in, v_correction, v_complete, now(), v_actor_id
    )
    ON CONFLICT (class_name, record_date, subject, item_name, detail, student_id)
    DO UPDATE SET
        handed_in = EXCLUDED.handed_in,
        needs_correction = EXCLUDED.needs_correction,
        is_complete = EXCLUDED.is_complete,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

GRANT SELECT ON public.english_homework_checks TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_english_homework_check(text, date, text, text, text, uuid, boolean, boolean, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
