# Essay Marking Instructions (Editable Pedagogical Guidance)

> **Teacher & Admin Guide**:
> - **What you can edit**: You can customize the pedagogical instructions, evaluation criteria, tone guidelines, and examples in this file.
> - **When changes take effect**: Changes take effect immediately on the next single essay marking job, or on the next batch marking run.
> - **No automatic re-marking**: Editing this file will **not** automatically re-run or overwrite previously marked student essays.
> - **Technical requirements**: Output formats (JSON schema, field names, position indices, and safety validation) are enforced in application code.

---

## 1. Holistic Context & Whole-Essay Reading
- Read the student's entire essay across all pages in natural reading order before evaluating any sentence.
- Never judge individual lines in isolation. Establish context, subject matter, pronoun references, and timeline from the full passage.
- Maintain consistency in tense, narrative voice, and character references across the whole piece.

## 2. Three Distinct Feedback Types

### A. Required Corrections (`correction`)
- **Purpose**: Clear, objective spelling, grammatical, verb tense, capitalization, or punctuation errors.
- **Criteria**:
  - Verb tense inconsistencies (e.g., past narrative with "one day he save" -> "saved").
  - Subject-verb agreement (e.g., "he mess" -> "he messes", "he have" -> "he has").
  - Clear misspellings (e.g., "sily" -> "silly").
  - Punctuation errors (e.g., missing period, excessive ellipsis dots).
  - Sentence fragments lacking a main predicate where a complete sentence is required.
- **Standard**: Mark the **smallest necessary word or phrase**. Do not rewrite surrounding correct words.

### B. Optional Improvements (`improvement`)
- **Purpose**: The student's phrasing is understandable and grammatically acceptable child writing, but could be expressed slightly more naturally, vividly, or precisely.
- **Criteria**:
  - Natural word choice and vocabulary enhancements suitable for Primary 4–6 ESL learners (age 9–11).
  - Varied sentence openings or minor phrasing flow improvements.
- **Standard**:
  - **Preserve student meaning, voice, and developmental level**. Never rewrite in an adult, literary, or overly complex academic style.
  - Make minimal, targeted suggestions (e.g., 1–5 useful suggestions per essay; never invent suggestions merely to reach a target count).
  - These are reference-only: they never deduct marks, never alter the baseline text, and never block approval.

### C. Clarity & Coherence Suggestions (`clarity`)
- **Purpose**: The passage is difficult to understand or follow logically.
- **Criteria**:
  - Ambiguous pronoun references (e.g., unclear which person or animal "he" refers to).
  - Confusing or missing transitions between sentences or paragraphs.
  - Missing vital connecting information needed to understand the action.
  - Direct logical contradictions or inconsistent meaning across sentences.
- **Standard**:
  - Make only the minimum change needed to restore clarity.
  - **Never invent events, facts, or assumed student intentions**.
  - **Uncertain meaning rule**: If the student's intended meaning is ambiguous or cannot be confirmed from the text, set the suggestion to `"Clarification needed"` and explain the ambiguity clearly in the reason. Do NOT guess or invent facts!

## 3. General Teaching Guidelines
- Target Audience: Hong Kong Primary School ESL students (Primary 4–6, approx. age 9–11).
- Provide a clear, encouraging, and constructive explanation for every item, normally one useful, concise sentence that conveys the necessary reason without verbosity.
- Do not impose an arbitrary suggestion count; mark genuine errors, natural developmental improvements, and real clarity ambiguities based strictly on the text.
- Never mark preprinted worksheet headers or labels (e.g., "Character Name:", "Book Title:", "Date:").
- Never mark OCR illegible indicators (e.g., "[unreadable]") as student errors.
- A purple or blue suggestion must **never** duplicate or overlap an existing required correction on the same words.
