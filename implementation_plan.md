# Add Homework Exemption Feature

This plan adds a new feature allowing teachers to mark a student as "Exempted" during morning duty checking. Exempted students visually move to the Done lane with a special badge, and their previous state (including missing homework records) is preserved.

## Proposed Changes

### Database Migration

#### [NEW] `supabase/migrations/XXXXXXXXXXXXXX_add_homework_exemptions.sql`
- Add `'exempted'` to the `morning_duty_logs_status_check` constraint.
- Create table `public.homework_exemptions`:
  ```sql
  CREATE TABLE public.homework_exemptions (
      log_id uuid PRIMARY KEY REFERENCES public.morning_duty_logs(id) ON DELETE CASCADE,
      previous_lane text NOT NULL,
      previous_missing_homework jsonb,
      reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      set_by uuid REFERENCES public.users(id) ON DELETE SET NULL
  );
  ALTER TABLE public.homework_exemptions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Staff/Admins can read exemptions" ON public.homework_exemptions
      FOR SELECT TO authenticated
      USING (public.is_authorized_for_class(auth.uid(), (SELECT class FROM public.morning_duty_logs WHERE id = homework_exemptions.log_id)));
  ```
- Create RPC `set_homework_exemption(p_log_id, p_is_exempted, p_previous_lane, p_previous_missing_homework, p_reason)` (SECURITY DEFINER):
  - If `p_is_exempted` is true:
    - Insert into `homework_exemptions` (log_id, previous_lane, previous_missing_homework, reason).
    - Update `morning_duty_logs` set `status = 'exempted'`.
  - If `p_is_exempted` is false:
    - Update `morning_duty_logs` set `status = previous_lane` and `missing_items = previous_missing_homework` (fetching from the existing exemption record).
    - Delete from `homework_exemptions`.
- Update `get_morning_duty_stats` if needed to count `exempted` as `submitted_days` or leave them out. (I will check how stats currently handles 'submitted'. Since exempted is not 'submitted', they won't count as submitted_days, which seems correct).

### Frontend Updates

#### [MODIFY] `src/components/MorningDuties/MorningDutiesPage.tsx`
- Add `exempted` to `RosterStudent` status type.
- Fetch `homework_exemptions` alongside `morning_duty_logs` or rely on the `status = 'exempted'` in the log to render correctly.
- Add "Exempted / 豁免" button in the status update modal.
- Render the light-blue badge ("Exempted") for students with `status === 'exempted'` in the Done lane (visually with the submitted students).
- When clicking an already exempted student, offer a way to "Remove Exemption".
- Implement the call to `supabase.rpc('set_homework_exemption', { ... })`.

## Open Questions
- Does `get_morning_duty_stats` need modification to explicitly include/exclude `exempted` in any of its counts? Currently, it only counts `status = 'submitted'` and `status = 'missing'`. `exempted` will naturally be excluded from these.

## Verification Plan
1. Apply the migration.
2. In the UI, click a student in "To Do", mark as Exempted. Verify they move to "Done" with a light-blue badge.
3. Click them again, remove exemption, verify they return to "To Do".
4. Mark a student as "Missing", add missing items if possible, then mark as Exempted. Remove exemption and verify their "Missing" state is preserved.
