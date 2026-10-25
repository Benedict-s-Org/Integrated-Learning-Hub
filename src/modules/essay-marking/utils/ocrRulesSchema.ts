import { z } from 'zod';
import YAML from 'yaml';

/**
 * Scope for text replacement rules:
 * - 'all_literal_occurrences': replaces all occurrences of matchLiteral with replacementLiteral in the document.
 * - 'whole_line_exact': replaces lines whose trimmed content strictly equals matchLiteral.
 */
export const ReplacementScopeSchema = z.enum([
  'all_literal_occurrences',
  'whole_line_exact',
]);

/**
 * Scope for review notice rules:
 * - 'whole_line_exact': flags lines whose trimmed content strictly equals matchLiteral.
 * - 'whole_line_prefix': flags lines whose trimmed content starts with matchLiteral.
 * - 'literal_sequence': flags any line containing the substring matchLiteral.
 * - 'delimited_block': flags a multi-line block from startMarker to endMarker.
 */
export const NoticeScopeSchema = z.enum([
  'whole_line_exact',
  'whole_line_prefix',
  'literal_sequence',
  'delimited_block',
]);

export const NoticeTypeSchema = z.enum([
  'worksheet_boilerplate',
  'suspicious_syntax',
  'skip_line_marker',
]);

/**
 * Schema for an individual user rule.
 */
export const OcrRuleItemSchema = z
  .object({
    id: z
      .string()
      .min(1, 'Rule id must not be empty')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Rule id must contain only letters, numbers, underscores, and hyphens'),
    description: z.string().min(1, 'Rule description must not be empty'),
    enabled: z.boolean(),
    action: z.enum(['replace', 'review_notice']),
    scope: z.enum([
      'all_literal_occurrences',
      'whole_line_exact',
      'whole_line_prefix',
      'literal_sequence',
      'delimited_block',
    ]),
    noticeType: NoticeTypeSchema.optional(),
    message: z.string().optional(),
    matchLiteral: z.string().optional(),
    replacementLiteral: z.string().optional(),
    startMarker: z.string().optional(),
    endMarker: z.string().optional(),
    requireClosed: z.boolean().optional(),
    caseSensitive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'replace') {
      if (
        data.scope !== 'all_literal_occurrences' &&
        data.scope !== 'whole_line_exact'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Replacement rules must use scope 'all_literal_occurrences' or 'whole_line_exact', got '${data.scope}'`,
          path: ['scope'],
        });
      }
      if (typeof data.matchLiteral !== 'string' || data.matchLiteral.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Replacement rules require a non-empty matchLiteral',
          path: ['matchLiteral'],
        });
      }
      if (typeof data.replacementLiteral !== 'string') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Replacement rules require replacementLiteral (use empty string to delete)',
          path: ['replacementLiteral'],
        });
      }
    } else if (data.action === 'review_notice') {
      if (!data.noticeType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Review notice rules require noticeType (worksheet_boilerplate, suspicious_syntax, or skip_line_marker)',
          path: ['noticeType'],
        });
      }
      if (!data.message || data.message.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Review notice rules require a descriptive user-facing message',
          path: ['message'],
        });
      }

      if (data.scope === 'delimited_block') {
        if (!data.startMarker || data.startMarker.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Delimited block rules require startMarker",
            path: ['startMarker'],
          });
        }
        if (!data.endMarker || data.endMarker.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Delimited block rules require endMarker",
            path: ['endMarker'],
          });
        }
      } else {
        if (typeof data.matchLiteral !== 'string' || data.matchLiteral.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Review notice rules with scope '${data.scope}' require matchLiteral`,
            path: ['matchLiteral'],
          });
        }
      }
    }
  });

export type OcrRuleItem = z.infer<typeof OcrRuleItemSchema>;

/**
 * Built-in structural processors configuration.
 */
