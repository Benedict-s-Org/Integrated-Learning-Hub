-- Allow class staff to update the homework catalog sub_options used by
-- Class Dashboard HomeworkModal. Staff could previously SELECT the row and
-- upsert daily_homework, but UPDATE on class_rewards was admin-only.
-- PostgREST then returned success with 0 rows, so the new option vanished
-- after refetch while setup could still write the name into daily_homework
-- (causing duplicates when an admin later added the same option).

DROP POLICY IF EXISTS "Class staff can update homework catalog options" ON public.class_rewards;
CREATE POLICY "Class staff can update homework catalog options"
ON public.class_rewards
FOR UPDATE
TO authenticated
USING (
  public.is_class_staff(auth.uid())
  AND title = '完成班務（欠功課）'
)
WITH CHECK (
  public.is_class_staff(auth.uid())
  AND title = '完成班務（欠功課）'
);
