-- Learning System Phase 1: micro-skills taxonomy, curriculum links, grade taught checklist
-- Grade keys: P.1–P.6 (aligned with essay-marking parseGradeFromClassName)
-- Checklist starts empty (taught=false); teachers tick — never auto-fill from Excel.

CREATE TABLE IF NOT EXISTS public.grammar_micro_skills (
  id text PRIMARY KEY,
  name text NOT NULL,
  measures text NOT NULL,
  boundary text,
  chapter_ref text,
  concept text,
  branch text,
  longman_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  example_stem text,
  example_options jsonb,
  example_correct_index integer,
  variation_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'active', 'retired')),
  round1_in_scope boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grammar_skill_curriculum_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id text NOT NULL REFERENCES public.grammar_micro_skills(id) ON DELETE CASCADE,
  stage_code text NOT NULL,
  year_level integer NOT NULL CHECK (year_level BETWEEN 1 AND 6),
  excel_learning_item text NOT NULL,
  classification text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_id, stage_code, excel_learning_item)
);

CREATE TABLE IF NOT EXISTS public.grade_taught_checklists (
  grade_key text NOT NULL
    CHECK (grade_key IN ('P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6')),
  skill_id text NOT NULL REFERENCES public.grammar_micro_skills(id) ON DELETE CASCADE,
  taught boolean NOT NULL DEFAULT false,
  taught_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  taught_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (grade_key, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_grammar_skill_curriculum_links_skill
  ON public.grammar_skill_curriculum_links(skill_id);
CREATE INDEX IF NOT EXISTS idx_grammar_skill_curriculum_links_year
  ON public.grammar_skill_curriculum_links(year_level);
CREATE INDEX IF NOT EXISTS idx_grade_taught_checklists_taught
  ON public.grade_taught_checklists(grade_key, taught);

ALTER TABLE public.grammar_micro_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_skill_curriculum_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_taught_checklists ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read taxonomy + checklist (eligibility needs taught flags)
DROP POLICY IF EXISTS "Authenticated read grammar_micro_skills" ON public.grammar_micro_skills;
CREATE POLICY "Authenticated read grammar_micro_skills"
  ON public.grammar_micro_skills FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated read grammar_skill_curriculum_links" ON public.grammar_skill_curriculum_links;
CREATE POLICY "Authenticated read grammar_skill_curriculum_links"
  ON public.grammar_skill_curriculum_links FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated read grade_taught_checklists" ON public.grade_taught_checklists;
CREATE POLICY "Authenticated read grade_taught_checklists"
  ON public.grade_taught_checklists FOR SELECT TO authenticated
  USING (true);

-- Staff write access
DROP POLICY IF EXISTS "Staff manage grammar_micro_skills" ON public.grammar_micro_skills;
CREATE POLICY "Staff manage grammar_micro_skills"
  ON public.grammar_micro_skills FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff')
    )
  );

DROP POLICY IF EXISTS "Staff manage grammar_skill_curriculum_links" ON public.grammar_skill_curriculum_links;
CREATE POLICY "Staff manage grammar_skill_curriculum_links"
  ON public.grammar_skill_curriculum_links FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff')
    )
  );

DROP POLICY IF EXISTS "Staff manage grade_taught_checklists" ON public.grade_taught_checklists;
CREATE POLICY "Staff manage grade_taught_checklists"
  ON public.grade_taught_checklists FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff')
    )
  );

