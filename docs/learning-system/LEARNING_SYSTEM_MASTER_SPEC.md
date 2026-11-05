# Learning System — Master Spec

> **Status:** Phase 0 inspection complete (2026-11-02). Baseline = user Master Implementation Prompt. Confirmed revisions go to `LEARNING_SYSTEM_DECISIONS.md` and sync here.
> **Product:** Integrated Learning System inside existing Integrated Learning Hub (SRS + Proofreading first round). Not a parallel prototype.

## 1. Positioning

- Integrates **SRS** and **Proofreading** under one Learning System entry, sharing micro-skills, grade “taught” checklist, Assignment System, and User Analytic.
- Content scope: school English scheme **P1–P6** is the pacing reference (DEC-20261105-01); deploy priority **P3 / P4**; P1–P2 as prior-grade review / remediation sources. P5–P6 schedules are stored; completing those banks is still out of this round.
- Records **grammar micro-skill performance**, not overall English ability.
- Does **not** implement legacy mixed scoring (150 total, Tier A–D, SRS 80% + Proofreading 20%). None found active in repo as of Phase 0; if discovered later, report before deleting.

## 2. Confirmed requirements (baseline)

### 2.1 Navigation

Order under Learning (DEC-20261102-08; supersedes Master Prompt §4.1 wording):

`Class Dashboard` → `Paragraph Memorization` → **`Learning System`** → `Proofreading` → … → `Spaced Repetition` → (rest unchanged)

- Reuse sidebar look, expand/collapse, active state, permission model.
- Learning System is a **hub** combining grammar SRS + Proofreading. Standalone Proofreading and Spaced Repetition nav items **remain**. All three coexist (DEC-20261102-09).

### 2.2 Assignment + Progress

- Link into existing student Assignment System via new **`learning_system`** assignment type (DEC-20261102-20): assign → deep-link → complete. Legacy standalone SRS completion gap left as-is this round.
- Student progress surfaces under **My Progress → User Analytic** (student vs teacher by permission).
- SRS and Proofreading stats stay **separate**.
- Teacher remediation state is **not** shown on student per-Set Progress Page.

### 2.3 Notion content

- Both channels continue to source questions from **Notion databases** (import → Supabase persistence as today).
- Learning System uses **two new** Notion DBs — SRS MCQ and Proofreading — each with **`Micro-skill ID`** (DEC-20261102-13, DEC-20261102-14). User builds these DBs; Hub does not rely on a primary page-id→skill mapping table.
- Items without Micro-skill ID are ineligible for LS sets (gap report).
- No hard-coded mock bank as “done”; no bulk overwrite of live banks without authorization.

### 2.4 Curriculum vs micro-skills

| Source | Role |
|--------|------|
| S.T.F.A. Lee Kam Primary School English schedules, 2026–27, P.1–P.6 | **Local pacing reference** (DEC-20261105-01). When a structure is taught. Indexed in `data/school-curriculum-2026-27/`. Suggestion only — teachers still tick the grade checklist. |
| `HK_Primary_Grammar_24_Stage_Curriculum_EN.xlsx` | Year/stage **scope** only (24 stages proposed; 143 objective rows ≠ micro-skills; M1–M16 = book chapter indexes). If year placement disagrees with the school schedule, the schedule wins. |
| Longman English Grammar Practice (L.G. Alexander) | Rule / classification reference for micro-skill authoring |
| Primary Longman Express 3e | No longer the pacing source. Do not confuse it with the Alexander book. |

Taxonomy: **Chapter → concept/branch → Micro-skill → questions**. Stable IDs independent of chapter order. One primary micro-skill per item; other tags secondary.

**Granularity (DEC-20261102-23/24):** `can` is a **modal verb** family (not under present simple). Affirmative **can** and **can't** share one skill (**modal can + bare infinitive**); polarity is a tag. **Third-person singular marking** and **third-person singular spelling** are separate skills; spelling **-s / -es / -ies** share one skill. **Irregular simple past (common verbs)** may start as one bucket. Specs and UI use full English terms (avoid unexplained abbreviations).

Round-1 split scope: applicability, form choice, spelling variants, irregular forms. Out of scope: structure-position-as-skill, advanced meaning contrast, rule-interaction taxonomy.

### 2.5 Grade “taught” checklist

- **Shared per grade** (not per student / class section). Grade key derived from `users.class` (DEC-20261102-12), e.g. `3A`→`P3`.
- Teacher ticks taught micro-skills for that grade.
- All channels (review, first-set, remediation) may only serve checklist-allowed skills for the student’s grade.
- Curriculum suggestion ≠ taught; SRS due does not bypass checklist; untaught ≠ weakness; prior-grade content must also be marked taught on **current** grade checklist.
- Shortage of eligible items → report gap; never silently serve untaught skills.

### 2.6 SRS sets

