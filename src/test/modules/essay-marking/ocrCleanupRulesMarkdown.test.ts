import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseAndValidateOcrRules,
  extractActiveYamlBlock,
  OcrRulesConfig,
} from '../../../modules/essay-marking/utils/ocrRulesSchema';
import {
  loadOcrRulesSnapshot,
  resetOcrRulesCache,
  setOcrRulesSnapshotForTesting,
} from '../../../modules/essay-marking/utils/ocrRulesLoader';
import {
  normalizeOcrFormat,
  detectReviewNotices,
  normalizeOcrTranscript,
} from '../../../modules/essay-marking/utils/ocrFormatNormalizer';
import { DEFAULT_OCR_RULES_CONFIG } from '../../../modules/essay-marking/utils/ocrRulesDefaults';

describe('OCR Cleanup Rules Markdown Integration & User Maintainability', () => {
  beforeEach(() => {
    resetOcrRulesCache();
  });

  // Test 1: Real file loads, validates, and has expected schema version and rules
  it('1. loads and validates the real public/essay-marking/ocr-cleanup-rules.md file', async () => {
    const res = await loadOcrRulesSnapshot(true);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const { snapshot } = res;
    expect(snapshot.config.schemaVersion).toBe('1.0');
    expect(snapshot.hash).toMatch(/^[0-9a-f]{8}$/);
    expect(snapshot.config.rules.length).toBeGreaterThanOrEqual(10);

    // Verify all required prepopulated rules exist
    const ruleIds = snapshot.config.rules.map((r) => r.id);
    expect(ruleIds).toContain('replace_escaped_underscore');
    expect(ruleIds).toContain('ws_mind_map_prompt');
    expect(ruleIds).toContain('ws_editing_checklist');
    expect(ruleIds).toContain('ws_english_writing_worksheet');
    expect(ruleIds).toContain('ws_english_writing_2');
    expect(ruleIds).toContain('ws_p4_english_writing_2');
    expect(ruleIds).toContain('ws_page_label_p2');
    expect(ruleIds).toContain('ws_page_label_p4');
    expect(ruleIds).toContain('ws_school_year_hyphen');
    expect(ruleIds).toContain('ws_school_year_endash');

    // Verify built-in structural processors
    expect(snapshot.config.builtInProcessors.latexWrappers.enabled).toBe(true);
    expect(snapshot.config.builtInProcessors.ordinalSuperscripts.enabled).toBe(true);
    expect(snapshot.config.builtInProcessors.standaloneX.enabled).toBe(true);
    expect(snapshot.config.builtInProcessors.tableDetection.enabled).toBe(true);
    expect(snapshot.config.builtInProcessors.pageNumberLabels.enabled).toBe(true);
  });

  // Test 2: Schema validation rejects duplicate IDs, invalid actions, and bad scopes
  it('2. strictly rejects duplicate rule IDs and invalid schema combinations', () => {
    const duplicateIdMarkdown = `
# Tutorial
\`\`\`yaml active-rules
schemaVersion: "1.0"
rules:
  - id: "dup_rule"
    description: "First instance"
    enabled: true
    action: "replace"
    scope: "all_literal_occurrences"
    matchLiteral: "a"
    replacementLiteral: "b"
  - id: "dup_rule"
    description: "Second instance with duplicate ID"
    enabled: true
    action: "replace"
    scope: "all_literal_occurrences"
    matchLiteral: "c"
    replacementLiteral: "d"
\`\`\`
`;
    const res = parseAndValidateOcrRules(duplicateIdMarkdown);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('Duplicate rule id detected');
    }

    // Invalid replacement scope
    const badScopeMarkdown = `
\`\`\`yaml
schemaVersion: "1.0"
rules:
  - id: "bad_scope"
    description: "Invalid scope for replace"
    enabled: true
    action: "replace"
    scope: "whole_line_prefix"
    matchLiteral: "foo"
    replacementLiteral: "bar"
\`\`\`
`;
    const resBadScope = parseAndValidateOcrRules(badScopeMarkdown);
    expect(resBadScope.ok).toBe(false);
    if (!resBadScope.ok) {
      expect(resBadScope.error).toContain('Replacement rules must use scope');
    }
  });

  // Test 3: Rejects files with missing active block or multiple active YAML blocks
  it('3. rejects markdown with missing or multiple active YAML blocks', () => {
    const missingBlock = '# Just a markdown file without yaml block';
    const resMissing = extractActiveYamlBlock(missingBlock);
    expect(resMissing.error).toContain('No active YAML configuration block found');

    const multipleBlocks = `
\`\`\`yaml
schemaVersion: "1.0"
\`\`\`

\`\`\`yaml
schemaVersion: "1.0"
\`\`\`
`;
    const resMultiple = extractActiveYamlBlock(multipleBlocks);
    expect(resMultiple.error).toContain('Found 2 active YAML configuration blocks');

    // Tutorial example with yaml-example should NOT count as active block
    const tutorialExample = `
\`\`\`yaml-example
schemaVersion: "1.0"
\`\`\`

\`\`\`yaml active-rules
schemaVersion: "1.0"
rules: []
\`\`\`
`;
    const resTutorial = extractActiveYamlBlock(tutorialExample);
    expect(resTutorial.error).toBeUndefined();
    expect(resTutorial.yamlText).toContain('schemaVersion: "1.0"');
  });

  // Test 4: Disabling rules (enabled: false) successfully disables their effect
  it('4. honors enabled: false to bypass individual rules', () => {
    const customConfig: OcrRulesConfig = {
      schemaVersion: '1.0',
      builtInProcessors: DEFAULT_OCR_RULES_CONFIG.builtInProcessors,
      rules: [
        {
          id: 'test_replace_hello',
          description: 'Replace hello with hi',
          enabled: false, // DISABLED
          action: 'replace',
          scope: 'all_literal_occurrences',
          matchLiteral: 'hello',
          replacementLiteral: 'hi',
        },
      ],
    };

    const text = 'hello world';
    const output = normalizeOcrFormat(text, customConfig);
    // Because it is disabled, 'hello' remains 'hello'
    expect(output).toBe('hello world');

    // Now enable it
    customConfig.rules[0].enabled = true;
    const outputEnabled = normalizeOcrFormat(text, customConfig);
    expect(outputEnabled).toBe('hi world');
  });

  // Test 5: Whitespace variations in LaTeX wrappers and ordinals (Prompt Required Example)
  it('5. normalizes required prompt example with whitespace variations without spelling correction', () => {
    const input = '\\[\n12^{\\text {th }} \\text { Octoher, } 2026\n\\]';
    const normalized = normalizeOcrFormat(input);

    expect(normalized).toContain('12th Octoher, 2026');
    // Must NOT correct Octoher to October
    expect(normalized).toContain('Octoher');
    expect(normalized).not.toContain('October');

    // Line boundary preservation: wrapper-only lines become empty lines
    const lines = normalized.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0].trim()).toBe('');
    expect(lines[1].trim()).toBe('12th Octoher, 2026');
    expect(lines[2].trim()).toBe('');

    // Strictly idempotent
    expect(normalizeOcrFormat(normalized)).toBe(normalized);
  });

  // Test 6: Escaped underscore \_ -> _ replacement
  it('6. replaces LaTeX escaped underscore \\_ with plain underscore _', () => {
    const input = 'My\\_essay\\_title with \\_\\_ blanks.';
    const normalized = normalizeOcrFormat(input);
    expect(normalized).toBe('My_essay_title with __ blanks.');
  });

  // Test 7: Prepopulated table-format detection (user observed examples)
  it('7. detects complete tabular blocks, incomplete blocks, \\hline, \\multicolumn, and residual separators', () => {
    const tableSnippet = `\\begin{tabular}[t]{|l|l|}
\\hline Content & Language \\\\
\\hline
\\end{tabular}
\\\\
& \\multicolumn{2}{|r|}{`;

    const { normalizedText, notices } = normalizeOcrTranscript(tableSnippet);

    // 1. Table contents and tokens must NOT be deleted
    expect(normalizedText).toContain('Content & Language');
    expect(normalizedText).toContain('\\begin{tabular}');
    expect(normalizedText).toContain('\\multicolumn');

    // 2. Complete tabular block is flagged
    const completeTableNotice = notices.find(
      (n) => n.message.includes('complete LaTeX tabular block')
    );
    expect(completeTableNotice).toBeDefined();

    // 3. No duplicate notices for \\hline or \\\\ INSIDE the complete tabular block
    const hlineNotices = notices.filter((n) => n.matchedText === '\\hline');
    expect(hlineNotices).toHaveLength(0); // Suppressed duplicate because covered by table block notice

    // 4. Residual \\ and & \\multicolumn OUTSIDE the block are flagged
    const residualRowBreak = notices.find(
      (n) => n.message.includes('Residual LaTeX row break') || n.matchedText === '\\\\'
    );
    expect(residualRowBreak).toBeDefined();

    const residualMulticolumn = notices.find(
      (n) => n.message.includes('multicolumn')
    );
    expect(residualMulticolumn).toBeDefined();
  });

  // Test 8: Prepopulated school year headers are review-only exact line matches
  it('8. flags school year headers as review-only without matching ordinary sentences or deleting them', () => {
    const input = `2026-2027\n2026–2027\nIn 2026-2027 we learned English.`;
    const { normalizedText, notices } = normalizeOcrTranscript(input);

    // Kept in transcript (not deleted)
    expect(normalizedText).toContain('2026-2027');
    expect(normalizedText).toContain('2026–2027');

    const yearNotices = notices.filter(
      (n) => n.matchedText === '2026-2027' || n.matchedText === '2026–2027'
    );
    // Lines 1 and 2 matched
    expect(yearNotices).toHaveLength(2);

    // Line 3 ("In 2026-2027 we learned English.") must NOT match exact whole line
    const proseNotice = notices.find((n) => n.sourceContext?.includes('we learned English'));
    expect(proseNotice).toBeUndefined();
  });

  // Test 9: Currency $20 / $15.50 and ordinary & are preserved and not flagged
  it('9. preserves legitimate currency and ordinary & without flagging', () => {
    const input = 'Lunch cost $20. Dinner cost $15.50. We ordered Fish & Chips.';
    const { normalizedText, notices } = normalizeOcrTranscript(input);

    expect(normalizedText).toBe('Lunch cost $20. Dinner cost $15.50. We ordered Fish & Chips.');
    const syntaxNotices = notices.filter((n) => n.type === 'suspicious_syntax');
    expect(syntaxNotices).toHaveLength(0);
  });

  // Test 10: Standalone X/x vs x inside normal words (Next, six, excited, fox)
  it('10. flags standalone X on own line and isolated X in prose, but never x in normal words', () => {
    const input = `X\nNext week, six excited foxes ran.\nI walked . X We arrived.`;
    const { notices } = normalizeOcrTranscript(input);

    const skipNotices = notices.filter((n) => n.type === 'skip_line_marker');
    expect(skipNotices).toHaveLength(2);
    expect(skipNotices[0].message).toContain('standalone line');
    expect(skipNotices[1].message).toContain('Isolated');

    // No notice for line 2
    const normalWordNotice = notices.find((n) => n.lineNumber === 2);
    expect(normalWordNotice).toBeUndefined();
  });

  // Test 11: Immutable per-action snapshot caching
  it('11. provides immutable per-action snapshots and allows forced reload', async () => {
    const firstRes = await loadOcrRulesSnapshot();
    expect(firstRes.ok).toBe(true);
    if (!firstRes.ok) return;

    const secondRes = await loadOcrRulesSnapshot();
    expect(secondRes.ok).toBe(true);
    if (!secondRes.ok) return;

    // Both calls return the exact same cached object reference
    expect(secondRes.snapshot).toBe(firstRes.snapshot);

    // Forced fresh reload produces a new snapshot
    const thirdRes = await loadOcrRulesSnapshot(true);
    expect(thirdRes.ok).toBe(true);
    if (!thirdRes.ok) return;
    expect(thirdRes.snapshot.hash).toBe(firstRes.snapshot.hash);
  });

  // Test 12: Invalid configuration blocks execution cleanly
  it('12. fails gracefully and blocks OCR without throwing unhandled exceptions', () => {
    const invalidYamlMarkdown = `
\`\`\`yaml
schemaVersion: "" # invalid empty version
rules: []
\`\`\`
`;
    const parsed = parseAndValidateOcrRules(invalidYamlMarkdown);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain('schemaVersion is required');
    }
  });
});
