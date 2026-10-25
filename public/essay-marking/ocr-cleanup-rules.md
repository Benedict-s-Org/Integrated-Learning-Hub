# English Essay OCR Transcript Cleanup and Review Rules (Teacher Maintenance Guide)

Welcome to the OCR format cleanup and review rules maintenance system for primary English essay marking.  
**Teachers can directly edit the YAML configuration block in this file to add, modify, or disable OCR cleanup and review rules in real time, without touching any TypeScript code.**

---

## 📖 Teacher Operation Guide

### A. File Location and How to Edit
- **File path**: `public/essay-marking/ocr-cleanup-rules.md`
- **How to open**: Open this file in any text editor (such as VS Code, Cursor, Notepad++, or Windows Notepad).
- **How to save**: Press `Ctrl + S` after making changes.

### B. Active Configuration Block vs. Documentation Examples
- **The Only Active Block**: Exactly **one** code fence labeled ````yaml active-rules```` contains the live machine-readable rules parsed by the application.
- **Tutorial Example Fences**: All explanatory code snippets throughout this guide are labeled ````yaml-example````. The loader will completely ignore these tutorial snippets so they cannot be mistaken for active rules.

### C. How to Add Common Rules
All custom rules are located under the `rules:` list inside the active YAML block.

#### 1. Add a Worksheet Heading or Header Review Notice
If OCR frequently transcribes worksheet instructions or topic titles into the essay transcript, add an `action: review_notice` rule:
```yaml-example
  - id: 'ws_my_school_picnic'
    description: 'Worksheet title: A School Picnic'
    enabled: true
    action: 'review_notice'
    noticeType: 'worksheet_boilerplate'
    scope: 'whole_line_exact'
    matchLiteral: 'A School Picnic'
    message: 'Suspected worksheet prompt title: "A School Picnic"'
```

#### 2. Add a Suspicious Literal Sequence Review Notice
If Mathpix OCR leaves an unexpected LaTeX symbol (e.g. `\clubsuit`), add a literal sequence review notice:
```yaml-example
  - id: 'syntax_clubsuit_symbol'
    description: 'Flag unhandled clubsuit symbol'
    enabled: true
    action: 'review_notice'
    noticeType: 'suspicious_syntax'
    scope: 'literal_sequence'
    matchLiteral: '\clubsuit'
    message: 'Unhandled special formatting symbol: \clubsuit'
```

#### 3. Add a Safe Literal Replacement Rule
If a format artifact should always be normalized to plain text (e.g., LaTeX escaped underscore `\_` to plain underscore `_`):
```yaml-example
  - id: 'replace_escaped_underscore'
    description: 'Convert LaTeX escaped underscore \_ to plain underscore _'
    enabled: true
    action: 'replace'
    scope: 'all_literal_occurrences'
    matchLiteral: '\_'
    replacementLiteral: '_'
```

#### 4. Add a Delimited Block Review Notice
To flag a multi-line structure bounded by specific start and end markers:
```yaml-example
  - id: 'block_custom_diagram'
    description: 'Review custom diagram block'
    enabled: true
    action: 'review_notice'
    noticeType: 'suspicious_syntax'
    scope: 'delimited_block'
    startMarker: '\begin{tikzpicture}'
    endMarker: '\end{tikzpicture}'
    message: 'Detected custom diagram environment; preserved for review without alteration'
```

### D. How to Disable a Rule
To turn off any rule without deleting it, simply change `enabled: true` to `enabled: false`:
```yaml-example
  - id: 'ws_school_year_hyphen'
    enabled: false # Set to false to disable this rule
```

### E. How to Choose a Unique Rule ID
- Each rule `id` must be **globally unique** within the file.
- Use only alphanumeric characters, underscores `_`, and hyphens `-` (e.g. `ws_unit3_heading`).
- Duplicate IDs are rejected during schema validation to prevent accidental rule shadowing.