- **10 questions per set** inside the Learning System hub only (DEC-20261102-10). Standalone Spaced Repetition keeps its existing session-size UX.
- First use / no weakness: **6 current-grade taught + 4 prior-grade taught**.
- Ordinary review: existing due SM-2 schedule among eligible items (not forced 6-same-skill every set).
- Remediation: **6 same target micro-skill + 4 due schedule**.
- Keep existing SM-2; add skill + taught filters. Conflict → document solution, do not silently replace algorithm.

### 2.7 Valid attempts

- First submit before reveal counts; post-reveal edits recorded separately, do not inflate valid counts.
- Later independent set can count new valid attempt.
- Demo / non-assessment excluded from formal stats.
- Retries within same submit do not double-score.
- Persist: student, question version, skill, set, answer, correctness, time, validity flag.
- **Storage (DEC-20261102-11):** Learning System uses its own attempt store with `is_valid`; standalone SRS attempt semantics unchanged. LS analytics/weakness use LS valid attempts only.

### 2.8 Potential weakness + remediation

- Per micro-skill, last **20 valid SRS** attempts; activate only when n≥20.
- Accuracy **&lt; 80%** → Potential Weakness (exactly 80% does not).
- Loop: explain → 6 same-skill → pass if ≥5/6; else second loop; after two fails → teacher path (DEC-20261102-17).
- Multi-skill priority (DEC-20261102-15): teacher pin/lock first; else lowest accuracy (&lt;80%, n≥20); ties → most recent fail → skill id.
- Pass on 6-item check ≠ long-term mastery. After pass: clear auto-remediation; re-arm only after **20 new ordinary** valid attempts, then re-evaluate &lt;80% (DEC-20261102-16).
- After two fails (DEC-20261102-17): pause dense remediation; student does ordinary sets; highlight in User Analytics + teacher Progress; teacher **"Teacher followed up"** button records follow-up and unlocks restart; one notify per open intervention. Students still must not see teacher FSM on their set Progress Page (§11).

### 2.9 Student Progress Page (per set)

Show: just-finished 10-item performance, weakness-relevant explanations / **tips** (DEC-20261102-19: tips live here, not during scored answering).
Hide from student: skill breakdown rates, remediation FSM, loop counts, teacher flags, next-set mode.
Scored LS sets: no tip/Help coaching UI during answering.

### 2.10 SRS charts (analytics, not live weakness engine)

1. Per-skill line: non-overlapping batches of 25 valid attempts; point = batch accuracy; X = batch completion date; no zero-fill.
2. Every two completed sets → stacked bar over 20 items; height = correct/20; segments by skill of **correct** items only (per spec §12.2).
3. Click bar → pie of same 20: each item 5%; skill × correct/incorrect wedges; correct leftish / incorrect rightish; accessible labels.

### 2.11 Proofreading

- Reuse existing exercise; one error per sentence.
- Persist find vs correct separately; find correct is precondition for correction success credit.
- Correction match: case-insensitive trimmed **exact** match only (DEC-20261102-18); no synonym/AI equivalence this round.
- Separate stats from SRS; no SRS charts for proofreading; do not apply SRS 80%/20 weakness gates to proofreading.

## 3. Non-goals (this round)

- P5–P6 / secondary content completion. The 2026–27 P5–P6 schedules stay in the pacing reference only.
- Structure-position and advanced meaning micro-skill systems.
- Legacy composite scoring.
- Replacing SM-2 with a new scheduler.
- Second Assignment System.

## 4. External assets (Phase 0 verified)

| Asset | Path / status |
|-------|----------------|
| School schedules 2026–27 | `docs/learning-system/data/school-curriculum-2026-27/` — P.1–P.6 grammar pacing from the enclosed English teaching schedules. PDFs are not stored in git. |
| Curriculum Excel | `C:\Users\bened\Downloads\HK_Primary_Grammar_24_Stage_Curriculum_EN.xlsx` — readable; 5 sheets; 143 objectives; P1–P4 = 95 rows |
| Longman extract | `C:\AI\PersonalOS\Automation\logs\extracts\RUN-20261102-183433-432b7b\Longman_English_Grammar_Practice_intermediate_Self_Study_Edition.md` — OCR extract (~981 KB); copyrighted; use as reference only |
| AI for skill drafting | **Grok not required** (DEC-20261102-07). Phase 1 samples authored from Excel + Longman structure; optional later bulk via Flowith (`claude-3-5-sonnet` / `gpt-4o`). Runtime scoring is non-LLM. |

## 5. Traceability

| Doc | Purpose |
|-----|---------|
| This file | Confirmed product requirements |
| `LEARNING_SYSTEM_DECISIONS.md` | Open questions + resolved decisions |
| `LEARNING_SYSTEM_IMPLEMENTATION_PLAN.md` | Phases, tasks, acceptance |
| `LEARNING_SYSTEM_REQUIREMENTS_CHECKLIST.md` | Requirement → code / test mapping |

Update all four after every completed phase.
