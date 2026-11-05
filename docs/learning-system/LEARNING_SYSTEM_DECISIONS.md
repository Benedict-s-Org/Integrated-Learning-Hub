# Learning System — Decisions Log

> Format: `DEC-YYYYMMDD-NN` | Status: OPEN / CONFIRMED / SUPERSEDED  
> Unresolved items that affect scoring, item selection, permissions, data meaning, or pedagogy **must not** be silently decided in code.

---

## Status note

**Learning System implementation: RESUMED 2026-11-02** after SRS Unified Assignments item-1 fix. Clarifications DEC-20261102-07…25 remain in force.

**Notion content on hold (2026-11-03):** Formal Notion micro-skills + LS question banks deferred. Hub continues with Supabase seed skills, taught checklist UI, Learning System nav/hub shell, and attempts/remediation schema.

**Standalone SRS + Unified Assignments (2026-11-02):** User wants **one Assignments list** for all types (keep Unified Assignments). SRS stays on that list, but practice is **ongoing rounds** (default 20 / custom size) with **no completion status**. Do not force `mark_assignment_complete` / done-tick UX onto SRS. See DEC-20261102-21.

## Confirmed from Phase 0 inspection (no user re-ask needed)

| ID | Decision | Evidence |
|----|----------|----------|
| DEC-20261102-01 | Reuse modified SM-2 in `src/utils/spacedRepetitionAlgorithm.ts`; do not replace algorithm. Add eligibility filters (taught checklist + micro-skill) around selection. | Existing SRS; Master Spec §8 |
| DEC-20261102-02 | Notion remains import → Supabase; not live continuous sync. Learning System must not invent a disconnected formal bank. | `NotionImporter`, `notion-api`, `importParsers` |
| DEC-20261102-03 | Excel = external HK guide only; 143 rows ≠ micro-skills; M1–M16 ≠ skill IDs. School curriculum to follow is DEC-20261105-01. | Excel `01 Guide` |
| DEC-20261102-04 | No active 150-point / Tier A–D / 80–20 mixed scoring implementation found; do not add. | Repo scan Phase 0 |
| DEC-20261102-05 | ~~Nav between Class Dashboard and Paragraph Memorization~~ **SUPERSEDED by DEC-20261102-08.** | — |
| DEC-20261102-06 | Spelling SRS (`SpellingSrsContext`) is out of Learning System grammar scope. | Separate tables/context |

---

## OPEN — needs user clarification

### CLAR-01 — Grok 4.7 access (blocks Phase 1 authoring)

**Issue:** Repo has Flowith (`gpt-4o*`, Claude), DeepSeek (`ai-proofread`), Gemini, local Qwen. **No xAI/Grok.**

**Options (pick one):**
- A) Provide xAI/Grok API key + model id for Edge Function use  
- B) Authorize Cursor-side Grok 4.7 for offline skill drafting only (import artifacts)  
- C) Temporarily authorize another named model for drafting, with explicit decision logged  

**Status: CONFIRMED 2026-11-02 → see DEC-20261102-07**

---

### CLAR-02 — Relationship: Learning System vs existing SRS / Proofreading nav items

**Issue:** Where Learning System sits in Learning nav, and whether old SRS/Proofreading entries stay.

**Nav order: CONFIRMED 2026-11-02 → DEC-20261102-08**  
`Class Dashboard` → `Paragraph Memorization` → `Learning System` → `Proofreading` → … → `Spaced Repetition`

**Product role: CONFIRMED 2026-11-02 → DEC-20261102-09**  
Learning System = combined SRS + Proofreading **hub**. Standalone SRS and Proofreading nav items **remain**. All three coexist.

---

### CLAR-03 — “Set” size conflict (10 vs current default 20)

**Issue:** Spec mandates **10 questions/set**. Current SRS session default is **20** (5/10/15/20/custom).

