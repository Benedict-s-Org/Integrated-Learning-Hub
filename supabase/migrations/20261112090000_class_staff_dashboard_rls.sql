-- Allow Class Assistants to use Class Dashboard behavior shortcuts and
-- resolve student names in missing-homework announcements.
-- Root cause: RLS only allowed JWT role=admin to read class_rewards / other users.

-- 1) Reward catalog (shortcuts resolve rewardId → class_rewards row)
DROP POLICY IF EXISTS "Authenticated can read class rewards" ON public.class_rewards;
CREATE POLICY "Authenticated can read class rewards"
ON public.class_rewards
FOR SELECT
TO authenticated
USING (true);

-- 2) Class staff can read students in their managed classes
-- (needed for announcement joins + English homework missing names)
-- Role is read through a SECURITY DEFINER helper. A SELECT on public.users
-- inside a public.users policy re-enters RLS and raises 42P17.
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

-- 3) Class staff can manage shortcuts for assigned class keys
DROP POLICY IF EXISTS "Class staff can manage assigned class shortcuts" ON public.dashboard_shortcuts;
CREATE POLICY "Class staff can manage assigned class shortcuts"
ON public.dashboard_shortcuts
FOR ALL
TO authenticated
USING (public.is_authorized_for_class(auth.uid(), name))
WITH CHECK (public.is_authorized_for_class(auth.uid(), name));
