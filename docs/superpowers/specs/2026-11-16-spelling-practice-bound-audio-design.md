# Spelling Practice Bound Audio Design

**Date:** 2026-11-16  
**Status:** Draft for review  
**Approach:** A — store `word_audio` JSON on `spelling_practices`

## Problem

Creating a spelling practice can generate Google Drive TTS files via Cloud TTS / `tts_cache`, but Save only stores title and words. Playback on another device re-resolves audio from the current user's accent/voice preference (or browser fallback). That breaks the creator's expectation: the audio they confirmed at create time must be the audio students hear.

## Goal

For newly created spelling practices, every word must be bound to a specific Drive audio file at Save time. Practice playback must use those bound files only — never re-synthesize from account preference and never fall back to browser TTS for bound practices.

## Non-goals

- Migrating or re-recording all existing practices
- Changing phonics / memorization / other TTS consumers
- Per-student voice overrides for spelling assignments
- Replacing `tts_cache` (it remains the generation/cache layer used during Preview)

## Decisions (confirmed)

| Decision | Choice |
|---|---|
| Storage shape | Approach A: `word_audio` JSON on `spelling_practices` |
| Save gate | Must Cloud/Drive-confirm every word before Save |
| What counts as confirmed | Cloud/Drive playback completed successfully only; browser TTS does not count |
| Voice/accent change during Preview | Invalidate all confirmations; must re-confirm every word |
| Bound playback | Drive file only; show error if missing/unplayable; no silent fallback |
| Legacy practices without `word_audio` | Keep current preference/TTS behavior so old assignments still work |

## Data model

Add columns on `spelling_practices`:

```text
word_audio  jsonb   NOT NULL DEFAULT '[]'
  -- array aligned conceptually with words[]; each entry:
  -- {
  --   "word": string,           -- exact practice word
  --   "drive_file_id": string,  -- Google Drive file id
  --   "accent": string,         -- e.g. en-GB
  --   "voice_name": string      -- Google Cloud voice id, e.g. en-GB-Neural2-B
  -- }
audio_accent     text  NULL  -- accent used for the bound set (denormalized for UI)
audio_voice_name text  NULL  -- voice id used for the bound set
```

Rules:

- For new creates, `word_audio.length === words.length`.
- Entry `i` corresponds to `words[i]` (`word` field must equal `words[i]`).
- All entries in one practice share the same `accent` and `voice_name` (enforced by Preview invalidation on voice change).
- Legacy rows may have `word_audio = []`; playback treats empty as unbound.

## Preview / create flow (`SpellingPreview`)

1. Admin selects Premium Google voice (browser-only voices cannot produce bindable Drive ids for this flow; Save remains blocked until Cloud confirmation succeeds).
2. Playing a word:
   - Call Cloud TTS (existing `fetchCloudAudioRich` / google-tts) so response includes `driveFileId` + playable audio.
   - On successful end of Cloud/Drive playback, mark that word index confirmed and store `{ word, drive_file_id, accent, voice_name }`.
   - If Cloud fails or UI falls back to browser speech, do **not** mark confirmed.
3. Play All: mark each word confirmed only when that word's Cloud/Drive play succeeds; browser fallback for a word leaves it unconfirmed.
4. Changing accent or voice clears the entire confirmation map.
5. Save button enabled only when every word index is confirmed under the current voice.
   - UI shows progress, e.g. `Audio confirmed 3/10`.
6. Save payload includes `words` plus full `word_audio` (and accent/voice denormalized fields).
7. `spelling-practices/create` rejects requests that lack a complete, consistent `word_audio` binding for new practices.

## Playback flow (`SpellingPractice`)

1. Load practice including `word_audio`.
2. If `word_audio` is non-empty and complete:
   - For word `i`, resolve audio via existing Drive proxy (`resolveAudioUrl` / google-tts `proxy_download`) using `word_audio[i].drive_file_id`.
   - Play that file only.
   - On failure: show a clear English error (e.g. "Audio unavailable for this word") and do not synthesize or use browser TTS.
3. If `word_audio` is empty (legacy): keep today's behavior (preference → Cloud TTS → browser fallback).

## Components / ownership

| Unit | Responsibility |
|---|---|
| `SpellingPreview` | Confirmation state, Save gating, send `word_audio` on create |
| `spelling-practices` Edge Function | Persist `word_audio`; validate completeness on create |
| `SpellingPractice` | Bound-file playback vs legacy path |
| `voiceManager` (`fetchCloudAudioRich`, `resolveAudioUrl`) | Already returns/resolves Drive ids; extend callers to capture `driveFileId` during Preview |
| DB migration | Add columns + defaults for legacy rows |

## Error handling

- Preview Cloud failure: word stays unconfirmed; optional short status text; Save stays disabled.
- Save with incomplete audio: client blocks; server also rejects.
- Bound playback Drive/proxy failure: visible error, no fallback voice.
- Mismatched `word` vs `words[i]` on save: server rejects.

## Testing

- Unit: confirmation map — confirm on Cloud success; no confirm on browser fallback; clear all on voice change; Save enabled only when complete.
- Unit/integration: create payload validation (complete / incomplete / word mismatch).
- Component: SpellingPractice bound path uses `drive_file_id` and does not call preference-based synthesize when bound.
- Manual: create on PC A with Premium GB male, confirm all, save; open assignment on PC B and verify same Drive audio (not US female browser voice).

## Rollout

1. Migration + Edge Function accept/store `word_audio`.
2. Preview Save gate + bind on create.
3. Practice playback bound path.
4. Deploy web (`main`) after verification.

Existing practices without bindings continue to work via legacy path until optionally recreated.