**Options:**
- A) Learning System grammar channel hard-fixes 10; legacy SRS hub unchanged  
- B) Change global SRS default to 10 for all sets  
- C) Learning System uses a new session type / table distinct from freeform SRS sessions  

**Status: CONFIRMED 2026-11-02 → DEC-20261102-10 (option A)**

---

### CLAR-04 — Valid attempt vs current “wrong → re-queue + recordAttempt”

**Issue:** Today every wrong answer in a session re-queues the card and calls `recordAttempt` again (inflates attempts / quality). Spec: only first pre-reveal submit counts as valid; post-reveal edits separate.

**Options:**
- A) Learning System mode: one valid attempt per question per set; re-queue optional for practice but flagged `is_valid=false`  
- B) Change global SRS attempt semantics (breaking analytics history)  
- C) Keep legacy SRS; Learning System writes to new attempt columns/tables with validity  

**Status: CONFIRMED 2026-11-02 → DEC-20261102-11 (option C)**

---

### CLAR-05 — Multi-skill remediation priority

**Issue:** Spec: if multiple skills &lt;80% with n≥20, priority undefined.

**Options:**
- A) Lowest accuracy first  
- B) Most recently failed skill first  
- C) Teacher pin/lock target; else A  
- D) Other  

**Status: CONFIRMED 2026-11-02 → DEC-20261102-15 (option C)**

---

### CLAR-06 — Post-remediation cooldown / re-trigger

**Issue:** After 5/6 pass, stale last-20 may still be &lt;80%. Spec forbids inventing cooldown.

**Options (for user pick):**
- A) After remediation pass: clear Potential Weakness for that skill until **20 new ordinary** (non-remediation) valid attempts accumulate, then re-evaluate  
- B) After pass: freeze auto-remediation for that skill until teacher clears / re-enables  
- C) After pass: exclude the remediation 6-packs from the rolling 20; continue using prior ordinary attempts + new ordinary only  
- D) Other  

**Status: CONFIRMED 2026-11-02 → DEC-20261102-16 (option A)**

---

### CLAR-07 — Teacher intervention after 2 failed loops

**Issue:** Notify teacher confirmed; whether dense remediation stops / how restart works — undefined.

**Options (for user pick):**
- A) After 2 failed loops: stop auto dense remediation; one teacher notification; resume only when teacher dismisses or explicitly restarts  
- B) Keep notifying on a schedule until teacher acts (still no spam within same day)  
- C) Auto pause + notify; student falls back to ordinary review sets until teacher restarts remediation  
- D) Other  

**Status: CONFIRMED 2026-11-02 → DEC-20261102-17 (option C + UI)**

---

### CLAR-08 — Grade identity for checklist

**Issue:** Users have `class` (e.g. `3A`), not a dedicated `grade` field. Checklist is “per grade”.

**Options:**
- A) Derive grade from class name (`3A`→P3) via shared parser  
- B) Add explicit `grade` / `year_level` on users or classes  
- C) Checklist keyed by class string year digit only  

**Status: CONFIRMED 2026-11-02 → DEC-20261102-12 (option A)**

---

### CLAR-09 — Notion schema for micro-skill ID

**Issue:** SRS import has no skill property; tags unused in selection. Proofreading has Feature/Grammar → tip, no stable ID.

**Options:**
- A) New Notion property (e.g. `Micro-skill ID`) written on import  
- B) Hub-only mapping table `notion_page_id` → skill_id  
- C) A+B hybrid for legacy pages  

**Status: CONFIRMED 2026-11-02 → DEC-20261102-13 (option A)**  
User will **create new Notion database(s)** already containing required properties (not patching old DBs via Hub mapping).

---

### CLAR-10 — Proofreading equivalent answers

**Issue:** Spec requires handling reasonable equivalents; evidence threshold undefined.

**Options (for user pick):**
- A) Exact match only (case-insensitive trim), same as today  
- B) Exact + teacher-maintained allowlist per item  
- C) Exact + AI judge for near-equivalents (model TBD)  
- D) Other  

