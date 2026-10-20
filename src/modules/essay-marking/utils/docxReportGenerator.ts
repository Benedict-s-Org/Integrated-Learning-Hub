import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  TableBorders,
  HeadingLevel,
  BorderStyle,
  AlignmentType,
} from 'docx';
import { MarkingFinding, RubricDimension } from '../types';
import {
  buildTranscriptParagraphStructure,
  resolveFindingLocation,
} from './markingTextAlignment';
import { generateSafeMarkdownFilename } from './markdownReportGenerator';

export interface DocxReportOptions {
  assignmentTitle?: string;
  classId?: string;
  studentNumber?: number;
  studentName?: string;
  isApproved?: boolean;
  totalScore: number;
  maxPossibleScore: number;
  rubric: RubricDimension[];
  scores: Record<string, number>;
  feedbackComment?: string;
  transcriptText?: string;
  findings?: MarkingFinding[];
}

export interface WritingWordSegment {
  type: 'text' | 'correction' | 'insertion' | 'deletion';
  original: string;
  replacement: string;
  finding?: MarkingFinding;
}

// Color palette matching requirements
export const DOCX_COLORS = {
  ERROR: 'DC2626', // Red strikethrough for original error
  CORRECTION: '16A34A', // Green for required correction
  CLARITY: '0284C7', // Blue for clarity/coherence sentence revision
  IMPROVEMENT: '7C3AED', // Purple for optional sentence improvement
  BLACK: '000000', // Normal original student text
  SLATE_HEADER: '1E293B',
  MUTED_TEXT: '64748B',
  BORDER_LIGHT: 'E2E8F0',
  BG_HEADER: 'F8FAFC',
};

// Layout constants for A4 Portrait with 1-inch margins (1440 DXA)
export const TOTAL_PAGE_WIDTH_DXA = 9020;
export const CHAR_WIDTH_DXA = 115; // Average character advance for 11pt font

/**
 * Generates a safe, cross-platform filename for the exported DOCX report,
 * preserving UTF-8 student names and replacing unsafe OS characters.
 */
export function generateSafeDocxFilename(
  assignmentTitle?: string,
  classId?: string,
  classNumber?: number,
  studentName?: string
): string {
  const mdName = generateSafeMarkdownFilename(assignmentTitle, classId, classNumber, studentName);
  return mdName.replace(/\.md$/, '.docx');
}

/**
 * Prepares annotated writing elements for the DOCX document.
 * Each student transcript line is represented as an atomic unit table with cantSplit: true.
 */