### F. YAML String Quoting and Escaping Safety Rules
- **Best Practice**: Always enclose values containing backslashes `\`, curly braces `{}`, or dollar signs `$` in **single quotes `'...'`**.
  - Example: `matchLiteral: '\_ '`, `matchLiteral: '\begin{tabular}'`
- **Escaping Single Quotes**: If the text itself contains a single quote, write two consecutive single quotes `''`:
  - Example: `message: 'Student''s writing checklist'`

### G. Automatic Transformation (Replace) vs. Review-Only Notices
- **Automatic Transformation (`action: replace`)**: Used strictly for 100% safe format unboxing (such as unwrapping display math brackets or escaped underscores).
- **Review Notice (`action: review_notice`)**: Leaves all words intact without automatic deletion, displaying a non-blocking review badge in the UI (e.g., tables, worksheet headers, skip-line X markers).

### H. Why Spelling Correction and Automatic Deletion Are Excluded
1. **Preserving Genuine Student Writing**: The core goal of essay marking is evaluating authentic student language. If OCR autocorrects `Octoher` to `October`, the rubric cannot identify genuine student spelling errors.
2. **Preventing Accidental Prose Loss**: A worksheet heading phrase might appear naturally inside a student's sentence (e.g., "I love English Writing 2 because it is fun"). Deleting it would damage student prose. Non-blocking review notices allow teachers to quickly confirm or edit the text on screen.

### I. Safeguards Against Invalid Configuration
If a YAML indentation error, typo, or schema violation occurs, the system **immediately displays an actionable error message on screen**, **never initiates paid Mathpix OCR**, and **never corrupts or overwrites saved student transcripts**.

### J. When Do Edits Take Effect?
1. **Local Development**: Once saved (`Ctrl + S`), the very next OCR or batch transcription automatically loads the fresh rules asset (bypassing browser cache).
2. **Active In-Flight Jobs**: An ongoing OCR batch continues using its immutable startup snapshot to ensure consistent behavior across all students in that run.
3. **Saved Student Transcripts**: Editing rules never rewrites or alters existing saved transcripts retroactively.
4. **Production Deployments**: Updated files take effect once published to the static web server.

### K. How to Restore or Undo Changes
The default active configuration block below contains the full canonical set of prepopulated rules. You can revert individual rules to their original settings or use Git (`git checkout public/essay-marking/ocr-cleanup-rules.md`) to restore the file.

---

## ⚙️ Active Configuration Block

```yaml active-rules
schemaVersion: "1.0"
description: "English Essay OCR Cleanup and Review Rules Configuration"

# ==============================================================================
# Built-in Structural Processors Configuration
# Controls LaTeX wrapper unwrapping, ordinal superscripts, standalone X markers,
# table detection, and bounded page labels.
# ==============================================================================
builtInProcessors:
  # 1. LaTeX Wrapper Processor
  latexWrappers:
    enabled: true
    # Supported display and inline math wrappers (unwrapped while preserving line structure)
    displayWrappers:
      - "\\["
      - "\\]"
      - "\\("
      - "\\)"
    # Supported style commands (supports nested wrappers, e.g. \textbf{\textit{...}})
    styleCommands:
      - "text"
      - "mathrm"
      - "textbf"
      - "textit"
      - "mathbf"
      - "emph"
      - "textrm"
      - "textsf"
      - "textsl"
      - "underline"

  # 2. Ordinal Superscripts Processor (e.g. 12^{\text{th}} -> 12th)
  ordinalSuperscripts:
    enabled: true
    suffixes:
      - "st"
      - "nd"
      - "rd"
      - "th"

  # 3. Standalone X / Skip-Line Detection
  standaloneX:
    enabled: true
    flagStandaloneLine: true      # Whole line containing only X or x (student skip-line marker)
    flagIsolatedInProse: true     # Isolated X in prose (never matches inside words like Next/six/excited/fox)

  # 4. LaTeX Tabular & Table Structure Detection
  # Covers complete tabular blocks, unclosed tables, \hline, \multicolumn, and residual separators
  tableDetection:
    enabled: true
    flagCompleteTabularBlocks: true    # Complete \begin{tabular} ... \end{tabular} blocks
    flagIncompleteTabularBlocks: true  # Unclosed table environments
    flagResidualCommands: true         # Residual \hline or \multicolumn commands
    flagTableSeparators: true          # Residual table separators (& \multicolumn, row breaks \\)

  # 5. Standalone Page Number Labels
  pageNumberLabels:
    enabled: true
    pattern: "^P\\.?\\s*\\d+$"