**Status: CONFIRMED 2026-11-02 → DEC-20261102-18 (option A)**

---

### CLAR-11 — Hints / tips and valid stats

**Issue:** Proofreading has tip visibility by level; SRS has Help/Elaborate. Spec: if tips affect independent-attempt stats and undefined → ask.

**Options (for user pick):**
- A) Tips/Help before answer → still count as valid (record `tip_used` / help flag for analysis only)  
- B) Tips/Help before answer → `is_valid=false` for weakness/charts (still store attempt)  
- C) LS hub hides tips during scored sets; tips only on review/explain screens  
- D) Other  

**Status: CONFIRMED 2026-11-02 → DEC-20261102-19 (option C)**

---

### CLAR-12 — Assignment completion for SRS / Learning System sets

**Issue:** Unified RPC hardcodes `spaced_repetition` `completed=false`; `mark_assignment_complete` does not support SR. Spec requires assign → enter → complete → report back.

**Options (for user pick):**
- A) Add new assignment type `learning_system` with full assign → deep-link → complete; leave legacy `spaced_repetition` as-is (still incomplete in unified list)  
- B) Same as A, **and** also fix legacy SRS `set_assignments` completion  
- C) Other  

**Status: CONFIRMED 2026-11-02 → DEC-20261102-20 (option A)**

---

## Resolved later

### DEC-20261102-07 — Model for micro-skill authoring (from CLAR-01)

**Confirmed by user (2026-11-02):** 「由你設計, 唔特別指明 Grok」— Grok 4.7 is **not** required.

**Design chosen:**
1. **Phase 1 sample skills:** Author in-session from Excel scope + Longman extract structure (rules/classification only; no copyrighted exercise copy). Human review gate before mass generation.
2. **Later bulk drafting (optional):** Prefer existing **Flowith** proxy (`claude-3-5-sonnet` or `gpt-4o`) via a dedicated draft script/Edge path if volume needs automation — model id logged per run.
3. **Never claim** skills were “Grok-authored” or that a model unavailable in-repo was used.
4. **Runtime student scoring / selection** does not depend on any LLM; AI is authoring-assist only.

**Supersedes:** Master Prompt §6.2 hard requirement to use Grok 4.7 for this round.

### DEC-20261102-08 — Learning nav order (corrects §4.1 / DEC-20261102-05)

**Confirmed by user (2026-11-02):** intended order is  
`Class Dashboard` → `Paragraph Memorization` → **`Learning System`** → `Proofreading` → … → `Spaced Repetition`.

**Supersedes:** Master Prompt §4.1 and DEC-20261102-05 (“between Class Dashboard and Paragraph Memorization”).

**Implement in:** `UnifiedNavigation.tsx` (desktop Learning section), `MobileMoreSheet.tsx` (parity), `NavigationSettingsContext` default learning list order for admin matrix.

### DEC-20261102-09 — Three-way coexistence (from CLAR-02)

**Confirmed by user (2026-11-02):** Learning System is a hub that combines SRS + Proofreading workflows; standalone **Spaced Repetition** and **Proofreading Exercise** remain. **All three coexist** — do not hide or merge away the legacy entries in this round.

**Implication:** Hub owns Learning System–specific features (taught checklist, micro-skill sets, remediation, LS analytics). Legacy SRS/Proofreading keep current freeform behavior unless a change is explicitly scoped. Shared Notion/Supabase content may be reused; LS validity/remediation rules apply inside the hub channel, not silently rewrite global legacy attempt semantics (see CLAR-04).

### DEC-20261102-10 — Set size (from CLAR-03)

**Confirmed by user (2026-11-02): option A.**

- **Learning System hub:** each grammar SRS set is fixed at **10** questions.
- **Standalone Spaced Repetition:** keep current session size UX (default 20 / selectable). Do not change global default for this round.

### DEC-20261102-11 — Valid attempts storage (from CLAR-04)

