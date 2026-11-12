# Learning System — Implementation Plan

> **For agentic workers:** After clarifications on OPEN items that block the next phase, implement phase-by-phase. Prefer `superpowers:subagent-driven-development` or `executing-plans`. Do not skip acceptance or claim completion without verification evidence in the checklist.
>
> **Goal:** Deliver a verifiable Learning System (SRS + Proofreading) on Integrated Learning Hub with micro-skills, grade taught checklist, remediation, Assignment + analytics integration — without a parallel prototype stack.
>
> **Architecture:** Extend existing AppState navigation, Spaced Repetition SM-2 + Supabase tables, Proofreading practices/results, Unified Assignments RPCs, and User Analytic / Student Progress. Add skill taxonomy + grade checklist + Learning System session/attempt validity layer. Notion remains content source via existing import path.
>
> **Tech stack:** React + Vite, Supabase (Postgres/RPC/Edge), Notion via `notion-api`, existing Flowith/DeepSeek until Grok access resolved.

## Global constraints

- UI copy strictly English.
- Do not replace SM-2; wrap with filters.
- Do not invent scoring/pedagogy when OPEN in `LEARNING_SYSTEM_DECISIONS.md`.
- No browser automation for verification (project rule); ask user for UI checks.
- No bulk live Notion mutation without authorization.
- Update all four `docs/learning-system/*` files at phase end.

---

## Phase 0 — Inspection & plan — DONE 2026-11-02

**Deliverables:** This plan + master spec + decisions + checklist; inspection report to user.

**Acceptance:** User can hand off to another agent without chat memory; clarifications listed.

---

## Phase 1 — Curriculum & skill data

**Depends on:** CLAR-01 ✅; CLAR-08 ✅; CLAR-09 ✅ (DEC-20261102-13 — new Notion DBs with Micro-skill ID).

### Tasks

1. Keep the Excel guide as an external Hong Kong reference. The curriculum to follow is already indexed in `data/school-curriculum-2026-27/` (DEC-20261105-01).
2. Design tables (proposed names — adjust to naming conventions on implement):
   - `grammar_micro_skills` (stable id, chapter refs, labels, boundaries, examples, status)
   - `grammar_skill_curriculum_links` (school unit id from the 2026–27 index; Excel stage only as an external-guide note)
   - `grade_taught_checklists` (grade_key → skill_id → taught_by, taught_at)
3. Hand-author **representative sample** micro-skills (Can / Does→Negation / Does→Interrogative / 3sg form vs spelling) for granularity review — **do not mass-generate until user confirms sample**.
4. Propose Notion property + Hub-side mapping; migration for existing `notion_page_id` rows.
5. Teacher UI sketch for grade checklist (admin/staff).

### Acceptance

- Sample skills reviewed by user.
- Schema migration drafted/applied in staging.
- Checklist empty-by-default; no auto-tick from Excel.
- Drafting model policy per DEC-20261102-07; each bulk run logs model id if Flowith used.

---

## Phase 2 — SRS selection, validity, weakness, remediation

**Depends on:** Phase 1 schema; CLAR-03 ✅; CLAR-04 ✅; CLAR-05 ✅; CLAR-06 ✅; CLAR-07 ✅ (DEC-20261102-17).

### Tasks

1. ~~Learning System session builder: set size 10; eligibility = taught ∩ available questions.~~ **DONE (pure)** — `eligibility.ts` + `setComposition.ts`
2. ~~Modes: first-mix 6+4; due-review; remediation 6+4.~~ **DONE** — compose + `modeSelection` + `sessionService` (seed pool until Notion)
3. ~~Valid attempt flags~~ **PARTIAL** — practice UI records first pre-reveal as `is_valid`; post-reveal edits blocked (no separate edit path yet)
4. ~~Per-skill rolling 20 accuracy; trigger &lt;80% only at n≥20.~~ **DONE (pure)** — `weakness.ts`
5. ~~Remediation loop + DEC-20261102-17~~ **DONE** — `skillStateTransitions` / `skillStateService`; hub **Follow-up** tab + notify-once on intervention open
6. Preserve SM-2 updates on valid attempts only (confirm with CLAR-04). Deferred until Notion/Q bank + SM-2 bridge.
7. ~~Unit tests for core cases in §16 of Master Prompt.~~ **PARTIAL** — 35 vitest cases (incl. skill-state transitions)

