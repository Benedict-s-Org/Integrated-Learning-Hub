# Spelling Practice Bound Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind each spelling-practice word to a confirmed Google Drive audio file at Save time, and play only those files during practice (no preference re-synthesis / browser fallback for bound practices).

**Architecture:** Preview confirms Cloud/Drive playback per word and collects `word_audio` entries. Create persists `word_audio` (+ denormalized accent/voice) on `spelling_practices`. `SpellingPractice` loads bindings (prop or `practiceId` fetch) and plays via Drive proxy only when bound; legacy empty `word_audio` keeps today’s TTS path.

**Tech Stack:** React, Vitest, Supabase Postgres + Edge Functions (`spelling-practices`, `google-tts`), existing `voiceManager` / `audioPlayback`

**Spec:** `docs/superpowers/specs/2026-11-16-spelling-practice-bound-audio-design.md`

## Global Constraints

- UI copy in English only
- New creates require complete Cloud/Drive confirmation before Save
- Browser TTS must not mark a word confirmed
- Changing accent/voice clears all confirmations
- Bound playback: Drive file only; visible error on failure; no silent fallback
- Legacy practices with empty `word_audio` keep preference → Cloud → browser behavior
- Do not auto-commit unless the user asks; when committing, commit only files for the current task

## File map

| File | Responsibility |
|---|---|
| `src/utils/spellingWordAudio.ts` | Types + pure validation / completeness helpers |
| `src/test/utils/spellingWordAudio.test.ts` | Unit tests for helpers |
| `supabase/migrations/20261116120000_spelling_practice_word_audio.sql` | DB columns |
| `src/utils/voiceManager.ts` | Return `driveFileId` from `fetchCloudAudioRich`; `driveFileToProxyUrl` |
| `supabase/functions/spelling-practices/index.ts` | Validate + persist `word_audio` on create |
| `src/components/SpellingPreview/SpellingPreview.tsx` | Confirm map, Save gate, send bindings |
| `src/components/SpellingPractice/SpellingPractice.tsx` | Bound vs legacy speak path |
| `src/types/index.ts` + loaders (`App.tsx`, `SavedPractices`, `PracticeAssignment`, `UnifiedAssignments`) | Thread or fetch `word_audio` |

---

### Task 1: `spellingWordAudio` helpers + tests

**Files:**
- Create: `src/utils/spellingWordAudio.ts`
- Create: `src/test/utils/spellingWordAudio.test.ts`

**Interfaces:**
- Produces:
  - `export type SpellingWordAudio = { word: string; drive_file_id: string; accent: string; voice_name: string }`
  - `export function isCompleteWordAudio(words: string[], wordAudio: SpellingWordAudio[] | null | undefined): boolean`
  - `export function assertWordAudioAligned(words: string[], wordAudio: SpellingWordAudio[]): { ok: true } | { ok: false; reason: string }`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { assertWordAudioAligned, isCompleteWordAudio, type SpellingWordAudio } from '../../utils/spellingWordAudio';

const entry = (word: string): SpellingWordAudio => ({
  word,
  drive_file_id: `id-${word}`,
  accent: 'en-GB',
  voice_name: 'en-GB-Neural2-B',
});

describe('isCompleteWordAudio', () => {
  it('is false for empty or short bindings', () => {
    expect(isCompleteWordAudio(['a', 'b'], [])).toBe(false);
    expect(isCompleteWordAudio(['a', 'b'], [entry('a')])).toBe(false);
  });

  it('is true when every word is bound in order', () => {
    expect(isCompleteWordAudio(['Cat', 'Dog'], [entry('Cat'), entry('Dog')])).toBe(true);
  });
});