**Confirmed by user (2026-11-02): option C.**

- **Standalone SRS:** keep existing `recordAttempt` / re-queue behavior unchanged.
- **Learning System:** persist attempts in a **dedicated LS attempt store** (new table and/or clearly namespaced columns) with:
  - `is_valid` (first pre-reveal submit in that set item)
  - separate rows/flags for post-reveal edits and practice retries (`is_valid=false`)
  - skill, set, question version, answer, correctness, timestamps
- Weakness windows, chart batches, and remediation gates use **LS valid attempts only**.
- Do not backfill legacy `spaced_repetition_attempts` into LS validity windows unless a later decision says so.

### DEC-20261102-12 — Grade key for taught checklist (from CLAR-08)

**Confirmed by user (2026-11-02): option A.**

- Derive grade from `users.class` via a shared parser (e.g. `3A` / `P.3` / `P3` → grade key `P3`).
- Taught checklist is keyed by that **grade key**, shared by all students of that grade (not per class section like 3A vs 3B).
- Reuse or align with existing helpers such as essay-marking `parseGradeFromClassName` where possible; document supported class-name patterns.
- If parse fails → block LS assignment eligibility and surface a clear admin error (do not guess).

### DEC-20261102-13 — Notion micro-skill binding (from CLAR-09)

**Confirmed by user (2026-11-02): option A**, with new databases.

- User creates **new** Notion database(s) that already include Learning System properties (no Hub-side `notion_page_id`→skill mapping table as the primary path).
- Import parsers must read `Micro-skill ID` (and related fields) into Supabase on import.
- Questions missing `Micro-skill ID` are **ineligible** for LS set building (report gap); do not invent a skill.
- Legacy SRS/Proofreading Notion DBs may remain for standalone modules; LS hub points at the new DB id(s) via Notion config.

**Proposed property set for new DBs** (confirm/adjust before user builds DB — see next message if needed):

| Property | Type | Used by |
|----------|------|---------|
| Question / Original | title/rich text | SRS stem / PR sentence |
| Choice A–D | rich text | SRS only |
| Correct Answer | rich text/select | SRS |
| Error | rich text | Proofreading wrong word |
| Corrected | rich text | Proofreading correction |
| Micro-skill ID | rich text or select | **Required for LS** — stable Hub skill id |
| Grade Tags | multi-select (P1–P4) | optional filter aid |
| Explanation / Tip | rich text | optional |
| Channel | — | **N/A** — DEC-20261102-14 uses two separate DBs |

### DEC-20261102-14 — Separate Notion DBs for LS SRS vs Proofreading

**Confirmed by user (2026-11-02): option A.**

- **Two databases:** (1) Learning System SRS MCQ DB, (2) Learning System Proofreading DB.
- Each includes **Micro-skill ID** and channel-appropriate stem/answer fields.
- Configure separate Notion DB IDs in Hub (extend `NotionDatabaseConfig` / LS settings); do not require a `Channel` property.
- Standalone legacy SRS/Proofreading DBs remain for non-LS modules.

### DEC-20261102-15 — Remediation skill priority (from CLAR-05)

**Confirmed by user (2026-11-02): option C.**

1. If teacher has **pinned / locked** a remediation target skill for that student (or grade policy, if later added) → use that skill.
2. Else among skills with n≥20 valid LS attempts and accuracy &lt;80% → pick **lowest accuracy**.
3. Ties: break by most recently failed valid attempt, then stable skill id order.

### DEC-20261102-16 — Post-remediation re-trigger (from CLAR-06)

**Confirmed by user (2026-11-02): option A.**

- On remediation **pass** (≥5/6) for a skill: clear that skill’s active Potential Weakness / auto-remediation for the student.
- Start a **re-evidence counter**: only **ordinary** (non-remediation) valid LS attempts on that skill count.
- Auto weakness/remediation for that skill may re-arm only after **20 new ordinary** valid attempts, then apply the usual &lt;80% rule on the latest 20 valid ordinary attempts (or latest 20 valid overall — implement as: rolling window of 20 valid attempts **excluding remediation-loop items** for re-evaluation after cooldown; document in code comments).
- Implementation detail to lock in Phase 2: re-evaluation window = last 20 **ordinary** valid attempts once cooldown counter ≥20.

