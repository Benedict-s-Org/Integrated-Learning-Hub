-- The class-staff SELECT policy on public.users queried public.users to
-- check the caller role. That re-entered the same policy and raised
-- 42P17 (infinite recursion), so Homework Management could not load
-- the class list. Read the role through a SECURITY DEFINER helper.

CREATE OR REPLACE FUNCTION public.is_class_staff(input_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = input_user_id
      AND role = 'class_staff'
  );
$$;

DROP POLICY IF EXISTS "Class staff can view managed class students" ON public.users;
CREATE POLICY "Class staff can view managed class students"
ON public.users
FOR SELECT
TO authenticated
USING (
  public.is_class_staff(auth.uid())
  AND class IS NOT NULL
  AND public.is_authorized_for_class(auth.uid(), class)
);