### Acceptance

- Tests pass for: untaught blocked; 15/20 vs 16/20; 5/6 vs 4/6; two-fail notify once; reveal edit non-valid.
- Gap report when pool insufficient.

---

## Phase 3 — Proofreading integration

**Depends on:** Phase 1 skill IDs; CLAR-10 ✅; CLAR-11 ✅ (DEC-20261102-19).

### Tasks

1. ~~Persist `detectionCorrect` / `correctionCorrect` at save time~~ **DONE** — `scoreProofreadingItem` written onto `user_answers`; analytics uses stored flags; older rows still re-derived.
2. Attach primary micro-skill on answers / Notion Feature mapping. **Waiting on Notion.**
3. ~~Analytics: find vs correct; no SRS chart mix-in.~~ **DONE** for the split and the chart filter. Reason-code charts stay on the existing proofreading analytics.
4. Keep one-error-per-sentence authoring constraint. **Unchanged.**

### Acceptance

- Find-fail never grants correction success.
- Denominators for “not eligible to score correction” explicit.
- Existing proofreading assignments still complete via `mark_assignment_complete`.

---

## Phase 4 — Entry, Assignment, Progress Page

**Depends on:** Phases 2–3 core APIs; CLAR-02 ✅; CLAR-12 ✅ (DEC-20261102-20 — new `learning_system` type only).

### Tasks

1. Nav item `learningSystem` after Paragraph Memorization and before Proofreading — order: Class Dashboard → Paragraph Memorization → Learning System → Proofreading → … → Spaced Repetition (`UnifiedNavigation`, `NavigationSettingsContext`, `PageType`, `App.tsx`). DEC-20261102-08.
2. Mobile More sheet parity.
3. ~~Assignment type + deep-link~~ **DONE** — `learning_system_assignments` + Assign modal + My Assignments deep-link (legacy SR gap unchanged).
4. Student post-set Progress Page (hide teacher FSM). **PARTIAL** — summary + missed-skill tips; charts later.
5. ~~Teacher views: remediation / intervention flags.~~ **DONE** — Follow-up tab.

### Acceptance

- Assign → student opens correct set → complete → unified list updates.
- Student cannot see teacher-only remediation fields.
- Existing modules smoke-checked for nav regressions.

---

## Phase 5 — User Analytic & charts

**Depends on:** Valid SRS attempts + set completion events.

### Tasks

1. Student Progress + admin UserAnalytics sections for Learning System (SRS vs Proofreading separated).
2. Per-skill line (25-batch), two-set stacked bars, pie drill-down per §12.
3. Accessibility: text + legend, not color alone.

### Acceptance

- Chart cases: 24 no point / 25 point / 50 second point; same-day multi-points; 10/20 → bar 50%; pie sums 100%.
- Proofreading excluded from those three charts.

---

## Phase 6 — Integration verification & handoff

### Tasks

1. End-to-end with isolated test fixtures (no pollution of production student rows).
2. Permission matrix (student / class_staff / admin).
3. Historical attempt compatibility (legacy SRS attempts unmarked → excluded from Learning System validity windows or backfilled per decision).
4. Update checklist with evidence; freeze OPEN items or mark deferred.

### Acceptance

- All §16 cases either PASS or DEFERRED with owner.
- Docs current for next conversation.

---

## Recommended first executable slice (minimal complete)

After user answers **CLAR-01, CLAR-02, CLAR-03, CLAR-04, CLAR-08, CLAR-09** (at minimum):

**Phase 1 sample skills + schema + empty grade checklist UI**, then a **thin Phase 2 path**: 10-item eligible set with taught filter only (no remediation yet) on isolated test data.

That yields a verifiable vertical slice without inventing OPEN pedagogy rules.

---

## Progress log

