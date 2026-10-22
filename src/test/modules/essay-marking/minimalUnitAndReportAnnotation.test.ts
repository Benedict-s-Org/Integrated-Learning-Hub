import { describe, it, expect } from 'vitest';
import {
  normalizeFindingToMinimalUnits,
} from '@/modules/essay-marking/utils/markingTextAlignment';
import {
  buildAnnotatedWritingHtml,
  generateStudentHtmlReport,
  generateAllStudentsHtmlReport,
} from '@/modules/essay-marking/utils/htmlReportGenerator';
import type {
  RubricDimension,
  StudentRosterItem,
  StudentTranscriptState,
  StudentMarkingState,
  AssignmentConfig,
  MarkingFinding,
} from '@/modules/essay-marking/types';

describe('Minimal Unit Finding Normalization & Report Annotation', () => {
  const sampleRubric: RubricDimension[] = [
    { id: 'content', name: 'Content', maxScore: 40 },
    { id: 'language', name: 'Language', maxScore: 40 },
    { id: 'organisation', name: 'Organisation', maxScore: 20 },
  ];

  const sampleAssignment: AssignmentConfig = {
    title: 'P.4 Wr1_Character Profile',
    grade: 'P.4',
    scopePrompt: 'Write a character profile',
    rubricMode: 'default',
    rubric: sampleRubric,
  };

  const sampleStudent: StudentRosterItem = {
    id: 'student-1',
    classNumber: 1,
    displayName: 'Tommy',
  };

  describe('Case A: "when he go home" -> only "go" -> "goes"', () => {
    it('normalizes finding from "when he go" to "go" -> "goes" and excludes correct context', () => {
      const line = 'He mess his room when he go home.';
      const rawLines = [line];

      const finding: any = {
        category: 'grammar',
        originalText: 'when he go',
        replacement: 'when he goes',
        explanation: 'Subject-verb agreement: he goes',
        lineIndex: 0,
        charStart: 17,
        charEnd: 27,
      };

      const normalized = normalizeFindingToMinimalUnits(finding, rawLines);
      expect(normalized.length).toBe(1);
      expect(normalized[0].originalText).toBe('go');
      expect(normalized[0].replacement).toBe('goes');
      expect(normalized[0].charStart).toBe(25);
      expect(normalized[0].charEnd).toBe(27);
      expect(normalized[0].occurrenceIndex).toBe(0);
    });

    it('renders HTML with only "go" in red strikethrough and green "goes" above, while "when he" and "home" are plain', () => {
      const line = 'He mess his room when he go home.';
      const findings: any[] = [
        {
          category: 'grammar',
          originalText: 'when he go',
          replacement: 'when he goes',
          explanation: 'Subject-verb agreement',
          lineIndex: 0,
          charStart: 17,
          charEnd: 27,
        },
      ];

      const { html, normalizedFindings } = buildAnnotatedWritingHtml(line, findings, 'student-1');

      // Verify normalized findings for notes
      expect(normalizedFindings[0].originalText).toBe('go');
      expect(normalizedFindings[0].replacementText).toBe('goes');

      // Verify HTML content
      expect(html).toContain('He mess his room when he ');
      expect(html).toContain('class="orig-error-text">go</del>');
      expect(html).toContain('class="corr-text">goes</rt>');
      expect(html).toContain(' home.');

      // "when he" must NOT be in error cell or strikethrough
      expect(html).not.toContain('class="orig-error-text">when he go');
    });
  });

  describe('Case B: Multiple identical words on the same line', () => {
    it('targets precisely the specified occurrence and leaves other occurrences unaffected', () => {
      const line = 'They go and go and go home.';
      const rawLines = [line];

      // Model finding flags "and go and" -> "and went and" (targeting 2nd "go")
      const finding: any = {
        category: 'tense',
        originalText: 'and go and',
        replacement: 'and went and',
        explanation: 'Past tense needed',
        lineIndex: 0,
        charStart: 7,
        charEnd: 17,
      };

      const normalized = normalizeFindingToMinimalUnits(finding, rawLines);
      expect(normalized.length).toBe(1);
      expect(normalized[0].originalText).toBe('go');
      expect(normalized[0].replacement).toBe('went');
      expect(normalized[0].charStart).toBe(12);
      expect(normalized[0].charEnd).toBe(14);
      // The second "go" on the line is at occurrenceIndex 1
      expect(normalized[0].occurrenceIndex).toBe(1);

      const { html } = buildAnnotatedWritingHtml(line, normalized, 'student-1');
      // Ensure only 1 error cell exists for 'go'
      const errorMatches = html.match(/class="orig-error-text">go<\/del>/g);
      expect(errorMatches?.length).toBe(1);
      // The replacement 'went' must be present
      expect(html).toContain('class="corr-text">went</rt>');
      // The line still has the leading "They go and " and trailing " and go home."
      expect(html).toContain('They go and ');
      expect(html).toContain(' and go home.');
    });
  });

  describe('Case C: Missing word insertion (^)', () => {
    it('inserts caret ^ without deleting adjacent correct words', () => {
      const line = 'I want play football.';
      const rawLines = [line];

      // Model returns "want play" -> "want to play"
      const finding: any = {
        category: 'grammar',
        originalText: 'want play',
        replacement: 'want to play',
        explanation: 'Infinitive "to" required',
        lineIndex: 0,
        charStart: 2,
        charEnd: 11,
      };

      const normalized = normalizeFindingToMinimalUnits(finding, rawLines);
      expect(normalized.length).toBe(1);
      // Should be an insertion
      expect(normalized[0].originalText).toBe('');
      expect(normalized[0].replacement).toBe('to');

      const { html, normalizedFindings } = buildAnnotatedWritingHtml(line, normalized, 'student-1');
      expect(normalizedFindings[0].originalText).toBe('');
      expect(normalizedFindings[0].replacementText).toBe('to');

      // In HTML: Caret symbol ^ is displayed in baseline or top row
      expect(html).toContain('^');
      expect(html).toContain('to');
      // Adjacent words "want" and "play" are fully preserved as ordinary text
      expect(html).toContain('I want');
      expect(html).toContain('play football.');
      // None of the adjacent words should have strikethrough
      expect(html).not.toContain('class="orig-error-text">want play');
    });
  });

  describe('Case D: Optional improvement & clarity suggestions', () => {
    it('preserves suggestion phrase context and renders with parentheses instead of strikethrough', () => {
      const line = 'He saw dead fishes in the pond.';
      const rawLines = [line];

      const finding: any = {
        category: 'improvement',
        originalText: 'dead fishes',
        replacement: 'dead fish',
        explanation: 'Fish is typically uncountable in this context.',
        lineIndex: 0,
        charStart: 7,
        charEnd: 18,
      };

      const normalized = normalizeFindingToMinimalUnits(finding, rawLines);
      // Improvement / clarity findings must not be blindly trimmed down
      expect(normalized.length).toBe(1);
      expect(normalized[0].originalText).toBe('dead fishes');
      expect(normalized[0].replacement).toBe('dead fish');

      const { html } = buildAnnotatedWritingHtml(line, normalized, 'student-1');
      // Original text should remain intact as clean paragraph text
      expect(html).toContain('He saw dead fishes in the pond.');
      expect(html).not.toContain('line-through');
      // Suggestions are not injected into the student text
      expect(html).not.toContain('sentence-suggestion-row');
    });
  });

  describe('Case E: Offline HTML export & alignment consistency', () => {
    it('generates offline standalone HTML report with identical findings in in-text annotation and notes list', () => {
      const studentWriting = 'He mess his room when he go home.\nHe have a small eyes too.';
      const findings: MarkingFinding[] = [
        {
          id: 'f-1',
          feedbackType: 'correction',
          type: 'Grammar',
          originalText: 'when he go',
          replacementText: 'when he goes',
          explanation: 'Subject-verb agreement: goes',
          lineIndex: 0,
          decision: 'accepted',
        },
        {
          id: 'f-2',
          feedbackType: 'correction',
          type: 'Grammar',
          originalText: 'have',
          replacementText: 'has',
          explanation: 'Singular subject requires "has"',
          lineIndex: 1,
          decision: 'accepted',
        },
      ];

      const studentTranscript: StudentTranscriptState = {
        studentId: 'student-1',
        rawOcrText: studentWriting,
        editedText: studentWriting,
        hasHandwrittenText: true,
        isVerified: true,
      };

      const studentMarking: StudentMarkingState = {
        studentId: 'student-1',
        isMarked: true,
        isApproved: true,
        totalScore: 85,
        scores: { content: 35, language: 32, organisation: 18 },
        feedbackComment: 'Good effort, Tommy!',
        findings,
      };

      // 1. Single student export
      const singleHtml = generateStudentHtmlReport({
        assignment: sampleAssignment,
        classId: '4A',
        student: sampleStudent,
        rubric: sampleRubric,
        transcript: studentTranscript,
        marking: studentMarking,
      });

      expect(singleHtml).toContain('<!DOCTYPE html>');
      expect(singleHtml).toContain('Annotated Student Writing');
      expect(singleHtml).toContain('Specific Language &amp; Accuracy Notes');
      // In-text annotation: "go" struck through with "goes"
      expect(singleHtml).toContain('class="orig-error-text">go</del>');
      expect(singleHtml).toContain('class="corr-text">goes</rt>');
      // Notes list: "go" -> "goes" (NOT "when he go" -> "when he goes")
      expect(singleHtml).toContain('"go"');
      expect(singleHtml).toContain('"goes"');
      expect(singleHtml).not.toContain('"when he go"');

      // 2. Merged all students export
      const mergedHtml = generateAllStudentsHtmlReport({
        assignment: sampleAssignment,
        classId: '4A',
        students: [sampleStudent],
        assignedIndices: [0],
        rubric: sampleRubric,
        transcripts: { 'student-1': studentTranscript },
        markings: { 'student-1': studentMarking },
      });

      expect(mergedHtml).toContain('<!DOCTYPE html>');
      expect(mergedHtml).toContain('Tommy');
      expect(mergedHtml).toContain('class="orig-error-text">go</del>');
      expect(mergedHtml).toContain('"go"');
      expect(mergedHtml).toContain('"goes"');
      expect(mergedHtml).not.toContain('"when he go"');
    });
  });
});
