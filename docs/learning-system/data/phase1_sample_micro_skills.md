# Phase 1 — Sample Micro-skills (granularity review)

> **Status:** **FROZEN** 2026-11-02 (DEC-20261102-25). Seeded via migration `20261103000100_learning_system_micro_skills_and_checklist.sql` + `phase1_sample_micro_skills.json`.  
> **Rules:** One primary skill per item · stable IDs ≠ Longman M# · Excel rows = scope links only · no copyrighted exercise copy · round-1 split = form choice / applicability / spelling variants / irregulars (not structure-position).  
> **Terms:** Use full English labels (e.g. third-person singular, bare infinitive, modal can) — no unexplained abbreviations.  
> **Model policy:** DEC-20261102-07 (no Grok requirement).  
> **DEC-20261102-23:** `can` = modal family (not present simple); third-person singular **marking** ≠ **spelling**; spelling **-s/-es/-ies** = one skill.

## Proposed ID scheme

`ms_<domain>_<concept>_<branch>_<nn>`  
Example: `ms_modal_can_bare_infinitive_01`  
IDs never change when chapters are reordered.

## Sample set (11 skills after merge)

### A. Modal verbs: can (NOT under present simple — DEC-20261102-23)

#### 1. `ms_modal_can_bare_infinitive_01`
| Field | Value |
|-------|--------|
| Chapter / concept / branch | Longman M11 Modal auxiliaries → Ability → **modal can + bare infinitive** |
| Name | modal can + bare infinitive |
| Measures | After `can` / `can't` / `cannot`, choose the **bare infinitive** (not third-person singular -s, -ing, or past) |
| Boundary | Modal family — **not** present-simple third-person singular; does not primary-test permission vs ability meaning; not `Can I…?`. Affirmative and negative share this skill (DEC-20261102-24). |
| Stem / options example | `Peter can ___ very fast.` → `run` / `runs` / `running` / `ran` · also `She can't ___ a bike.` → `ride` / … |
| Variation tags | `polarity:affirmative` \| `polarity:negative` (tag only; same skill id) |
| Longman | M11.2 (ability) — rule reference only |
| Excel links | P2-S1-H1 `can/can't for ability`; P3-S1-H1 ability consolidation |
| Status | `active` (frozen seed) |

#### 2. `ms_modal_can_request_01`
| Field | Value |
|-------|--------|
| Chapter / concept / branch | M11 → Permission / request → **Can I…?** |
| Name | modal Can I…? request |
| Measures | Request frame `Can I` + bare infinitive (not `Can I to` / wrong auxiliary) |
| Boundary | Not past ability `could`; not ability statement `I can swim`; still modal, not present simple |
| Excel | P3-S1-H1 `Polite requests with Can I…?` |
| Status | `draft` |

---

### B. Do / Does — negation & interrogative (prompt-assigned splits)

#### 3. `ms_do_does_negation_bare_01`
| Field | Value |
|-------|--------|
| Chapter / concept / branch | M13 / M9 → Does → **Negation** |
| Name | doesn't → base verb |
| Measures | After `doesn't`, choose **base** (not 3sg -s) |
| Boundary | Not `don't` with I/you/we/they; not question form |
| Example | `He doesn't ___ coffee.` → `like` / `likes` / `liking` / `liked` |
| Excel | P2-S1-H2 `don't/doesn't`; P2-S2-H1 `Base form after doesn't` |
| Status | `draft` |

#### 4. `ms_do_does_interrogative_bare_01`
| Field | Value |
|-------|--------|
| Chapter / concept / branch | M13 / M9 → Does → **Interrogative** |
| Name | Does … ___? → base verb |
| Measures | In `Does + subject + ___?`, gap is **base** |
| Boundary | Not negation; not `Do` with plural; not short-answer Yes/No alone |
| Example | `Does she ___ the piano?` → `play` / `plays` / `playing` / `played` |
| Excel | P2-S2-H1 `do/does questions` |
| Status | `draft` |

#### 5. `ms_do_dont_negation_bare_01`
| Field | Value |
|-------|--------|
| Chapter / concept / branch | M13 → Don't → Negation (non-3sg) |
| Name | don't → base verb |
| Measures | After `don't`, base form with I/you/we/they |
| Boundary | Not `doesn't`; subject–auxiliary agreement is a **different** skill if tested alone |
| Excel | P2-S1-H2 |
| Status | `draft` |