| Date | Phase | Notes |
|------|-------|-------|
| 2026-11-02 | 0 | Inspection complete; docs created; Grok unavailable in-repo; Excel + Longman extract readable |
| 2026-11-02 | 0 | CLAR-01 resolved: DEC-20261102-07 — no Grok requirement; Flowith optional for bulk |
| 2026-11-02 | 0 | Nav order corrected: DEC-20261102-08 — after Paragraph Memorization, before Proofreading |
| 2026-11-02 | 0 | CLAR-02 resolved: DEC-20261102-09 — LS hub + standalone SRS + Proofreading coexist |
| 2026-11-02 | 0 | CLAR-03 resolved: DEC-20261102-10 — LS sets fixed at 10; legacy SRS unchanged |
| 2026-11-02 | 0 | CLAR-04 resolved: DEC-20261102-11 — LS dedicated attempt store with is_valid |
| 2026-11-02 | 0 | CLAR-08 resolved: DEC-20261102-12 — grade from class name parser |
| 2026-11-02 | 0 | CLAR-09 resolved: DEC-20261102-13 — new Notion DBs with Micro-skill ID |
| 2026-11-02 | 0 | DEC-20261102-14 — separate LS SRS + Proofreading Notion DBs |
| 2026-11-02 | 0 | CLAR-05 resolved: DEC-20261102-15 — teacher pin else lowest accuracy |
| 2026-11-02 | 0 | CLAR-06 resolved: DEC-20261102-16 — 20 ordinary attempts before re-arm |
| 2026-11-02 | 0 | CLAR-07 resolved: DEC-20261102-17 — pause + analytics highlight + Teacher followed up |
| 2026-11-02 | 0 | CLAR-10 resolved: DEC-20261102-18 — PR exact match only |
| 2026-11-02 | 0 | CLAR-11 resolved: DEC-20261102-19 — tips on Progress page only |
| 2026-11-02 | 0 | CLAR-12 resolved: DEC-20261102-20 — new LS assignment type; legacy SRS completion unchanged |
| 2026-11-02 | — | Learning System **ON HOLD**; standalone SRS assignment-completion may proceed separately |
| 2026-11-02 | — | SRS item-1 done (Ongoing + no due + deep-link); LS **RESUMED** → Phase 1 samples |
| 2026-11-02 | 1 | DEC-20261102-23 granularity: modal can; third-person singular marking≠spelling; -s/-es/-ies one skill |
| 2026-11-02 | 1 | DEC-20261102-24: can/can't one skill; irregular simple past bucket OK; 11 sample skills |
| 2026-11-03 | 1 | DEC-20261102-25: freeze + schema migration + seed; checklist empty taught flags |
| 2026-11-03 | 1–4 | Notion on hold: nav+hub, taught checklist UI, attempts/remediation schema, Notion id slots |
| 2026-11-03 | 2 | Pure eligibility/setComposition/weakness/remediation/charts + 23 unit tests; exports in `learningSystem/index.ts` |
| 2026-11-03 | 2 | Session builder + seed question pool + Practice tab; attempts persist; 28 unit tests |
| 2026-11-03 | 2 | Post-set skill_state + intervention; Teacher followed up panel; 35 unit tests |
| 2026-11-03 | 4 | `learning_system` assignments migration + assign/deep-link/complete + post-set tips |
| 2026-11-05 | — | DEC-20261105-01: school 2026–27 P.1–P.6 English schedules are the curriculum to follow. Excel stays an external HK guide. No skill generation. |
| 2026-11-05 | 5 | Student nav default on; SRS charts on My Progress and teacher analytics; teacher flags hidden from students |
| 2026-11-05 | 2 | Teacher remediation pin on staff charts; one pin per student, else lowest accuracy |
| 2026-11-05 | 3 | Proofreading save stores find vs correction; find-fail cannot score as a correct correction |
| 2026-11-10 | 1 | School P.1–P.6 list stored: 134 draft skills, 107 Excel links. Frozen 11 seeds unchanged. Checklist not auto-ticked. |
| 2026-11-10 | 6 | Permission matrix recorded. Staff-only remediation pin and skill-state delete. Legacy SRS attempts stay out of LS charts. Assignment path checked in code. |
