# Learning System — Requirements Checklist

Legend: `N/S` not started · `PARTIAL` exists but gaps · `DONE` verified · `BLOCKED` waiting clarification · `N/A` out of round

| Req ID | Requirement | Existing anchor | Status | Evidence / notes |
|--------|-------------|-----------------|--------|------------------|
| R-NAV-01 | Learning System nav after Paragraph Memorization, before Proofreading | `UnifiedNavigation`, `MobileMoreSheet`, `NavigationSettingsContext` | DONE | Default visible; migration `20261105010000_*` turns the saved setting on |
| R-CHK-01 | Grade shared taught checklist | `grade_taught_checklists` + `GradeTaughtChecklistPanel` | PARTIAL | UI + seed skills; Notion sync later |
| R-ASG-01 | Use existing Assignment System | `learning_system_assignments` + unified RPC | DONE | DEC-20261102-20; legacy SR still incomplete |
| R-ASG-02 | LS Assign → enter → complete → report | Assign modal + deep-link + mark complete | DONE | Apply migration `20261103020000_*` |
| R-ANA-01 | My Progress / User Analytic integration | `LearningSystemProgressPanel` | PARTIAL | SRS charts on student Progress and admin User Analytics |
| R-ANA-02 | SRS vs Proofreading separate | Chart query filters `channel = srs` | DONE | Proofreading attempts are not drawn on these charts |
| R-ANA-03 | Teacher vs student separation | `showTeacherFields` | DONE | Students see scores and charts only; staff see weakness, loop, pause, follow-up |
| R-NOT-01 | Notion as question source + Micro-skill ID | Two new LS DBs (SRS + PR); extend `importParsers` | PARTIAL | DEC-20261102-13/14; user creates DBs |
| R-CUR-01 | Excel is an external HK guide | External xlsx verified | DONE (ref) | 24 stages; 143 rows; P1–P4=95. Does not place school grades. |
| R-CUR-02 | School curriculum is the major reference | `SCHOOL_CURRICULUM_REFERENCE.md` | DONE (ref) | DEC-20261105-01. P.1–P.6 grammar the system must follow. JSON is the same map. Taught tick tracks progress only. |
| R-SKL-01 | Micro-skill taxonomy + stable IDs | `grammar_micro_skills` + seed | PARTIAL | DEC-20261102-25; 11 seed skills |
| R-SKL-02 | Sample skills before mass gen | `phase1_sample_micro_skills.*` | DONE | Frozen DEC-20261102-25 |
| R-CHK-02 | All channels respect taught | `eligibility.filterByTaughtSkills` | PARTIAL | Pure filter DONE; wire session builder next |
| R-SRS-01 | Set size 10 (LS hub only) | `LS_SET_SIZE` in `setComposition.ts` | DONE | DEC-20261102-10; hub compose only |
| R-SRS-02 | First mix 6+4 | `composeFirstMixSet` | DONE | Unit-tested; UI wire next |
| R-SRS-03 | Due review among eligible | `composeOrdinaryReviewSet` | PARTIAL | Taught+due filter DONE; SM-2 due flags when Q bank live |
| R-SRS-04 | Remediation 6 same + 4 due | `composeRemediationSet` | DONE | Unit-tested; UI wire next |
| R-SRS-05 | Keep SM-2 | `spacedRepetitionAlgorithm.ts` | DONE (keep) | Do not replace |
| R-VAL-01 | Valid attempt = first pre-reveal (LS only) | `LearningSystemPractice` + `attemptService` | PARTIAL | First Check answer is valid; post-reveal re-answer blocked in UI |
| R-VAL-02 | Persist skill/set/validity in LS store | `sessionService` / `attemptService` | PARTIAL | Inserts to `learning_system_sets` + `attempts`; skill_state updates later |
| R-WEAK-01 | Last 20 per skill; &lt;80%; n≥20 | `weakness.ts` | DONE | Unit-tested |
| R-WEAK-02 | Remediation loops 5/6; 2 fails → teacher follow-up UX | `skillStateService` + Follow-up tab | DONE | Notify once; Teacher followed up unlocks; staff pin on Student charts / User Analytics |
| R-CHT-01 | Per-skill line every 25 | `charts.buildSkillLinePoints` | DONE | Pure helpers + tests; analytics UI later |
| R-CHT-02 | Two-set stacked bars | `charts.buildTwoSetBars` | DONE | |
| R-CHT-03 | Bar → pie 20 items | `charts.buildTwentyItemPie` | DONE | |
| R-PRF-01 | Reuse proofreading exercise | `ProofreadingPractice` et al. | PARTIAL | |
| R-PRF-02 | Find vs correct persisted; exact correction match | `proofreadingScore` saved on `user_answers` | DONE | Find-fail stores correctionCorrect false; older rows still re-derived |
| R-PRF-03 | Not mix into SRS charts | Currently separate | DONE (keep) | Enforce when adding charts |
| R-PRF-04 | No SRS weakness gate on PR | N/A gates today | DONE (keep) | |
| R-LEG-01 | No 150 / Tier / 80-20 scoring | Not found in product code | DONE (absent) | Report if found later |
| R-TST-01 | Core cases §16 | `src/test/learningSystem/*` | PARTIAL | 35 tests pass; PR/assignment/UI cases remaining |
| R-STU-01 | Student set progress page + tips after set | Practice summary tips | PARTIAL | Missed-skill tips after set (DEC-19); charts later |