describe('assertWordAudioAligned', () => {
  it('rejects mismatched word at index', () => {
    const result = assertWordAudioAligned(['Cat'], [entry('Dog')]);
    expect(result.ok).toBe(false);
  });

  it('rejects missing drive_file_id', () => {
    const result = assertWordAudioAligned(['Cat'], [{ ...entry('Cat'), drive_file_id: '' }]);
    expect(result.ok).toBe(false);
  });

  it('accepts aligned complete bindings', () => {
    expect(assertWordAudioAligned(['Cat'], [entry('Cat')]).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/test/utils/spellingWordAudio.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement helpers**

```ts
export type SpellingWordAudio = {
  word: string;
  drive_file_id: string;
  accent: string;
  voice_name: string;
};

export function assertWordAudioAligned(
  words: string[],
  wordAudio: SpellingWordAudio[]
): { ok: true } | { ok: false; reason: string } {
  if (wordAudio.length !== words.length) {
    return { ok: false, reason: `Expected ${words.length} audio bindings, got ${wordAudio.length}` };
  }
  for (let i = 0; i < words.length; i++) {
    const entry = wordAudio[i];
    if (!entry || entry.word !== words[i]) {
      return { ok: false, reason: `Word mismatch at index ${i}` };
    }
    if (!entry.drive_file_id?.trim()) {
      return { ok: false, reason: `Missing drive_file_id at index ${i}` };
    }
    if (!entry.accent?.trim() || !entry.voice_name?.trim()) {
      return { ok: false, reason: `Missing accent/voice at index ${i}` };
    }
  }
  const accents = new Set(wordAudio.map((e) => e.accent));
  const voices = new Set(wordAudio.map((e) => e.voice_name));
  if (accents.size !== 1 || voices.size !== 1) {
    return { ok: false, reason: 'All bindings must share the same accent and voice_name' };
  }
  return { ok: true };
}

export function isCompleteWordAudio(
  words: string[],
  wordAudio: SpellingWordAudio[] | null | undefined
): boolean {
  if (!wordAudio) return false;
  return assertWordAudioAligned(words, wordAudio).ok;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/test/utils/spellingWordAudio.test.ts`

- [ ] **Step 5: Commit** (only if user asked to commit)

```bash
git add src/utils/spellingWordAudio.ts src/test/utils/spellingWordAudio.test.ts
git commit -m "feat(spelling): add word_audio alignment helpers"
```

---

### Task 2: Database migration

**Files:**
- Create: `supabase/migrations/20261116120000_spelling_practice_word_audio.sql`

**Interfaces:**
- Produces columns on `spelling_practices`: `word_audio jsonb NOT NULL DEFAULT '[]'::jsonb`, `audio_accent text NULL`, `audio_voice_name text NULL`

- [ ] **Step 1: Write migration**

```sql
ALTER TABLE public.spelling_practices
  ADD COLUMN IF NOT EXISTS word_audio jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audio_accent text NULL,
  ADD COLUMN IF NOT EXISTS audio_voice_name text NULL;

COMMENT ON COLUMN public.spelling_practices.word_audio IS
  'Per-word Drive TTS bindings: [{word, drive_file_id, accent, voice_name}]';
```

- [ ] **Step 2: Apply locally if project uses local Supabase** (skip if remote-only; note for deploy)

Run: `npx supabase db push` (or project’s usual migration apply) when the user is ready — do not push unprompted.

- [ ] **Step 3: Commit** (only if user asked)

```bash
git add supabase/migrations/20261116120000_spelling_practice_word_audio.sql
git commit -m "feat(spelling): add word_audio columns to spelling_practices"
```

---

### Task 3: `fetchCloudAudioRich` returns `driveFileId` + Drive URL helper

**Files:**
- Modify: `src/utils/voiceManager.ts`
- Test: extend `src/test/utils/spellingWordAudio.test.ts` **or** add `src/test/utils/voiceManager.driveUrl.test.ts` for the pure URL helper only (do not try to unit-test the network invoke here)

**Interfaces:**
- Consumes: google-tts response `driveFileId`
- Produces:
  - `fetchCloudAudioRich(...): Promise<{ audioUrl: string; audioContent: string; driveFileId: string } | null>`
  - `export function driveFileToProxyUrl(driveFileId: string): string` → `https://drive.google.com/uc?export=download&id=${driveFileId}`

- [ ] **Step 1: Write failing test for `driveFileToProxyUrl`**

```ts
import { describe, expect, it } from 'vitest';
import { driveFileToProxyUrl } from '../../utils/voiceManager';

describe('driveFileToProxyUrl', () => {
  it('builds a Drive uc URL resolveAudioUrl can parse', () => {
    expect(driveFileToProxyUrl('abc123')).toBe(
      'https://drive.google.com/uc?export=download&id=abc123'
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (export missing)

- [ ] **Step 3: Implement `driveFileToProxyUrl` and include `driveFileId` in `fetchCloudAudioRich` return**

In `fetchCloudAudioRich` success return:

```ts
return {
  audioUrl: data.audioUrl || '',
  audioContent: data.audioContent
    ? `data:audio/mp3;base64,${data.audioContent}`
    : (data.audioUrl || ''),
  driveFileId: typeof data.driveFileId === 'string' ? data.driveFileId : '',
};
```

If `driveFileId` is empty after a successful audio payload, still return the object (Preview must not confirm without a non-empty id).

- [ ] **Step 4: Run URL helper test — expect PASS**

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add src/utils/voiceManager.ts src/test/utils/voiceManager.driveUrl.test.ts
git commit -m "feat(tts): expose driveFileId from fetchCloudAudioRich"
```

---

### Task 4: Edge Function create validates and stores `word_audio`

**Files:**
- Modify: `supabase/functions/spelling-practices/index.ts`

**Interfaces:**
- Consumes create body:
  ```ts
  {
    title: string;
    words: string[];
    userId: string;
    isPhraseMode?: boolean;
    metadata?: Record<string, unknown>;
    wordAudio: Array<{ word: string; drive_file_id: string; accent: string; voice_name: string }>;
    audioAccent: string;
    audioVoiceName: string;
  }
  ```
- Produces insert including `word_audio`, `audio_accent`, `audio_voice_name`
- Rejects with **400** if bindings incomplete / misaligned / accent-voice inconsistent (duplicate the alignment rules from Task 1 in Deno — inline a small `assertWordAudioAligned` in the edge file; do not import from `src/`)

- [ ] **Step 1: Extend `CreatePracticeRequest` and `/create` handler**

Pseudo-logic after role check:

```ts
const body = await req.json();
const { title, words, userId, isPhraseMode, wordAudio, audioAccent, audioVoiceName } = body;

if (!Array.isArray(words) || words.length === 0) {
  return new Response(JSON.stringify({ error: "words required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const aligned = assertWordAudioAligned(words, wordAudio || []);
if (!aligned.ok) {
  return new Response(JSON.stringify({ error: "Incomplete word audio bindings", details: aligned.reason }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const { data: practice, error: insertError } = await supabase
  .from("spelling_practices")
  .insert({
    title,
    words,
    created_by: userId,
    is_phrase_mode: isPhraseMode || false,
    word_audio: wordAudio,
    audio_accent: audioAccent || wordAudio[0].accent,
    audio_voice_name: audioVoiceName || wordAudio[0].voice_name,
  })
  .select()
  .single();
```

- [ ] **Step 2: Deploy note** — `npx supabase functions deploy spelling-practices` when user is ready (do not deploy unprompted). Migration from Task 2 must be applied on the remote DB first.

- [ ] **Step 3: Commit** (only if user asked)

```bash
git add supabase/functions/spelling-practices/index.ts
git commit -m "feat(spelling): require word_audio on practice create"
```

---

### Task 5: SpellingPreview confirmation + Save gate

**Files:**
- Modify: `src/components/SpellingPreview/SpellingPreview.tsx`
- Optional test: `src/test/components/SpellingPreview.wordAudio.test.tsx` (mock `fetchCloudAudioRich` / `playAudioUrl`)

**Interfaces:**
- Consumes: `fetchCloudAudioRich`, `playAudioUrl`, `isGoogleCloudVoiceId`, `isCompleteWordAudio`
- Produces create body fields `wordAudio`, `audioAccent`, `audioVoiceName`
- State: `confirmedAudio: Record<number, SpellingWordAudio>` (or `Map`)

- [ ] **Step 1: Add confirmation state**

```ts
const [confirmedAudio, setConfirmedAudio] = useState<Record<number, SpellingWordAudio>>({});
```

On accent/voice change (`handleVoiceChange`): `setConfirmedAudio({})`.

- [ ] **Step 2: Change speak paths to confirm only on Cloud success with `driveFileId`**

Replace `fetchCloudAudio` with `fetchCloudAudioRich` in single-word and Play All loops:

Clarified rules for implementer:

1. If `!isGoogleCloudVoiceId(currentVoiceURI)` → never confirm (even if Cloud used accent fallback); show English hint that Premium voice is required to save.
2. If Google voice selected, Cloud returns audio + non-empty `driveFileId`, and `playCloudAudio` returns true → confirm with `voice_name: currentVoiceURI`.
3. Browser fallback branch must not call `setConfirmedAudio`.

```ts
const rich = await fetchCloudAudioRich(word, currentAccent, currentVoiceURI);
const canConfirm =
  isGoogleCloudVoiceId(currentVoiceURI) &&
  !!rich?.audioContent &&
  !!rich.driveFileId;

if (canConfirm) {
  const played = await playCloudAudio(rich!.audioContent);
  if (played) {
    setConfirmedAudio((prev) => ({
      ...prev,
      [index]: {
        word,
        drive_file_id: rich!.driveFileId,
        accent: currentAccent,
        voice_name: currentVoiceURI!,
      },
    }));
    finishPlayback();
    return;
  }
}
// Optional browser audition only — never setConfirmedAudio here.
```

- [ ] **Step 3: Save button gate + progress copy**

```ts
const wordAudioPayload = words.map((_, i) => confirmedAudio[i]);
const canSave =
  wordAudioPayload.every((e): e is SpellingWordAudio => !!e) &&
  isCompleteWordAudio(words, wordAudioPayload as SpellingWordAudio[]);
```

UI (English):

- Progress text: `Audio confirmed {n}/{words.length}`
- Save disabled when `!canSave`
- Helper: `Play every word with a Premium voice until all are confirmed before saving.`

- [ ] **Step 4: `handleSave` body**

```ts
body: JSON.stringify({
  title: title.trim(),
  words,
  userId: user.id,
  isPhraseMode: isPhraseMode,
  metadata: { wordLimit: wordLimit || 20 },
  wordAudio: words.map((_, i) => confirmedAudio[i]),
  audioAccent: currentAccent,
  audioVoiceName: currentVoiceURI,
})
```

Abort client-side if `!canSave`.

- [ ] **Step 5: Manual check** — Preview with Premium GB male: Play All → Save enables; switch voice → Save disables; browser-only voice never enables Save.

- [ ] **Step 6: Commit** (only if user asked)

```bash
git add src/components/SpellingPreview/SpellingPreview.tsx
git commit -m "feat(spelling): require confirmed Drive audio before save"
```

---

### Task 6: SpellingPractice bound playback

**Files:**
- Modify: `src/components/SpellingPractice/SpellingPractice.tsx`
- Modify: `src/types/index.ts` (`SpellingPracticeList` optional `word_audio`, `audio_accent`, `audio_voice_name` if used)
- Modify loaders that open practice so `wordAudio` is available when already fetched:
  - `src/App.tsx` (saved / assignment → practice state)
  - `src/components/SavedPractices/SavedPractices.tsx` (ensure list/select includes `word_audio`)
  - `src/components/PracticeAssignment/PracticeAssignment.tsx`
  - `src/components/UnifiedAssignments/UnifiedAssignments.tsx` (spelling `content_data` / practice payload)

**Interfaces:**
- Props add optional `wordAudio?: SpellingWordAudio[]`
- If `wordAudio` omitted and `practiceId` is a real UUID (not `srs-review`), fetch:

```ts
const { data } = await supabase
  .from('spelling_practices')
  .select('word_audio')
  .eq('id', practiceId)
  .maybeSingle();
```

- Bound path when `isCompleteWordAudio(practiceWords, boundAudio)` **for the full practice words before any wordLimit slice**, then map bindings onto the active `practiceWords` subset by matching word string + order, **or** simpler: fetch/bind against the same `rawWords` array passed into the component, then after wordLimit/SRS selection build a parallel audio list by index into the selected subset.

**Preferred selection rule (explicit):**

1. Load `boundAudio` for the practice’s full `words` array as stored in DB (same order as prop `words` / `rawWords` before limit).
2. When building `selectedWords` / `practiceWords`, also build `practiceAudio: SpellingWordAudio[]` by taking the same indices from `boundAudio` (or filter by selected word list preserving first occurrences).
3. If after selection `isCompleteWordAudio(practiceWords, practiceAudio)` → bound mode for the session.
4. If practice has empty `word_audio` → legacy mode.
5. If practice has non-empty but incomplete/corrupt bindings → show English error banner “Practice audio is incomplete.” and disable play (do not fall back).

- [ ] **Step 1: Load bindings into state `practiceAudio`**

- [ ] **Step 2: Rewrite `speakWord`**

```ts
const speakWord = async (word: string) => {
  const idx = practiceWords.indexOf(word); // prefer currentWordIndex
  const i = currentWordIndex;
  const binding = practiceAudio[i];

  if (useBoundAudio) {
    if (!binding?.drive_file_id) {
      setAudioError('Audio unavailable for this word');
      return;
    }
    try {
      unlockAudioSync(); // caller should already unlock on click; keep safe
      const proxyUrl = driveFileToProxyUrl(binding.drive_file_id);
      const playable = await resolveAudioUrl(proxyUrl);
      if (!playable) {
        setAudioError('Audio unavailable for this word');
        return;
      }
      await playAudioUrl(playable);
    } catch {
      setAudioError('Audio unavailable for this word');
    }
    return;
  }

  // legacy: existing fetchCloudAudio → browser fallback
};
```

Wire Play button to clear `audioError` on success; show error in English near the player.

- [ ] **Step 3: Pass `wordAudio` from App / UnifiedAssignments / PracticeAssignment / SavedPractices when the object already has it; otherwise rely on `practiceId` fetch.**

- [ ] **Step 4: Manual verification**

1. Create practice on PC A: Premium en-GB male, Play All confirm, Save.  
2. Open assignment on another account/device: must hear same Drive file.  
3. Open a pre-migration practice: legacy TTS still works.

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add src/components/SpellingPractice/SpellingPractice.tsx src/App.tsx src/types/index.ts src/components/SavedPractices/SavedPractices.tsx src/components/PracticeAssignment/PracticeAssignment.tsx src/components/UnifiedAssignments/UnifiedAssignments.tsx
git commit -m "feat(spelling): play bound Drive audio for saved practices"
```

---

### Task 7: Deploy checklist (manual)

- [ ] **Step 1:** Apply migration on remote Supabase  
- [ ] **Step 2:** Deploy `spelling-practices` (and ensure `google-tts` already returns `driveFileId`)  
- [ ] **Step 3:** Push web `main` when user requests deploy  
- [ ] **Step 4:** Smoke-test create → assign → other device playback

---

## Spec coverage self-review

| Spec requirement | Task |
|---|---|
| `word_audio` JSON on practice | 1, 2, 4 |
| Preview Cloud-only confirmation | 5 |
| Save blocked until all confirmed | 5 |
| Voice change clears confirmations | 5 |
| Persist bindings on create + server reject incomplete | 4 |
| Bound playback Drive-only, error on failure | 6 |
| Legacy empty `word_audio` path | 6 |
| Capture `driveFileId` from TTS | 3 |

## Placeholder / consistency check

- Types use `drive_file_id` / `voice_name` / `accent` consistently (snake_case in stored JSON to match DB style used elsewhere like `is_phrase_mode`).
- Edge create requires bindings for **all** new creates (no optional escape hatch), matching spec.
- `fetchCloudAudioRich` return type must include `driveFileId` before Task 5.
