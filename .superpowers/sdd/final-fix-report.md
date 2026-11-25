# Final fix report: bound-audio review

## Status

**Fixed.** Both important findings are in the working tree and committed on `cursor/school-curriculum-reference-fb22`. An unrelated merge is still in progress (five unmerged homework/analytics files). Those conflicts were not touched. The spelling commits were made around that merge so they do not include it.

## Finding 1 — SpellingPreview Play All lifetime

`src/components/SpellingPreview/SpellingPreview.tsx`

- `handlePlayAll` snapshots `playbackGenerationRef` after `stopInFlightPlayback` and leaves the loop when that generation changes. It calls `finishPlayback` only while it still owns the generation, so an older loop cannot clear a newer Play All.
- `playCloudAudio` constructs the `Audio` element, stores it on `currentAudioRef`, then awaits `playAudioUrl(url, audio)`. Stop can pause that element during playback. `playAudioUrl`'s optional existing element is unchanged for other callers.
- Stop pauses the element and dispatches `ended` so the in-flight `playAudioUrl` waiter can settle and the old loop can observe the generation bump.

Tests in `src/test/components/SpellingPreview.wordAudio.test.tsx`:

- A voice change plus a second Play All does not fetch or confirm with the first loop's voice after the first play resolves.
- Stop pauses the `HTMLAudioElement` passed into `playAudioUrl`.

## Finding 2 — Bound practice autoplay copy

`src/components/SpellingPractice/SpellingPractice.tsx`

- Bound `speakWord` treats `NotAllowedError` (and messages that indicate an autoplay / user-gesture block) as **Press Play Word to hear the audio.**
- Missing drive id, failed `resolveAudioUrl`, and other playback errors still use **Audio unavailable for this word**.

Tests in `src/test/components/SpellingPractice.boundAudio.test.tsx` cover the autoplay message and a real load failure.

## Tests

`npx vitest run src/test/components/SpellingPreview.wordAudio.test.tsx src/test/components/SpellingPractice.boundAudio.test.tsx`

- **17 passed** (2 files). Preview 6, practice 11.
- Not run in a browser (workspace forbids browser automation).

## Commits

- `28148ec8d6b926c431f8b88ff2a3f817c6383fb6` — `fix(spelling): drop superseded Play All confirms`
- `e7df46d387fec90cb015fa8af90fe83a6042927b` — `fix(spelling): soften bound autoplay block message`

---

# Final fix report: morning makeup + Activity Homework (whole-branch review)

## Status

**Fixed.** Critical duplicate `studentClass` binding removed; outstanding load merges English-tracker debt with `daily_homework` detail enrichment; diary owed/missingThatDay respects morning status; load failures surface English alerts (staff retry/skip, guest unavailable).

## Critical — ClassDashboardPage duplicate `studentClass`

`src/pages/ClassDashboardPage.tsx`

- Single binding: `student?.class || activeClass || ''` before listed-hand-in sync and `loadOutstandingHomeworkForStudent`.

## Important — Outstanding + makeup parity

`src/lib/homework/outstandingHomework.ts`

- `outstandingFromEnglishLogs`, `mergeOutstandingItems`, `enrichOutstandingDetails` (uses `detailFor` like Missing ledger).

`src/lib/homework/loadOutstandingHomework.ts`

- Class-level `missingLogsFromEnglishMarks` merged with duty rows; makeup query includes `english|…` log ids; `daily_homework` assignments fill `p_detail`.

`HomeworkMakeupModal` unchanged — already passes `item.detail`.

## Important — Load failure UX

- `MorningDutiesBoard`, `AdminUsersPage`, `ClassDashboardPage`: staff `confirm` retry-or-skip; guest `alert` that makeup check-in is unavailable (status still saved).

## Important — homeworkDiary

`src/lib/homework/homeworkDiary.ts`

- `collectOwedFromDutyLogs` and `missingThatDay` only when status is `missing`.
- Diary day set includes `handIns` hand-in `logDate` values.

## Tests

`npx vitest run src/test/homework/outstandingHomework.test.ts src/test/homework/homeworkDiary.test.ts`

- **13 passed** (2 files). Outstanding 10, diary 3.
- Added: submitted → empty `missingThatDay`; English outstanding + detail enrichment; hand-in diary days.

## Remaining concerns

- Guest paths still message-only for makeup writes (by design this wave).
- `loadOutstandingHomeworkForStudent` needs `class` (explicit or from duty log) for English parity; empty class skips classmate marks.
- Manual UI QA not run.

## Commits

- (see git log after commit) — `fix(homework): morning makeup review findings`
