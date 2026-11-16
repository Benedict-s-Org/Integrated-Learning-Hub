# Saved Content Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Edit button on the Saved page that reopens the create flow with prefilled content and overwrites the same saved article on save.

**Architecture:** Reuse `page: 'new'` steps with optional `editingContentId`. New edge path `memorization-content/update-content` (existing `/update` stays title-only). AppContext `updateSavedContent` updates DB + local list. Save paths branch: id present → update; else → create.

**Tech Stack:** React, AppContext, Supabase Edge Function `memorization-content`, Vitest + Testing Library

## Global Constraints

- UI copy in English only
- Overwrite same id; do not create a second saved item
- Updates do not consume save-limit slots
- Preserve `public_id` / `is_published` on update
- Keep Saved list pencil for title-only rename
- Do not auto-commit unless the user asks

---

### Task 1: Edge function `update-content`

**Files:**
- Modify: `supabase/functions/memorization-content/index.ts`
- Test: manual / unit not required for Deno edge; covered by AppContext mock later

**Interfaces:**
- Produces: `POST memorization-content/update-content` body `{ contentId, userId, title, originalText, selectedWordIndices, practiceMode? }` → `{ success: true, content: { id, title, originalText, selectedWordIndices, createdAt, isPublished, publicId, practiceMode } }`

- [ ] **Step 1: Add UpdateContentRequest + path handler before the final 404**

Add interface and handler that updates `title`, `original_text`, `selected_word_indices`, `practice_mode`, `updated_at` only. Scope by `user_id` unless admin. Do **not** touch `public_id` / `is_published`. Reuse `validateCreateRequest`-style checks for title/text/indices (contentId + userId required). Path must be `endsWith("/update-content")` and registered **before** the existing `/update` | `/update-title` branch so it is not swallowed (or keep `/update-content` check first in the if-chain).

- [ ] **Step 2: Deploy note** — after code lands, run `npx supabase functions deploy memorization-content` when user is ready (do not deploy unprompted)

---

### Task 2: AppContext `updateSavedContent`

**Files:**
- Modify: `src/types/index.ts` (`AppContextType`)
- Modify: `src/context/AppContext.tsx`
- Test: `src/test/context/AppContext.updateSavedContent.test.tsx` (or extend existing AppContext test with mocks)

**Interfaces:**
- Produces: `updateSavedContent(id: string, content: { title: string; originalText: string; selectedWordIndices: number[]; practiceMode?: SavedContent['practiceMode'] }): Promise<boolean>`
- Consumes: edge `memorization-content/update-content`

- [ ] **Step 1: Write failing test** that mocks `supabase.functions.invoke` and asserts invoke path `memorization-content/update-content` and local state title/text update

- [ ] **Step 2: Implement** `updateSavedContent` + export on context value; add to `AppContextType`

- [ ] **Step 3: Run test** — `npx vitest run src/test/context/AppContext.updateSavedContent.test.tsx` (or chosen file) — expect PASS

---

### Task 3: Thread `editingContentId` through App `new` flow

**Files:**
- Modify: `src/App.tsx` (AppState union + handlers + render props)
- Modify: `src/components/TextInput/TextInput.tsx` (optional `isEditing` heading)
- Modify: `src/components/SavedContent/SavedContent.tsx` (Edit button + `onEditContent`)

**Interfaces:**
- AppState `new` steps gain optional `editingContentId?: string`
- `SavedContentProps.onEditContent: (content: SavedContentType) => void`
- TextInput optional `isEditing?: boolean` → heading "Edit Saved Content"

- [ ] **Step 1: Extend AppState** every `page: 'new'` variant with `editingContentId?: string`

- [ ] **Step 2: `handleEditSavedContent`** sets `{ page: 'new', step: 'input', text, title, editingContentId }`

- [ ] **Step 3: Preserve `editingContentId`** in `handleTextSubmit`, `handleWordsSelected`, `handleStartGame`, `handleStartDictation`, `handleBackToInput`, `handleBackToSelection`. Clear it in `handleCreateNewMemorization`.

- [ ] **Step 4: SavedContent Edit button** (English label `Edit`, Pencil/Edit icon) next to Practice; wire `onEditContent`

- [ ] **Step 5: TextInput** show "Edit Saved Content" when `isEditing`

---

### Task 4: Save paths call update when editing

**Files:**
- Modify: `src/components/MemorizationView/MemorizationView.tsx`
- Modify: `src/App.tsx` (`handleSaveDictation`, `handleSaveGame`)

**Interfaces:**
- MemorizationView optional `editingContentId?: string`
- Uses `updateSavedContent` when set; skip save-limit check on update
- Button label: `Update` when editing

- [ ] **Step 1: MemorizationView** — if `editingContentId`, call `updateSavedContent`; else `addSavedContent`. Pass prop from App.

- [ ] **Step 2: handleSaveDictation / handleSaveGame** — same branch; on success `setAppState({ page: 'saved' })`

- [ ] **Step 3: Component test** — MemorizationView with `editingContentId` invokes update mock not create (extend or add small test)

---

### Task 5: Manual verification checklist (user)

- [ ] Saved → Edit → text page prefilled
- [ ] Change text + reselect words → Update → list shows new text; same id
- [ ] Published item still has Copy Link after update
- [ ] Create New still creates a new row
- [ ] Title pencil still works independently

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Edit button on Saved | 3 |
| Prefill text input | 3 |
| Full create flow | 3–4 |
| Overwrite same id | 1–2, 4 |
| No save-limit on update | 4 |
| Keep public_id / published | 1 |
| Title pencil kept | 3 (no change) |
| practiceMode from save path | 4 |
