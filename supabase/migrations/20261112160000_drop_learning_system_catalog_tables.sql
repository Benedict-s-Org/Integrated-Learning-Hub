-- Micro-skill list, SRS examples, and proofreading sentences live in Notion.
-- Progress rows keep skill_id as plain text. Foreign keys are removed first so
-- dropping the catalog does not delete taught ticks, attempts, or set history.

ALTER TABLE public.grade_taught_checklists
  DROP CONSTRAINT IF EXISTS grade_taught_checklists_skill_id_fkey;
ALTER TABLE public.learning_system_attempts
  DROP CONSTRAINT IF EXISTS learning_system_attempts_skill_id_fkey;
ALTER TABLE public.learning_system_interventions
  DROP CONSTRAINT IF EXISTS learning_system_interventions_skill_id_fkey;
ALTER TABLE public.learning_system_sets
  DROP CONSTRAINT IF EXISTS learning_system_sets_target_skill_id_fkey;
ALTER TABLE public.learning_system_skill_states
  DROP CONSTRAINT IF EXISTS learning_system_skill_states_skill_id_fkey;

DROP TABLE IF EXISTS public.grammar_skill_curriculum_links;
DROP TABLE IF EXISTS public.grammar_micro_skills;