### DEC-20261102-17 — After two failed remediation loops (from CLAR-07)

**Confirmed by user (2026-11-02): option C**, with analytics/progress UX:

1. After **two failed** remediation loops on a skill: stop dense auto-remediation for that skill; student continues with **ordinary** Learning System review sets only.
2. Surface / highlight this outcome in:
   - **User Analytics** (admin)
   - **User Progress / My Progress** teacher-facing views (and student Progress must **not** show teacher intervention FSM — keep student page clean per Master Spec §11)
3. Add a teacher control: **「教師已跟進」 / "Teacher followed up"** button on the (teacher) User Progress surface for that student/skill event.
4. Pressing **Teacher followed up** records follow-up (who/when) and is the gate to **restart** remediation eligibility for that skill (exact restart = clear intervention flag so auto rules can run again, subject to DEC-20261102-15/16).
5. Notify once per intervention episode (no duplicate spam for the same open intervention).

### DEC-20261102-18 — Proofreading answer matching (from CLAR-10)

**Confirmed by user (2026-11-02): option A.**

- Correction success = case-insensitive trimmed exact match to the stored correct form (current practice behavior).
- Do not treat spelling variants / synonyms as correct unless they exactly match the key.
- Spec note on “reasonable equivalents”: deferred; no AI judge or allowlist in this round. If needed later → new decision.

### DEC-20261102-21 — SRS on Unified Assignments without completion

**Confirmed by user (2026-11-02):**

- Keep **Unified Assignments** as the single student list for all assignment types.
- SRS assignments **must appear** on that list.
- SRS has **no completion status**: students do rounds of 20 (or custom N) cards; tutorial-period ongoing practice.
- Do **not** add homework-style `completed` / tick for standalone SRS in this design.
- Due date: **DEC-20261102-22 — option B**: SRS assignments **do not use due date**.
- Fix direction:
  1. Unified list shows SRS as **Ongoing / Practice** (never “Incomplete homework”).
  2. No due date / no overdue styling for SRS.
  3. Click opens that **set** (deep-link `set_id`), not empty hub.
  4. Optional later: show last practiced / cards due today as secondary text — not a completion gate.

### DEC-20261102-23 — Micro-skill granularity (Phase 1 samples)

**Confirmed by user (2026-11-02):**

1. **`can` is a modal-verb skill family**, not filed under present simple.
2. **Third-person singular marking** and **third-person singular spelling** are **separate** skills (different remediation).
3. Within spelling, **-s / -es / -ies** are **one** skill (same category), not three skills.
4. Prefer **full English linguistic terms** in specs/UI (e.g. `third-person singular`, `bare infinitive`, `modal can`); avoid unexplained abbreviations like `3sg`.

5. **modal can / can't + bare infinitive** = **one skill** (both test bare infinitive after the modal; polarity is a tag, not a separate skill). **DEC-20261102-24**
6. **Irregular past** may start as **one bucket skill** for Phase 1. **DEC-20261102-24**

### DEC-20261102-24 — can/can't one skill; irregular past bucket OK

**Confirmed by user (2026-11-02):**

1. Affirmative **can** and **can't/cannot** share one micro-skill: **modal can + bare infinitive** (measures bare infinitive after the modal). Use variation tag `polarity:affirmative|negative` on items; do not split remediation by polarity alone.
2. **Irregular past (common verbs)** may proceed as one temporary bucket skill until a verb list is refined later.

### DEC-20261102-25 — Phase 1 sample set frozen + schema

**Confirmed by user (2026-11-02):** freeze the 11 sample skills and build schema.

