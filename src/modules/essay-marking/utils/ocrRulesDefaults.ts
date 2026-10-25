import { OcrRulesConfig } from './ocrRulesSchema';

/**
 * Canonical built-in rules configuration.
 * Contains all prepopulated rules and structural processor defaults.
 */
export const DEFAULT_OCR_RULES_CONFIG: OcrRulesConfig = {
  schemaVersion: '1.0',
  description: 'Default English Essay OCR Cleanup and Review Rules',
  builtInProcessors: {
    latexWrappers: {
      enabled: true,
      displayWrappers: ['\\[', '\\]', '\\(', '\\)'],
      styleCommands: [
        'text',
        'mathrm',
        'textbf',
        'textit',
        'mathbf',
        'emph',
        'textrm',
        'textsf',
        'textsl',
        'underline',
      ],
    },
    ordinalSuperscripts: {
      enabled: true,
      suffixes: ['st', 'nd', 'rd', 'th'],
    },
    standaloneX: {
      enabled: true,
      flagStandaloneLine: true,
      flagIsolatedInProse: true,
    },
    tableDetection: {
      enabled: true,
      flagCompleteTabularBlocks: true,
      flagIncompleteTabularBlocks: true,
      flagResidualCommands: true,
      flagTableSeparators: true,
    },
    pageNumberLabels: {
      enabled: true,
      pattern: '^P\\.?\\s*\\d+$',
    },
  },
  rules: [
    // 1. Literal Replacements
    {
      id: 'replace_escaped_underscore',
      description: 'Convert LaTeX escaped underscore \\_ to plain underscore _',
      enabled: true,
      action: 'replace',
      scope: 'all_literal_occurrences',
      matchLiteral: '\\_',
      replacementLiteral: '_',
    },

    // 2. Worksheet Boilerplate Review Notices
    {
      id: 'ws_mind_map_prompt',
      description: 'Worksheet mind map instruction',
      enabled: true,
      action: 'review_notice',
      noticeType: 'worksheet_boilerplate',
      scope: 'whole_line_prefix',
      matchLiteral: 'You may use a mind map to help you',
      message: 'Suspected worksheet boilerplate line: "You may use a mind map to help you."',
    },
    {
      id: 'ws_editing_checklist',
      description: 'Worksheet editing checklist header',
      enabled: true,
      action: 'review_notice',
      noticeType: 'worksheet_boilerplate',
      scope: 'whole_line_prefix',
      matchLiteral: 'Reviewing and editing checklist:',
      message: 'Suspected worksheet checklist boilerplate header: "Reviewing and editing checklist:"',
    },
    {
      id: 'ws_english_writing_worksheet',
      description: 'Worksheet title: English Writing Worksheet',
      enabled: true,
      action: 'review_notice',
      noticeType: 'worksheet_boilerplate',
      scope: 'whole_line_exact',
      matchLiteral: 'English Writing Worksheet',
      message: 'Suspected worksheet title header: "English Writing Worksheet"',
    },
    {
      id: 'ws_english_writing_2',
      description: 'Worksheet title: English Writing 2',
      enabled: true,
      action: 'review_notice',
      noticeType: 'worksheet_boilerplate',
      scope: 'whole_line_exact',
      matchLiteral: 'English Writing 2',
      message: 'Suspected worksheet title header: "English Writing 2"',
    },
    {
      id: 'ws_p4_english_writing_2',
      description: 'Combined worksheet header: P. 4 English Writing 2',
      enabled: true,
      action: 'review_notice',
      noticeType: 'worksheet_boilerplate',
      scope: 'whole_line_exact',
      matchLiteral: 'P. 4 English Writing 2',
      message: 'Suspected worksheet combined header: "P. 4 English Writing 2"',
    },
    {
      id: 'ws_page_label_p2',
      description: 'Standalone page label: P. 2',
      enabled: true,
      action: 'review_notice',
      noticeType: 'worksheet_boilerplate',
      scope: 'whole_line_exact',
      matchLiteral: 'P. 2',
      message: 'Suspected worksheet page label: "P. 2"',
    },
    {
      id: 'ws_page_label_p4',
      description: 'Standalone page label: P. 4',
      enabled: true,
      action: 'review_notice',
      noticeType: 'worksheet_boilerplate',
      scope: 'whole_line_exact',
      matchLiteral: 'P. 4',
      message: 'Suspected worksheet page label: "P. 4"',
    },

    // 3. School Year Headers (Review-only exact line matches)
    {
      id: 'ws_school_year_hyphen',
      description: 'Observed school year header: 2026-2027',
      enabled: true,
      action: 'review_notice',
      noticeType: 'worksheet_boilerplate',
      scope: 'whole_line_exact',
      matchLiteral: '2026-2027',
      message: 'Suspected worksheet school year header: "2026-2027"',
    },
    {
      id: 'ws_school_year_endash',
      description: 'Observed school year header: 2026–2027 (en-dash)',
      enabled: true,
      action: 'review_notice',
      noticeType: 'worksheet_boilerplate',
      scope: 'whole_line_exact',
      matchLiteral: '2026–2027',
      message: 'Suspected worksheet school year header: "2026–2027"',
    },
  ],
};
