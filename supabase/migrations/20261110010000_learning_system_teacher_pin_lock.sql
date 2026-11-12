-- Staff-only remediation pin, and no student delete of skill state.
-- The practice client still inserts and updates the student's own row so the
-- remediation state machine can run. teacher_pin stays as stored unless the
-- caller is admin or class_staff.

CREATE OR REPLACE FUNCTION public.learning_system_preserve_teacher_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT u.role INTO v_role
  FROM public.users u
  WHERE u.id = auth.uid();

  IF v_role IN ('admin', 'class_staff') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.teacher_pin := OLD.teacher_pin;
  ELSE
    NEW.teacher_pin := false;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.learning_system_preserve_teacher_pin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.learning_system_preserve_teacher_pin() FROM anon, authenticated;

DROP TRIGGER IF EXISTS learning_system_preserve_teacher_pin ON public.learning_system_skill_states;
CREATE TRIGGER learning_system_preserve_teacher_pin
  BEFORE INSERT OR UPDATE ON public.learning_system_skill_states
  FOR EACH ROW
  EXECUTE FUNCTION public.learning_system_preserve_teacher_pin();

DROP POLICY IF EXISTS "LS skill states upsert own or staff" ON public.learning_system_skill_states;

DROP POLICY IF EXISTS "LS skill states insert own or staff" ON public.learning_system_skill_states;
CREATE POLICY "LS skill states insert own or staff"
  ON public.learning_system_skill_states FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff')
    )
  );

DROP POLICY IF EXISTS "LS skill states update own or staff" ON public.learning_system_skill_states;
CREATE POLICY "LS skill states update own or staff"
  ON public.learning_system_skill_states FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff')
    )
  );

DROP POLICY IF EXISTS "LS skill states delete staff" ON public.learning_system_skill_states;
CREATE POLICY "LS skill states delete staff"
  ON public.learning_system_skill_states FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff')
    )
  );