**Delivered:**
- Tables: `grammar_micro_skills`, `grammar_skill_curriculum_links`, `grade_taught_checklists`
- Migration: `supabase/migrations/20261103000100_learning_system_micro_skills_and_checklist.sql`
- Seed JSON: `docs/learning-system/data/phase1_sample_micro_skills.json`
- Client: `src/lib/learningSystem/*` (`parseLearningSystemGradeKey`, seed IDs, types)
- Checklist rows for P.1–P.4 × seed skills created with **`taught = false`** (no Excel auto-tick)

### DEC-20261102-22 — SRS assignments: no due date

**Confirmed by user (2026-11-02): option B.** SRS set assignment UI/RPC should not require or surface due dates; unified list must not treat SR as overdue homework.

**Implemented 2026-11-02 (item 1, Study Plan deferred):**
- Migration `20261102120000_srs_assignments_ongoing_no_due.sql` — clear SR due dates; unified RPC never overdue for SR
- `SetAssignmentModal` — due date removed; `assignSet` always `due_date: null`
- `UnifiedAssignments` — status **Ongoing**; no due/overdue UI for SR
- `App.tsx` + `SpacedRepetitionPage` — Assignments click deep-links to set prep (`focusSetId`)

**Nav note (item 2):** Students need **Assignments** visible via Navigation Management / `navigation_permissions` (default `visible: false` in `NavigationSettingsContext`). Enabling that page is sufficient for them to open the unified list.

### DEC-20261102-20 — Learning System assignments (from CLAR-12)

**Confirmed by user (2026-11-02): option A.**

- New assignment type for Learning System (e.g. `learning_system`) with assign → deep-link into hub set → mark complete on finish.
- Do **not** in this round fix legacy standalone SRS (`spaced_repetition` / `set_assignments`) completion gap in unified list.

### DEC-20261102-19 — Tips / Help vs scored attempts (from CLAR-11)

**Confirmed by user (2026-11-02): option C.**

- During **scored** Learning System SRS / Proofreading sets: **do not show** tips / Help / Elaborate that would coach the answer.
- Tips and explanations appear on the **student Progress / review page** after the set (and teacher explain surfaces as needed).
- Standalone legacy Proofreading tip-by-level behavior may remain outside the LS hub unless later scoped.

### DEC-20261105-01 — School schedules are the curriculum to follow

**Confirmed by user (2026-11-05, clarified the same day):** the enclosed S.T.F.A. Lee Kam Primary School English Language schemes (P.1–P.6, both terms, 2026–27) are the **actual school curriculum**. The Learning System must follow them.

- Indexed in `docs/learning-system/data/school-curriculum-2026-27/` (`SCHOOL_CURRICULUM_REFERENCE.md` + `grammar-pacing.json`).
- `HK_Primary_Grammar_24_Stage_Curriculum_EN.xlsx` is an **external** Hong Kong primary curriculum guide. It may be read for territory wording. It does not decide grade, order, or which structures this school teaches. DEC-20261102-03 is limited to that external role.
- They replace Primary Longman Express 3e as the school programme. Skill authoring and grade placement follow the school units.
- A schedule row is the school’s placement of that structure. It does **not** auto-tick `grade_taught_checklists`. The tick records progress through this curriculum. A tick cannot add a structure the school schedule leaves out of that grade. Untaught skills stay ineligible.
- Book numbers, reader titles, and A1–B6 codes are curriculum links, not micro-skill ids.
- NSE, VIA, and character-strength columns are school-scheme context. They are not grammar micro-skills.
- Do not copy reader text, worksheets, or dictation lists into the question bank.
- P5–P6 rows are stored for later. Completing P5–P6 banks stays out of this round. Deploy priority remains P3 / P4; P1–P2 remain the prior-grade review pool.
- Cover years are inconsistent on two files (P.2 term 2 and P.5 term 1 say 2025–26). Cycle dates are the 2026–27 calendar, and that calendar is what the index uses.