---

### C. Present simple — third-person singular (marking vs spelling)

#### 6. `ms_present_simple_third_person_singular_marking_01`
| Field | Value |
|-------|--------|
| Chapter / concept / branch | M9 Verbs → present simple → **third-person singular marking** |
| Name | third-person singular marking |
| Measures | For he/she/it present habits/facts, choose a **marked** form rather than bare infinitive |
| Boundary | Does **not** test which ending (-s / -es / -ies); that is skill 8. Not modal can. |
| Example | `Tom ___ to school every day.` → `walks` / `walk` / `walking` / `walked` |
| Excel | P2-S2-H1 third-person singular |
| Status | `draft` — **confirmed split** (DEC-20261102-23) |

#### 7. `ms_present_simple_third_person_singular_spelling_01`
| Field | Value |
|-------|--------|
| Chapter / concept / branch | M9 → present simple → **third-person singular spelling** |
| Name | third-person singular spelling (-s / -es / -ies) |
| Measures | Given that marking is required, choose the correct spelling among **-s / -es / -ies** patterns (one skill, not three) |
| Boundary | Not “whether to mark”; assumes marking is known. Examples: watch→watches, go→goes, fly→flies, walk→walks |
| Example | `She ___ TV at night.` → `watches` / `watchs` / `watch` / `watching` |
| Excel | P2-S2-H1 |
| Status | `draft` — **confirmed** marking≠spelling; -s/-es/-ies same skill (DEC-20261102-23) |

---

### D. Be / past auxiliaries (P3 deploy relevance)

#### 8. `ms_past_did_bare_01`
| Field | Value |
|-------|--------|
| Chapter / concept / branch | M9 / M13 → did → bare infinitive |
| Name | did/didn't → base verb |
| Measures | After `did` / `didn't`, verb is **base** (not past V2) |
| Boundary | Not irregular V2 spelling in affirmative past without did |
| Example | `Did you ___ the door?` → `open` / `opened` / `opens` / `opening` |
| Excel | P3-S2-H1 `did/didn't + base form` |
| Status | `draft` |

#### 9. `ms_past_irregular_simple_past_common_01`
| Field | Value |
|-------|--------|
| Chapter / concept / branch | M9.3 → Irregular verbs → **common irregular simple past** (bucket) |
| Name | irregular simple past (common verbs) |
| Measures | Choose correct irregular **simple past** in affirmative (no did) — e.g. go/went, see/saw |
| Boundary | Not did + bare infinitive; not past participle |
| Excel | P3-S2-H1 past events |
| Status | `draft` — **bucket OK** for Phase 1 (DEC-20261102-24); refine verb list later |

---

### E. Quantity / articles (P1–P3 foundation used in P3/P4 review)

#### 10. `ms_article_a_an_sound_01`
| Field | Value |
|-------|--------|
| Chapter / concept / branch | M3 Articles → a/an → **by sound** |
| Name | a / an by initial sound |
| Measures | Choose a/an from **sound**, not letter alone |
| Boundary | Not the vs a; not zero article |
| Excel | P1-S1-H2 `Choosing a/an` (prior-grade review for P3/P4) |
| Status | `draft` |

#### 11. `ms_quant_some_any_01`
| Field | Value |
|-------|--------|
| Chapter / concept / branch | M5 Quantity → some/any |
| Name | some vs any (basic) |
| Measures | some in affirmatives; any in negatives/questions (taught pattern) |
| Boundary | Not a lot of; not much/many |
| Excel | P3-S1-H2 `some/any/a lot of` — **this sample only covers some/any**; a lot of = separate skill later |
| Status | `draft` |

---

## Granularity decisions log

| Topic | Decision |
|-------|----------|
| modal can vs present simple | **Separate** — can is modal (DEC-20261102-23) |
| third-person singular marking vs spelling | **Separate skills** |
| -s / -es / -ies | **One** spelling skill |
| Terminology | Full English terms in docs/UI |

## Still open

_(none for this sample batch)_

## Done after freeze

- [x] Freeze 11 sample IDs  
- [x] DB schema + seed migration  
- [x] JSON + TS seed constants  
- [ ] Notion property list for the two new DBs (next)  
- [ ] Teacher grade taught checklist UI  