# ==============================================================================
# Custom Rules List
# Supports 'replace' (safe literal replacement) and 'review_notice' (review flags)
# ==============================================================================
rules:
  # ----------------------------------------------------------------------------
  # [Format Normalization - Replace]
  # ----------------------------------------------------------------------------
  - id: "replace_escaped_underscore"
    description: "Replace LaTeX escaped underscore \\_ with plain underscore _"
    enabled: true
    action: "replace"
    scope: "all_literal_occurrences"
    matchLiteral: "\\_"
    replacementLiteral: "_"

  # ----------------------------------------------------------------------------
  # [Worksheet Headers & Instructions - Review Notices]
  # ----------------------------------------------------------------------------
  - id: "ws_mind_map_prompt"
    description: "Worksheet mind map instruction"
    enabled: true
    action: "review_notice"
    noticeType: "worksheet_boilerplate"
    scope: "whole_line_prefix"
    matchLiteral: "You may use a mind map to help you"
    message: "Suspected worksheet boilerplate line: \"You may use a mind map to help you.\""

  - id: "ws_editing_checklist"
    description: "Worksheet editing checklist header"
    enabled: true
    action: "review_notice"
    noticeType: "worksheet_boilerplate"
    scope: "whole_line_prefix"
    matchLiteral: "Reviewing and editing checklist:"
    message: "Suspected worksheet checklist boilerplate header: \"Reviewing and editing checklist:\""

  - id: "ws_english_writing_worksheet"
    description: "Worksheet title: English Writing Worksheet"
    enabled: true
    action: "review_notice"
    noticeType: "worksheet_boilerplate"
    scope: "whole_line_exact"
    matchLiteral: "English Writing Worksheet"
    message: "Suspected worksheet title header: \"English Writing Worksheet\""

  - id: "ws_english_writing_2"
    description: "Worksheet title: English Writing 2"
    enabled: true
    action: "review_notice"
    noticeType: "worksheet_boilerplate"
    scope: "whole_line_exact"
    matchLiteral: "English Writing 2"
    message: "Suspected worksheet title header: \"English Writing 2\""

  - id: "ws_p4_english_writing_2"
    description: "Combined worksheet header: P. 4 English Writing 2"
    enabled: true
    action: "review_notice"
    noticeType: "worksheet_boilerplate"
    scope: "whole_line_exact"
    matchLiteral: "P. 4 English Writing 2"
    message: "Suspected worksheet combined header: \"P. 4 English Writing 2\""

  - id: "ws_page_label_p2"
    description: "Standalone page label: P. 2"
    enabled: true
    action: "review_notice"
    noticeType: "worksheet_boilerplate"
    scope: "whole_line_exact"
    matchLiteral: "P. 2"
    message: "Suspected worksheet page label: \"P. 2\""

  - id: "ws_page_label_p4"
    description: "Standalone page label: P. 4"
    enabled: true
    action: "review_notice"
    noticeType: "worksheet_boilerplate"
    scope: "whole_line_exact"
    matchLiteral: "P. 4"
    message: "Suspected worksheet page label: \"P. 4\""

  # ----------------------------------------------------------------------------
  # [School Year Headers - Review Notices]
  # ----------------------------------------------------------------------------
  - id: "ws_school_year_hyphen"
    description: "Observed school year header: 2026-2027"
    enabled: true
    action: "review_notice"
    noticeType: "worksheet_boilerplate"
    scope: "whole_line_exact"
    matchLiteral: "2026-2027"
    message: "Suspected worksheet school year header: \"2026-2027\""

  - id: "ws_school_year_endash"
    description: "Observed school year header: 2026–2027 (en-dash)"
    enabled: true
    action: "review_notice"
    noticeType: "worksheet_boilerplate"
    scope: "whole_line_exact"
    matchLiteral: "2026–2027"
    message: "Suspected worksheet school year header: \"2026–2027\""
```
