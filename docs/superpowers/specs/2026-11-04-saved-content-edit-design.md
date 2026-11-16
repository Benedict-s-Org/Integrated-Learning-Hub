# Saved Content Edit

Approved: 2026-11-04 (Hong Kong)

## Goal

On the Paragraph Memorization **Saved** page, each saved article gets an **Edit** button. Edit reopens the create flow with the existing title and text prefilled. Saving **overwrites** that same saved article (same id). Assign / public links keep working.

## User flow

1. Saved list → **Edit**
2. Text input page opens with original title + body filled in (heading: Edit Saved Content)
3. User may change title/text → Next → select words again → Save / Update
4. On success → return to Saved list; that item shows the new text and selection
5. Leaving without Save discards the in-progress edit (DB unchanged)

Keep the existing pencil for **title-only** quick rename on the Saved list.

## Behaviour rules

- Overwrite in place — do **not** create a second saved item
- Updates do **not** consume an extra save-limit slot
- Keep `public_id` / published status when updating
- `practiceMode` follows whatever path the user saves through this edit (memorization / dictation / shuffled)
- Create New stays a normal create (no editing id)

## Technical shape (reuse create flow)

- App `new` steps carry optional `editingContentId`
- New edge route `memorization-content/update` + `AppContext.updateSavedContent`
- Memorization / Dictation / Shuffled save: if `editingContentId` → update; else → create

## Out of scope

- Save as new copy
- In-place modal editor on the Saved list
- Changing Assign / Practice / Publish / Delete behaviour beyond pointing at the same id
