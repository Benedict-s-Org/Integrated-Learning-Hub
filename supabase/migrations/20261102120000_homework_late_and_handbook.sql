-- On-time vs late hand-in, plus a daily handbook mark.
-- The existing 9-argument checker stays in place so the current site keeps working.
-- The new overload records whether the hand-in was late.

ALTER TABLE public.english_homework_checks
  ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false;

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
    handed_in, needs_correction, is_complete, is_late, updated_at, updated_by
  ) VALUES (
    p_class, p_date, p_subject, btrim(p_item), COALESCE(p_detail, ''), p_student_id,
    v_handed_in, v_correction, v_complete, false, now(), v_actor_id
  )
  ON CONFLICT (class_name, record_date, subject, item_name, detail, student_id)
  DO UPDATE SET
    handed_in = EXCLUDED.handed_in,
    needs_correction = EXCLUDED.needs_correction,
    is_complete = EXCLUDED.is_complete,
    is_late = false,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_english_homework_check(
  p_class text,
  p_date date,
  p_subject text,
  p_item text,
  p_detail text,
  p_student_id uuid,
  p_handed_in boolean,
  p_needs_correction boolean,
  p_is_complete boolean,
  p_is_late boolean
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
  v_late boolean := COALESCE(p_is_late, false);
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
    v_late := false;
  END IF;

  INSERT INTO public.english_homework_checks (
    class_name, record_date, subject, item_name, detail, student_id,
    handed_in, needs_correction, is_complete, is_late, updated_at, updated_by
  ) VALUES (
    p_class, p_date, p_subject, btrim(p_item), COALESCE(p_detail, ''), p_student_id,
    v_handed_in, v_correction, v_complete, v_late, now(), v_actor_id
  )
  ON CONFLICT (class_name, record_date, subject, item_name, detail, student_id)
  DO UPDATE SET
    handed_in = EXCLUDED.handed_in,
    needs_correction = EXCLUDED.needs_correction,
    is_complete = EXCLUDED.is_complete,
    is_late = EXCLUDED.is_late,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_english_homework_check(text, date, text, text, text, uuid, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_english_homework_check(text, date, text, text, text, uuid, boolean, boolean, boolean, boolean) TO authenticated;

CREATE TABLE IF NOT EXISTS public.homework_handbook_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name text NOT NULL,
  record_date date NOT NULL,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (student_id, record_date)
);

ALTER TABLE public.homework_handbook_marks ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.homework_handbook_marks TO authenticated;

DROP POLICY IF EXISTS "Staff can view homework handbook marks" ON public.homework_handbook_marks;
CREATE POLICY "Staff can view homework handbook marks"
  ON public.homework_handbook_marks FOR SELECT TO authenticated
  USING (public.is_authorized_for_class(auth.uid(), class_name));

CREATE OR REPLACE FUNCTION public.set_homework_handbook(
  p_class text,
  p_date date,
  p_student_id uuid,
  p_written boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_class text := btrim(COALESCE(p_class, ''));
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_class = '' OR p_student_id IS NULL OR p_date IS NULL THEN
    RAISE EXCEPTION 'Class, date, and student are required';
  END IF;
  IF NOT public.is_authorized_for_class(v_actor_id, v_class) THEN
    RAISE EXCEPTION 'Not authorized for class %', v_class;
  END IF;

  IF COALESCE(p_written, false) THEN
    INSERT INTO public.homework_handbook_marks (class_name, record_date, student_id, created_by)
    VALUES (v_class, p_date, p_student_id, v_actor_id)
    ON CONFLICT (student_id, record_date) DO UPDATE SET
      class_name = EXCLUDED.class_name,
      created_by = EXCLUDED.created_by;
  ELSE
    DELETE FROM public.homework_handbook_marks
    WHERE student_id = p_student_id AND record_date = p_date;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_homework_handbook(text, date, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_homework_handbook(text, date, uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