export function buildAnnotatedWritingSection(
  transcriptText: string,
  findings: MarkingFinding[]
): { elements: (Table | Paragraph)[]; unresolvedFindings: MarkingFinding[] } {
  if (!transcriptText) {
    return {
      elements: [
        new Paragraph({
          children: [
            new TextRun({
              text: 'No student transcript available.',
              italics: true,
              color: DOCX_COLORS.MUTED_TEXT,
            }),
          ],
        }),
      ],
      unresolvedFindings: [],
    };
  }

  const rawLines = transcriptText.replace(/\r\n/g, '\n').split('\n');
  const structure = buildTranscriptParagraphStructure(rawLines);

  const usedSpansByLine = new Map<number, Array<{ start: number; end: number }>>();
  const wordCorrectionsByLine = new Map<
    number,
    Array<{
      finding: MarkingFinding;
      startIndex: number;
      endIndex: number;
      isInsertion: boolean;
    }>
  >();
  const sentenceSuggestionsByLine = new Map<number, MarkingFinding[]>();
  const unresolvedFindings: MarkingFinding[] = [];

  // Filter out rejected and needs_review findings from active annotations
  const activeFindings = (findings || []).filter(
    (f) => f.decision !== 'rejected' && f.decision !== 'needs_review'
  );

  for (const finding of activeFindings) {
    const feedbackType = finding.feedbackType || 'correction';

    // 1. Sentence-level suggestions (clarity / improvement)
    if (feedbackType === 'clarity' || feedbackType === 'improvement') {
      let lineIdx: number | null = null;
      if (typeof finding.lineIndex === 'number' && rawLines[finding.lineIndex] !== undefined) {
        lineIdx = finding.lineIndex;
      } else if (finding.originalText) {
        const loc = resolveFindingLocation(finding, rawLines, structure, usedSpansByLine);
        if (loc) lineIdx = loc.rawLineIndex;
      }

      if (lineIdx !== null) {
        const list = sentenceSuggestionsByLine.get(lineIdx) || [];
        list.push(finding);
        sentenceSuggestionsByLine.set(lineIdx, list);
      } else {
        unresolvedFindings.push(finding);
      }
      continue;
    }

    // 2. Required word-level corrections (only accepted or edited)
    if (finding.decision !== 'accepted' && finding.decision !== 'edited') {
      continue;
    }

    const isInsertion =
      !finding.originalText ||
      finding.originalText.trim() === '' ||
      finding.originalText.trim().toUpperCase() === 'EMPTY';

    if (isInsertion) {
      if (typeof finding.lineIndex === 'number' && rawLines[finding.lineIndex] !== undefined) {
        const lineIdx = finding.lineIndex;
        const lineText = rawLines[lineIdx];
        const explicitStart = (finding as any).startIndex;
        const start = Math.min(
          typeof explicitStart === 'number' ? explicitStart : lineText.length,
          lineText.length
        );
        const list = wordCorrectionsByLine.get(lineIdx) || [];
        list.push({ finding, startIndex: start, endIndex: start, isInsertion: true });
        wordCorrectionsByLine.set(lineIdx, list);
      } else {
        unresolvedFindings.push(finding);
      }
      continue;
    }

    // Teacher-edited explicit range check
    const explicitStart = (finding as any).startIndex;
    const explicitEnd = (finding as any).endIndex;
    if (
      typeof explicitStart === 'number' &&
      typeof explicitEnd === 'number' &&
      typeof finding.lineIndex === 'number' &&
      rawLines[finding.lineIndex] !== undefined &&
      explicitStart <= explicitEnd &&
      explicitEnd <= rawLines[finding.lineIndex].length
    ) {
      const lineIdx = finding.lineIndex;
      const spans = usedSpansByLine.get(lineIdx) || [];
      const overlaps = spans.some((s) => explicitStart < s.end && explicitEnd > s.start);
      if (!overlaps) {
        const list = wordCorrectionsByLine.get(lineIdx) || [];
        list.push({
          finding,
          startIndex: explicitStart,
          endIndex: explicitEnd,
          isInsertion: false,
        });
        wordCorrectionsByLine.set(lineIdx, list);
        spans.push({ start: explicitStart, end: explicitEnd });
        usedSpansByLine.set(lineIdx, spans);
        continue;
      }
    }

    // Standard location resolution
    const loc = resolveFindingLocation(finding, rawLines, structure, usedSpansByLine);
    if (loc) {
      const list = wordCorrectionsByLine.get(loc.rawLineIndex) || [];
      list.push({
        finding,
        startIndex: loc.startIndex,
        endIndex: loc.endIndex,
        isInsertion: false,
      });
      wordCorrectionsByLine.set(loc.rawLineIndex, list);

      const spans = usedSpansByLine.get(loc.rawLineIndex) || [];
      spans.push({ start: loc.startIndex, end: loc.endIndex });
      usedSpansByLine.set(loc.rawLineIndex, spans);
    } else {
      unresolvedFindings.push(finding);
    }
  }

  // Build document elements for each transcript line
  const elements: (Table | Paragraph)[] = [];

  rawLines.forEach((lineText, lineIdx) => {
    // Preserve blank lines (paragraphs / section breaks)
    if (lineText.trim() === '') {
      elements.push(
        new Paragraph({
          spacing: { after: 180 },
          children: [],
        })
      );
      return;
    }

    const suggestions = sentenceSuggestionsByLine.get(lineIdx) || [];
    const corrections = (wordCorrectionsByLine.get(lineIdx) || []).sort(
      (a, b) => a.startIndex - b.startIndex
    );

    // Build word segments
    const segments: WritingWordSegment[] = [];
    let cursor = 0;

    for (const item of corrections) {
      // Overlap protection: keep original text intact and push to unresolved
      if (item.startIndex < cursor && !item.isInsertion) {
        unresolvedFindings.push(item.finding);
        continue;
      }

      if (item.startIndex > cursor) {
        segments.push({
          type: 'text',
          original: lineText.slice(cursor, item.startIndex),
          replacement: '',
        });
      }

      const replRaw = item.finding.teacherCustomText || item.finding.replacementText || '';
      const cleanRepl = replRaw.trim();
      const isDeletion =
        !cleanRepl || cleanRepl.toLowerCase() === '(delete)' || cleanRepl.toUpperCase() === 'EMPTY';

      if (item.isInsertion) {
        segments.push({
          type: 'insertion',
          original: '^',
          replacement: cleanRepl,
          finding: item.finding,
        });
        cursor = item.startIndex;
      } else if (isDeletion) {
        segments.push({
          type: 'deletion',
          original: lineText.slice(item.startIndex, item.endIndex),
          replacement: '',
          finding: item.finding,
        });
        cursor = item.endIndex;
      } else {
        segments.push({
          type: 'correction',
          original: lineText.slice(item.startIndex, item.endIndex),
          replacement: cleanRepl,
          finding: item.finding,
        });
        cursor = item.endIndex;
      }
    }

    if (cursor < lineText.length) {
      segments.push({
        type: 'text',
        original: lineText.slice(cursor),
        replacement: '',
      });
    }

    const hasCorrections = segments.some((s) => s.type !== 'text');
    let colWidths: number[] = [];
    let totalCols = 1;

    if (hasCorrections && segments.length > 0) {
      let allocated = 0;
      colWidths = segments.map((seg) => {
        const topLen = seg.replacement.length;
        const bottomLen = seg.original.length;
        const maxLen = Math.max(topLen, bottomLen);
        const w = Math.max(maxLen * CHAR_WIDTH_DXA + 80, 160);
        allocated += w;
        return w;
      });

      if (allocated < TOTAL_PAGE_WIDTH_DXA - 200) {
        const remainder = TOTAL_PAGE_WIDTH_DXA - allocated;
        colWidths.push(remainder);
      } else {
        // Proportionally scale to fit page width
        const scale = (TOTAL_PAGE_WIDTH_DXA - 100) / allocated;
        colWidths = colWidths.map((w) => Math.max(Math.floor(w * scale), 140));
      }
      totalCols = colWidths.length;
    } else {
      totalCols = 1;
      colWidths = [TOTAL_PAGE_WIDTH_DXA];
    }

    const tableRows: TableRow[] = [];

    // 1. Sentence-level suggestions (Clarity: Blue, Improvement: Purple)
    for (const sugg of suggestions) {
      const isClarity = sugg.feedbackType === 'clarity';
      const color = isClarity ? DOCX_COLORS.CLARITY : DOCX_COLORS.IMPROVEMENT;
      let text = sugg.teacherCustomText || sugg.replacementText || sugg.explanation || '';
      text = text.trim();
      if (!text.startsWith('(') || !text.endsWith(')')) {
        text = `(${text})`;
      }

      tableRows.push(
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              columnSpan: totalCols,
              margins: { top: 40, bottom: 20, left: 10, right: 10 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text,
                      color,
                      italics: true,
                      size: 20, // 10pt
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
    }

    // 2. Word-level correction row & student line row
    if (hasCorrections) {
      // Row A: Annotation row above
      const topCells = segments.map((seg, i) => {
        const runs: TextRun[] = [];
        if (seg.type === 'correction' || seg.type === 'insertion') {
          runs.push(
            new TextRun({
              text: seg.replacement,
              color: DOCX_COLORS.CORRECTION,
              bold: true,
              size: 20, // 10pt
            })
          );
        }
        return new TableCell({
          width: { size: colWidths[i], type: WidthType.DXA },
          margins: { top: 20, bottom: 10, left: 10, right: 10 },
          children: [new Paragraph({ children: runs })],
        });
      });

      if (colWidths.length > segments.length) {
        topCells.push(
          new TableCell({
            width: { size: colWidths[colWidths.length - 1], type: WidthType.DXA },
            margins: { top: 20, bottom: 10, left: 10, right: 10 },
            children: [new Paragraph({ children: [] })],
          })
        );
      }

      tableRows.push(new TableRow({ cantSplit: true, children: topCells }));

      // Row B: Original student line baseline
      const bottomCells = segments.map((seg, i) => {
        const runs: TextRun[] = [];
        if (seg.type === 'text') {
          runs.push(
            new TextRun({
              text: seg.original,
              color: DOCX_COLORS.BLACK,
              size: 22, // 11pt
            })
          );
        } else if (seg.type === 'correction' || seg.type === 'deletion') {
          runs.push(
            new TextRun({
              text: seg.original,
              color: DOCX_COLORS.ERROR,
              strike: true,
              size: 22, // 11pt
            })
          );
        } else if (seg.type === 'insertion') {
          runs.push(
            new TextRun({
              text: '^',
              color: DOCX_COLORS.CORRECTION,
              bold: true,
              size: 22, // 11pt
            })
          );
        }

        return new TableCell({
          width: { size: colWidths[i], type: WidthType.DXA },
          margins: { top: 10, bottom: 40, left: 10, right: 10 },
          children: [new Paragraph({ children: runs })],
        });
      });

      if (colWidths.length > segments.length) {
        bottomCells.push(
          new TableCell({
            width: { size: colWidths[colWidths.length - 1], type: WidthType.DXA },
            margins: { top: 10, bottom: 40, left: 10, right: 10 },
            children: [new Paragraph({ children: [] })],
          })
        );
      }

      tableRows.push(new TableRow({ cantSplit: true, children: bottomCells }));
    } else {
      // Line with NO word corrections
      // If there are no sentence suggestions either, leave a dedicated blank annotation row above
      if (suggestions.length === 0) {
        tableRows.push(
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                columnSpan: 1,
                margins: { top: 20, bottom: 10, left: 10, right: 10 },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: ' ', size: 20 })],
                  }),
                ],
              }),
            ],
          })
        );
      }

      // Original student line
      tableRows.push(
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              columnSpan: 1,
              margins: { top: 10, bottom: 40, left: 10, right: 10 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: lineText,
                      color: DOCX_COLORS.BLACK,
                      size: 22,
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
    }

    elements.push(
      new Table({
        width: { size: TOTAL_PAGE_WIDTH_DXA, type: WidthType.DXA },
        borders: TableBorders.NONE,
        rows: tableRows,
      })
    );

    // Spacing between line blocks
    elements.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [],
      })
    );
  });

  return { elements, unresolvedFindings };
}