## Core verification cases (§16)

| Case | Status |
|------|--------|
| Untaught skill never served even if due | DONE (unit) |
| Grade checklist consistent for same grade | PARTIAL (UI + shared DB rows) |
| First set 6 current + 4 prior | DONE (unit) |
| Remediation six same skill | DONE (unit) |
| n&lt;20 no weakness | DONE (unit) |
| 15/20 triggers; 16/20 does not | DONE (unit) |
| Remediation 5/6 pass; 4/6 fail | DONE (unit) |
| Two fails → one teacher notify | DONE (unit + intervention notify_sent_at once) |
| Post-reveal edit not valid count | N/S (practice UI) |
| Line chart 24/25/50 batch rules | DONE (unit) |
| Same-day multi points | DONE (unit) |
| Bar height 10/20 = 50% | DONE (unit) |
| Pie same 20 sums 100% | DONE (unit) |
| PR find-fail ≠ correction success | DONE (unit + saved flags) |
| PR not in SRS charts | DONE (charts module SRS-only) |
| Assignment flow | N/S |
| Student hides teacher fields | PARTIAL (charts omit skill-state flags; follow-up tab is staff-only) |
| No regression other modules | N/S |

## File index (Phase 0)

### SRS
- `src/components/SpacedRepetition/SpacedRepetitionPage.tsx`
- `src/context/SpacedRepetitionContext.tsx`
- `src/utils/spacedRepetitionAlgorithm.ts`
- `src/components/SpacedRepetition/NotionImporter.tsx`
- `src/components/SpacedRepetition/SetAssignmentModal.tsx`
- `src/components/SpacedRepetition/SpacedRepetitionAnalytics.tsx`

### Proofreading
- `src/components/ProofreadingPractice/ProofreadingPractice.tsx`
- `src/components/ProofreadingInput/ProofreadingInput.tsx`
- `src/utils/importParsers.ts` (`parseProofreadingNotionResponse`)
- `src/utils/proofreadingAnalytics.ts`
- `supabase/functions/proofreading-practices`, `proofreading-assignments`

### Nav / App / Assignments / Analytics
- `src/components/UnifiedNavigation/UnifiedNavigation.tsx`
- `src/context/NavigationSettingsContext.tsx`
- `src/App.tsx`
- `src/components/UnifiedAssignments/UnifiedAssignments.tsx`
- `src/components/StudentProgress/StudentProgress.tsx`
- `src/components/UserAnalytics/UserAnalytics.tsx`

### AI
- `supabase/functions/flowith-proxy`, `ai-proofread`
- `src/utils/flowithApi.ts`
- No Grok/xAI
