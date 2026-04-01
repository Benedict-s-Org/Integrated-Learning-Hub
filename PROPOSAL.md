# Implementation Plan (Updated) - Exercise Number/Name Support

This plan adapts the Exercise Number feature to fetch the value directly from the Notion database (as a column) and treat it as an identifying name/number for the practice.

## User Review Required

> [!NOTE]
> - **Data Source**: The "Exercise Number" is now exclusively fetched from Notion. You should populate this column in Notion before importing.
> - **Type Support**: The Exercise Number will be handled as a string (Text) to support names like "Ex 1.1" or "Verb Tense A".
> - **Default Title**: When saving, the practice title will automatically default to the Exercise Number/Name found in the Notion data.

## Proposed Changes

### Database & Types

#### [NEW] [20260331141000_add_exercise_number_to_proofreading.sql](file:///Users/mba/Library/CloudStorage/OneDrive-個人/Vibe coding/Antigravity/Supabase_Learning_Hub/supabase/migrations/20260331141000_add_exercise_number_to_proofreading.sql)
- Add `exercise_number TEXT` column to `public.proofreading_practices`.

#### [MODIFY] [types/index.ts](file:///Users/mba/Library/CloudStorage/OneDrive-個人/Vibe coding/Antigravity/Supabase_Learning_Hub/src/types/index.ts)
- Update `ProofreadingPractice` and `AssignedProofreadingPracticeContent` to include `exercise_number?: string`.

### Logic & Importers

#### [MODIFY] [importParsers.ts](file:///Users/mba/Library/CloudStorage/OneDrive-個人/Vibe coding/Antigravity/Supabase_Learning_Hub/src/utils/importParsers.ts)
- Update `ProofreadingImportData` to include `exerciseNumber?: string`.
- Update `parseProofreadingNotionResponse` to extract the `Exercise Number` column from Notion. It will look for "Exercise Number", "Ex No", or "No".

#### [MODIFY] [ProofreadingInput.tsx](file:///Users/mba/Library/CloudStorage/OneDrive-個人/Vibe coding/Antigravity/Supabase_Learning_Hub/src/components/ProofreadingInput/ProofreadingInput.tsx)
- In `handleFetchFromNotion`, after parsing:
  - Extract the unique Exercise Number(s) from the `filteredData`.
  - Pass the most common Exercise Number found to the next step (`onNext`).
- Update the documentation UI to list "Exercise Number" as a supported column.

### User Interface & Persistence

#### [MODIFY] [ProofreadingPreview.tsx](file:///Users/mba/Library/CloudStorage/OneDrive-個人/Vibe coding/Antigravity/Supabase_Learning_Hub/src/components/ProofreadingPreview/ProofreadingPreview.tsx)
- Update the component to receive `exerciseNumber` via props.
- Initialize `practiceTitle` with the passed `exerciseNumber` value by default.
- Ensure the `exerciseNumber` is passed to `addProofreadingPractice`.

#### [MODIFY] [AppContext.tsx](file:///Users/mba/Library/CloudStorage/OneDrive-個人/Vibe coding/Antigravity/Supabase_Learning_Hub/src/context/AppContext.tsx)
- Update `addProofreadingPractice` to accept and send `exerciseNumber` (string) to the Edge Function.

#### [MODIFY] [supabase/functions/proofreading-practices/index.ts](file:///Users/mba/Library/CloudStorage/OneDrive-個人/Vibe coding/Antigravity/Supabase_Learning_Hub/supabase/functions/proofreading-practices/index.ts)
- Update the `/create` action to save the `exercise_number` string into the database.

## Verification Plan

### Automated Tests
- Mock a Notion response return containing an "Exercise Number" column with various values ("5", "Unit 1", etc.).
- Verify that `parseProofreadingNotionResponse` correctly extracts these values.

### Manual Verification
- **Import**: 
  1. Add an "Exercise Number" column to your Notion database and fill it with "Test Ex 123".
  2. Import the data in the app.
  3. Verify that on the Preview page, the default Practice Title is "Test Ex 123".
- **Save**:
  1. Save the practice.
  2. Go to the "Saved Practices" list and verify that "Test Ex 123" is correctly displayed.