-- Seed Phase 1 frozen sample skills (idempotent upsert)
INSERT INTO public.grammar_micro_skills (
  id, name, measures, boundary, chapter_ref, concept, branch, longman_refs,
  example_stem, example_options, example_correct_index, variation_tags, status, round1_in_scope
) VALUES
(
  'ms_modal_can_bare_infinitive_01',
  'modal can + bare infinitive',
  'After can / can''t / cannot, choose the bare infinitive (not third-person singular -s, -ing, or past).',
  'Modal verb family — not present-simple third-person singular. Affirmative and negative share this skill. Does not primary-test permission vs ability meaning; not Can I…? requests.',
  'M11', 'Modal auxiliaries', 'Ability — can + bare infinitive',
  '["M11.2"]'::jsonb,
  'Peter can ___ very fast.',
  '["run","runs","running","ran"]'::jsonb, 0,
  '["polarity:affirmative","polarity:negative"]'::jsonb,
  'active', true
),
(
  'ms_modal_can_request_01',
  'modal Can I…? request',
  'Request frame Can I + bare infinitive (not Can I to / wrong auxiliary).',
  'Not past ability could; not ability statement I can swim; still modal, not present simple.',
  'M11', 'Modal auxiliaries', 'Permission / request — Can I…?',
  '["M11.3","M11.6"]'::jsonb,
  '___ I open the window, please?',
  '["Can","Do","Does","Am"]'::jsonb, 0,
  '[]'::jsonb,
  'active', true
),
(
  'ms_do_does_negation_bare_01',
  'doesn''t + bare infinitive',
  'After doesn''t, choose the bare infinitive (not third-person singular -s).',
  'Not don''t with I/you/we/they; not interrogative Does…?',
  'M13', 'Questions, answers, negatives', 'Does — Negation',
  '["M13.1","M9.1"]'::jsonb,
  'He doesn''t ___ coffee.',
  '["like","likes","liking","liked"]'::jsonb, 0,
  '[]'::jsonb,
  'active', true
),
(
  'ms_do_does_interrogative_bare_01',
  'Does … ___? + bare infinitive',
  'In Does + subject + ___?, the gap is the bare infinitive.',
  'Not negation; not Do with plural subjects; not Yes/No short answers alone.',
  'M13', 'Questions, answers, negatives', 'Does — Interrogative',
  '["M13.1","M9.1"]'::jsonb,
  'Does she ___ the piano?',
  '["play","plays","playing","played"]'::jsonb, 0,
  '[]'::jsonb,
  'active', true
),
(
  'ms_do_dont_negation_bare_01',
  'don''t + bare infinitive',
  'After don''t, choose the bare infinitive with I/you/we/they.',
  'Not doesn''t; subject–auxiliary agreement alone is a different skill if tested separately.',
  'M13', 'Questions, answers, negatives', 'Don''t — Negation',
  '["M13.1"]'::jsonb,
  'They don''t ___ meat.',
  '["eat","eats","eating","ate"]'::jsonb, 0,
  '[]'::jsonb,
  'active', true
),
(
  'ms_present_simple_third_person_singular_marking_01',
  'third-person singular marking',
  'For he/she/it present habits/facts, choose a marked form rather than the bare infinitive.',
  'Does not test which ending (-s / -es / -ies); that is third-person singular spelling. Not modal can.',
  'M9', 'Verbs, verb tenses', 'Present simple — third-person singular marking',
  '["M9.1","M9.2"]'::jsonb,
  'Tom ___ to school every day.',
  '["walks","walk","walking","walked"]'::jsonb, 0,
  '[]'::jsonb,
  'active', true
),
(
  'ms_present_simple_third_person_singular_spelling_01',
  'third-person singular spelling (-s / -es / -ies)',
  'Given that marking is required, choose the correct spelling among -s / -es / -ies patterns (one skill).',
  'Not whether to mark; assumes marking is known. Examples: watch→watches, go→goes, fly→flies, walk→walks.',
  'M9', 'Verbs, verb tenses', 'Present simple — third-person singular spelling',
  '["M9.1","M9.2"]'::jsonb,
  'She ___ TV at night.',
  '["watches","watchs","watch","watching"]'::jsonb, 0,
  '[]'::jsonb,
  'active', true
),
(
  'ms_past_did_bare_01',
  'did / didn''t + bare infinitive',
  'After did / didn''t, choose the bare infinitive (not simple past).',
  'Not irregular simple past in affirmative without did.',
  'M9', 'Verbs, verb tenses', 'did + bare infinitive',
  '["M9.3","M13.1"]'::jsonb,
  'Did you ___ the door?',
  '["open","opened","opens","opening"]'::jsonb, 0,
  '[]'::jsonb,
  'active', true
),
(
  'ms_past_irregular_simple_past_common_01',
  'irregular simple past (common verbs)',
  'Choose the correct irregular simple past in affirmative (no did) — e.g. go/went, see/saw.',
  'Not did + bare infinitive; not past participle. Common-verb bucket for Phase 1; refine verb list later.',
  'M9', 'Verbs, verb tenses', 'Irregular simple past (common bucket)',
  '["M9.3"]'::jsonb,
  'Yesterday we ___ to the park.',
  '["went","go","goes","going"]'::jsonb, 0,
  '[]'::jsonb,
  'active', true
),
(
  'ms_article_a_an_sound_01',
  'a / an by initial sound',
  'Choose a/an from initial sound, not letter alone.',
  'Not the vs a; not zero article.',
  'M3', 'Articles', 'a/an by sound',
  '["M3.1","M3.2"]'::jsonb,
  'She has ___ umbrella.',
  '["an","a","the","—"]'::jsonb, 0,
  '[]'::jsonb,
  'active', true
),
(
  'ms_quant_some_any_01',
  'some vs any (basic)',
  'some in affirmatives; any in negatives/questions (taught pattern).',
  'Not a lot of; not much/many. a lot of is a separate skill later.',
  'M5', 'Quantity', 'some / any',
  '["M5.1","M5.3"]'::jsonb,
  'There aren''t ___ apples left.',
  '["any","some","a","an"]'::jsonb, 0,
  '[]'::jsonb,
  'active', true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  measures = EXCLUDED.measures,
  boundary = EXCLUDED.boundary,
  chapter_ref = EXCLUDED.chapter_ref,
  concept = EXCLUDED.concept,
  branch = EXCLUDED.branch,
  longman_refs = EXCLUDED.longman_refs,
  example_stem = EXCLUDED.example_stem,
  example_options = EXCLUDED.example_options,
  example_correct_index = EXCLUDED.example_correct_index,
  variation_tags = EXCLUDED.variation_tags,
  status = EXCLUDED.status,
  round1_in_scope = EXCLUDED.round1_in_scope,
  updated_at = now();

INSERT INTO public.grammar_skill_curriculum_links (skill_id, stage_code, year_level, excel_learning_item, classification)
VALUES
  ('ms_modal_can_bare_infinitive_01', 'P2-S1-H1', 2, 'can/can''t for ability and possible activities', 'Stage core - placement proposed'),
  ('ms_modal_can_bare_infinitive_01', 'P3-S1-H1', 3, 'Ability with and/but/or', 'Stage core - placement proposed'),
  ('ms_modal_can_request_01', 'P3-S1-H1', 3, 'Polite requests with Can I…?', 'Stage core - placement proposed'),
  ('ms_do_does_negation_bare_01', 'P2-S1-H2', 2, 'Introducing don''t/doesn''t negatives', 'Stage core - placement proposed'),
  ('ms_do_does_negation_bare_01', 'P2-S2-H1', 2, 'Base form after doesn''t', 'Stage core - placement proposed'),
  ('ms_do_does_interrogative_bare_01', 'P2-S2-H1', 2, 'do/does questions and short answers', 'Stage core - placement proposed'),
  ('ms_do_dont_negation_bare_01', 'P2-S1-H2', 2, 'Introducing don''t/doesn''t negatives', 'Stage core - placement proposed'),
  ('ms_present_simple_third_person_singular_marking_01', 'P2-S2-H1', 2, 'Third-person singular in new examples', 'Consolidation / integration'),
  ('ms_present_simple_third_person_singular_spelling_01', 'P2-S2-H1', 2, 'Third-person singular in new examples', 'Consolidation / integration'),
  ('ms_past_did_bare_01', 'P3-S2-H1', 3, 'did/didn''t + base form', 'Stage core - placement proposed'),
  ('ms_past_irregular_simple_past_common_01', 'P3-S2-H1', 3, 'Basic questions about past events', 'Stage core - placement proposed'),
  ('ms_article_a_an_sound_01', 'P1-S1-H2', 1, 'Choosing a/an', 'Stage core - placement proposed'),
  ('ms_quant_some_any_01', 'P3-S1-H2', 3, 'some/any/a lot of', 'Stage core - placement proposed')
ON CONFLICT (skill_id, stage_code, excel_learning_item) DO NOTHING;

-- Ensure checklist rows exist for P.1–P.4 × all active seed skills, taught=false
INSERT INTO public.grade_taught_checklists (grade_key, skill_id, taught)
SELECT g.grade_key, s.id, false
FROM (VALUES ('P.1'), ('P.2'), ('P.3'), ('P.4')) AS g(grade_key)
CROSS JOIN public.grammar_micro_skills s
WHERE s.status = 'active'
ON CONFLICT (grade_key, skill_id) DO NOTHING;
