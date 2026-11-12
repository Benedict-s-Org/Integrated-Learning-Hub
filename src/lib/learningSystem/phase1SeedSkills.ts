/** Frozen Phase 1 seed skill IDs (DEC-20261102-25). Source of truth also in DB + docs JSON. */

export const PHASE1_SEED_SKILL_IDS = [
  'ms_modal_can_bare_infinitive_01',
  'ms_modal_can_request_01',
  'ms_do_does_negation_bare_01',
  'ms_do_does_interrogative_bare_01',
  'ms_do_dont_negation_bare_01',
  'ms_present_simple_third_person_singular_marking_01',
  'ms_present_simple_third_person_singular_spelling_01',
  'ms_past_did_bare_01',
  'ms_past_irregular_simple_past_common_01',
  'ms_article_a_an_sound_01',
  'ms_quant_some_any_01',
] as const;

export type Phase1SeedSkillId = (typeof PHASE1_SEED_SKILL_IDS)[number];