/**
 * Builds the complete, formatted Document object representing the student's writing report.
 */
export function buildStudentDocxDocument(options: DocxReportOptions): Document {
  const {
    assignmentTitle = 'Writing Assessment',
    classId = '',
    studentNumber,
    studentName = 'Student',
    isApproved = false,
    totalScore = 0,
    maxPossibleScore = 100,
    rubric = [],
    scores = {},
    feedbackComment = '',
    transcriptText = '',
    findings = [],
  } = options;

  const { elements: writingElements, unresolvedFindings } = buildAnnotatedWritingSection(
    transcriptText,
    findings
  );

  // Metadata block table
  const metaRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 4500, type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Assignment: ', bold: true, size: 20 }),
                new TextRun({ text: assignmentTitle, size: 20 }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Class: ', bold: true, size: 20 }),
                new TextRun({
                  text: classId
                    ? `${classId}${
                        studentNumber ? ` · No. ${String(studentNumber).padStart(2, '0')}` : ''
                      }`
                    : 'N/A',
                  size: 20,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 4520, type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Student: ', bold: true, size: 20 }),
                new TextRun({ text: studentName, size: 20 }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Evaluation Status: ', bold: true, size: 20 }),
                new TextRun({
                  text: isApproved ? 'Teacher Approved' : 'Draft / Unapproved',
                  color: isApproved ? '15803D' : 'B45309',
                  bold: true,
                  size: 20,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Overall Score: ', bold: true, size: 20 }),
                new TextRun({
                  text: `${totalScore} / ${maxPossibleScore}`,
                  bold: true,
                  color: '15803D',
                  size: 22,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  const metaTable = new Table({
    width: { size: TOTAL_PAGE_WIDTH_DXA, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
      left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    },
    rows: metaRows,
  });

  // Rubric Dimension Breakdown Table
  let rubricSection: (Paragraph | Table)[] = [];
  if (rubric.length > 0) {
    const headerRow = new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 2600, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          shading: { fill: DOCX_COLORS.BG_HEADER },
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Dimension', bold: true, size: 19 })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 1600, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          shading: { fill: DOCX_COLORS.BG_HEADER },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: 'Score', bold: true, size: 19 })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 4820, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          shading: { fill: DOCX_COLORS.BG_HEADER },
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Criteria / Description', bold: true, size: 19 })],
            }),
          ],
        }),
      ],
    });

    const dataRows = rubric.map((dim) => {
      const dimScore = scores[dim.id] ?? 0;
      return new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 2600, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: dim.name, bold: true, size: 19 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1600, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${dimScore} / ${dim.maxScore}`,
                    bold: true,
                    size: 19,
                    color: '15803D',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 4820, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: dim.description || 'Assessed based on curriculum standards.',
                    size: 19,
                    color: DOCX_COLORS.MUTED_TEXT,
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    });

    const rubricTable = new Table({
      width: { size: TOTAL_PAGE_WIDTH_DXA, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
        left: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
        right: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
      },
      rows: [headerRow, ...dataRows],
    });

    rubricSection = [
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 100 },
        children: [
          new TextRun({
            text: 'Rubric Dimension Breakdown',
            bold: true,
            size: 24,
            color: DOCX_COLORS.SLATE_HEADER,
          }),
        ],
      }),
      rubricTable,
    ];
  }

  // Teacher feedback comment box
  let commentSection: (Paragraph | Table)[] = [];
  if (feedbackComment && feedbackComment.trim()) {
    const commentTable = new Table({
      width: { size: TOTAL_PAGE_WIDTH_DXA, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
        left: { style: BorderStyle.SINGLE, size: 8, color: '3B82F6' }, // Blue accent left bar
        right: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              shading: { fill: DOCX_COLORS.BG_HEADER },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: feedbackComment.trim(),
                      size: 20,
                      italics: true,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    commentSection = [
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 100 },
        children: [
          new TextRun({
            text: 'Teacher Feedback',
            bold: true,
            size: 24,
            color: DOCX_COLORS.SLATE_HEADER,
          }),
        ],
      }),
      commentTable,
    ];
  }

  // Short Marking Legend Box
  const legendTable = new Table({
    width: { size: TOTAL_PAGE_WIDTH_DXA, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
      left: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
      right: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.BORDER_LIGHT },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            shading: { fill: DOCX_COLORS.BG_HEADER },
            children: [
              new Paragraph({
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: 'Marking Legend & Visual Formatting:',
                    bold: true,
                    size: 19,
                    color: DOCX_COLORS.SLATE_HEADER,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 30 },
                children: [
                  new TextRun({ text: '• ', bold: true, size: 19 }),
                  new TextRun({
                    text: 'Red strikethrough',
                    color: DOCX_COLORS.ERROR,
                    strike: true,
                    size: 19,
                  }),
                  new TextRun({ text: ': Original student error        ', size: 19 }),
                  new TextRun({ text: '• ', bold: true, size: 19 }),
                  new TextRun({
                    text: 'Green bold text',
                    color: DOCX_COLORS.CORRECTION,
                    bold: true,
                    size: 19,
                  }),
                  new TextRun({ text: ': Required correction above error', size: 19 }),
                ],
              }),
              new Paragraph({
                spacing: { after: 30 },
                children: [
                  new TextRun({ text: '• ', bold: true, size: 19 }),
                  new TextRun({
                    text: '(Blue in parentheses)',
                    color: DOCX_COLORS.CLARITY,
                    italics: true,
                    size: 19,
                  }),
                  new TextRun({ text: ': Clarity / coherence revision    ', size: 19 }),
                  new TextRun({ text: '• ', bold: true, size: 19 }),
                  new TextRun({
                    text: '(Purple in parentheses)',
                    color: DOCX_COLORS.IMPROVEMENT,
                    italics: true,
                    size: 19,
                  }),
                  new TextRun({ text: ': Optional sentence improvement', size: 19 }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: '• ', bold: true, size: 19 }),
                  new TextRun({
                    text: '^ (Caret)',
                    color: DOCX_COLORS.CORRECTION,
                    bold: true,
                    size: 19,
                  }),
                  new TextRun({
                    text: ': Insertion marker for missing words in original writing',
                    size: 19,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Assemble full document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 1-inch margins
          },
        },
        children: [
          // Header
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: 'LEARNING HUB — WRITING ASSESSMENT REPORT',
                bold: true,
                size: 30,
                color: DOCX_COLORS.SLATE_HEADER,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 180 },
            children: [
              new TextRun({
                text: 'Formative Writing Evaluation, Rubric Breakdown & Annotated Corrections',
                color: DOCX_COLORS.MUTED_TEXT,
                size: 20,
              }),
            ],
          }),

          // Metadata Table
          metaTable,

          // Rubric Section
          ...rubricSection,

          // Teacher Comments
          ...commentSection,

          // Legend Box
          new Paragraph({
            spacing: { before: 180, after: 100 },
            children: [],
          }),
          legendTable,

          // Annotated Writing Section
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 140 },
            children: [
              new TextRun({
                text: 'Annotated Student Writing',
                bold: true,
                size: 24,
                color: DOCX_COLORS.SLATE_HEADER,
              }),
            ],
          }),
          ...writingElements,

          // Unresolved Review Items Section (if any unanchored findings exist)
          ...(unresolvedFindings.length > 0
            ? [
                new Paragraph({
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 240, after: 100 },
                  children: [
                    new TextRun({
                      text: 'Unresolved Review Items',
                      bold: true,
                      size: 24,
                      color: 'B45309',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { after: 120 },
                  children: [
                    new TextRun({
                      text: 'The following items could not be unambiguously anchored to the transcript or conflicted with another range. The original student text has been left intact:',
                      color: DOCX_COLORS.MUTED_TEXT,
                      size: 20,
                    }),
                  ],
                }),
                ...unresolvedFindings.map(
                  (f, idx) =>
                    new Paragraph({
                      spacing: { after: 60 },
                      children: [
                        new TextRun({ text: `${idx + 1}. `, bold: true, size: 20 }),
                        new TextRun({ text: `"${f.originalText}"`, bold: true, size: 20 }),
                        new TextRun({
                          text: ` → "${f.teacherCustomText || f.replacementText || '(delete)'}" `,
                          size: 20,
                        }),
                        new TextRun({
                          text: `(${f.explanation || f.reviewReason || 'Unanchored location'})`,
                          italics: true,
                          color: DOCX_COLORS.MUTED_TEXT,
                          size: 20,
                        }),
                      ],
                    })
                ),
              ]
            : []),
        ],
      },
    ],
  });

  return doc;
}

/**
 * Generates the student report as a binary Blob suitable for browser download.
 */
export async function generateStudentDocxBlob(options: DocxReportOptions): Promise<Blob> {
  const doc = buildStudentDocxDocument(options);
  return await Packer.toBlob(doc);
}

/**
 * Triggers a client-side browser download of the generated DOCX report.
 */
export function downloadDocxFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