export const BuiltInProcessorsConfigSchema = z.object({
  latexWrappers: z
    .object({
      enabled: z.boolean(),
      displayWrappers: z.array(z.string()).default(['\\[', '\\]', '\\(', '\\)']),
      styleCommands: z
        .array(z.string())
        .default([
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
        ]),
    })
    .default({
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
    }),
  ordinalSuperscripts: z
    .object({
      enabled: z.boolean(),
      suffixes: z.array(z.string()).default(['st', 'nd', 'rd', 'th']),
    })
    .default({
      enabled: true,
      suffixes: ['st', 'nd', 'rd', 'th'],
    }),
  standaloneX: z
    .object({
      enabled: z.boolean(),
      flagStandaloneLine: z.boolean().default(true),
      flagIsolatedInProse: z.boolean().default(true),
    })
    .default({
      enabled: true,
      flagStandaloneLine: true,
      flagIsolatedInProse: true,
    }),
  tableDetection: z
    .object({
      enabled: z.boolean(),
      flagCompleteTabularBlocks: z.boolean().default(true),
      flagIncompleteTabularBlocks: z.boolean().default(true),
      flagResidualCommands: z.boolean().default(true),
      flagTableSeparators: z.boolean().default(true),
    })
    .default({
      enabled: true,
      flagCompleteTabularBlocks: true,
      flagIncompleteTabularBlocks: true,
      flagResidualCommands: true,
      flagTableSeparators: true,
    }),
  pageNumberLabels: z
    .object({
      enabled: z.boolean(),
      pattern: z.string().default('^P\\.?\\s*\\d+$'),
    })
    .default({
      enabled: true,
      pattern: '^P\\.?\\s*\\d+$',
    }),
});

export type BuiltInProcessorsConfig = z.infer<typeof BuiltInProcessorsConfigSchema>;

/**
 * Complete machine-readable configuration schema.
 */
export const OcrRulesConfigSchema = z
  .object({
    schemaVersion: z.string().min(1, 'schemaVersion is required'),
    description: z.string().optional(),
    builtInProcessors: BuiltInProcessorsConfigSchema.default({}),
    rules: z.array(OcrRuleItemSchema).default([]),
  })
  .superRefine((data, ctx) => {
    // Validate uniqueness of rule IDs
    const seenIds = new Set<string>();
    data.rules.forEach((rule, idx) => {
      if (seenIds.has(rule.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate rule id detected: '${rule.id}'. Rule IDs must be globally unique.`,
          path: ['rules', idx, 'id'],
        });
      }
      seenIds.add(rule.id);
    });
  });

export type OcrRulesConfig = z.infer<typeof OcrRulesConfigSchema>;

/**
 * Deterministic string hash (FNV-1a 32-bit).
 */
export function computeRulesHash(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Extracts exactly one active YAML block from markdown.
 * Blocks labeled with 'yaml-example' or other tags are ignored as documentation.
 * Fails if 0 or >1 active YAML blocks are found.
 */
export function extractActiveYamlBlock(markdown: string): {
  yamlText?: string;
  error?: string;
} {
  if (!markdown || !markdown.trim()) {
    return { error: 'Rules Markdown file is empty.' };
  }

  // Regex to match code fences.
  // We match fences that explicitly begin with ```yaml (optionally followed by whitespace or 'active-rules')
  // We specifically exclude ```yaml-example, ```yaml-tutorial, etc.
  const fenceRegex = /```yaml(?:[ \t]+active[a-zA-Z0-9_-]*)?[ \t]*\r?\n([\s\S]*?)\r?\n```/g;

  const matches: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = fenceRegex.exec(markdown)) !== null) {
    matches.push(m[1]);
  }

  if (matches.length === 0) {
    return {
      error:
        'No active YAML configuration block found. The file must contain exactly one ```yaml ... ``` block with schemaVersion.',
    };
  }

  if (matches.length > 1) {
    return {
      error: `Found ${matches.length} active YAML configuration blocks. Exactly one active YAML block is permitted. Tutorial examples must use \`\`\`yaml-example instead.`,
    };
  }

  return { yamlText: matches[0] };
}

/**
 * Parses and strictly validates OCR rules configuration from Markdown text.
 */
export function parseAndValidateOcrRules(markdown: string):
  | { ok: true; config: OcrRulesConfig; hash: string; rawYaml: string }
  | { ok: false; error: string } {
  const extracted = extractActiveYamlBlock(markdown);
  if (!extracted.yamlText || extracted.error) {
    return { ok: false, error: extracted.error || 'Failed to extract YAML block.' };
  }

  const rawYaml = extracted.yamlText;
  let parsedObject: unknown;

  try {
    parsedObject = YAML.parse(rawYaml, { prettyErrors: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `YAML syntax error in active configuration block: ${msg}`,
    };
  }

  const validation = OcrRulesConfigSchema.safeParse(parsedObject);
  if (!validation.success) {
    const formattedErrors = validation.error.issues
      .map((iss) => `[${iss.path.join('.') || 'root'}] ${iss.message}`)
      .join('; ');
    return {
      ok: false,
      error: `OCR rules schema validation failed: ${formattedErrors}`,
    };
  }

  const hash = computeRulesHash(rawYaml);

  return {
    ok: true,
    config: validation.data,
    hash,
    rawYaml,
  };
}
