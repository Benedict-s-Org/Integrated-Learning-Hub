-- Allow the first-visit proofreading concept check as a Learning System set mode.
-- Existing practice modes stay valid. The check does not feed SM-2 or remediation.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'learning_system_sets'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%mode%'
  LOOP
    EXECUTE format('ALTER TABLE public.learning_system_sets DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.learning_system_sets
  ADD CONSTRAINT learning_system_sets_mode_check
  CHECK (mode IN ('first_mix', 'ordinary_review', 'remediation', 'concept_check'));
