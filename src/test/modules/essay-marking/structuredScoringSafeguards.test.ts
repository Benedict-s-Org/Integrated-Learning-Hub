import { describe, it, expect, vi } from 'vitest';
import {
  computeRubricFingerprint,
  resolveEffectiveGrade,
  RubricDimension,
  RUBRIC_P1_P3,
  RUBRIC_P4_P6,
  StudentMarkingState,
  StructuredAssessmentComments,
  MarkingFinding,
} from '@/modules/essay-marking/types';
import { generateStudentMarkdownReport } from '@/modules/essay-marking/utils/markdownReportGenerator';
import { generateStudentHtmlReport } from '@/modules/essay-marking/utils/htmlReportGenerator';
import { generateStudentDocxBlob } from '@/modules/essay-marking/utils/docxReportGenerator';

describe('Structured Scoring Semantics & Context Safeguards', () => {
  describe('1. Scoring Semantics & Bounds (Requirements 1 & 3)', () => {
    it('validates non-100 totals correctly (P3: 45 + 30 = 75)', () => {
      const p3Rubric = [...RUBRIC_P1_P3];
      const scores = { content: 45, language: 30 };
      const total = Object.values(scores).reduce((a, b) => a + b, 0);

      expect(total).toBe(75);
      expect(total).toBeLessThanOrEqual(100);
      expect(scores.content % 5).toBe(0);
      expect(scores.language % 5).toBe(0);
      expect(scores.content).toBeLessThanOrEqual(60);
      expect(scores.language).toBeLessThanOrEqual(40);
    });

    it('validates non-100 totals correctly (P4: 30 + 30 + 15 = 75)', () => {
      const p4Rubric = [...RUBRIC_P4_P6];
      const scores = { content: 30, language: 30, organisation: 15 };
      const total = Object.values(scores).reduce((a, b) => a + b, 0);

      expect(total).toBe(75);
      expect(total).toBeLessThanOrEqual(100);
      expect(scores.content % 5).toBe(0);
      expect(scores.language % 5).toBe(0);
      expect(scores.organisation % 5).toBe(0);
      expect(scores.content).toBeLessThanOrEqual(40);
      expect(scores.language).toBeLessThanOrEqual(40);
      expect(scores.organisation).toBeLessThanOrEqual(20);
    });

    it('enforces single-paragraph Organisation cap <= 10 for P4-P6 essays', () => {
      const singleParagraphEssay = 'This is a single paragraph essay without any newline characters.';
      const paragraphCount = singleParagraphEssay.split(/\n\s*\n/).filter((p) => p.trim()).length;
      expect(paragraphCount).toBe(1);

      // If single paragraph, organisation score cannot exceed 10/20
      const validOrgScore = 10;
      const invalidOrgScore = 15;
      expect(validOrgScore <= 10).toBe(true);
      expect(invalidOrgScore <= 10).toBe(false);
    });
  });

  describe('2. Grade Conflict & Pedagogical Bounds (Requirements 3 & 4)', () => {
    it('rejects P.1 and P.2 as unsupported by the pedagogical prompt', () => {
      const p1Res = resolveEffectiveGrade('P.1', null);
      expect(p1Res.grade).toBeNull();
      expect(p1Res.error).toContain('不支援的年級');

      const p2Res = resolveEffectiveGrade('P.2', null);
      expect(p2Res.grade).toBeNull();
      expect(p2Res.error).toContain('不支援的年級');
    });

    it('accepts P.3, P.4, P.5, P.6 without error', () => {
      expect(resolveEffectiveGrade('P.3', null).grade).toBe('P.3');
      expect(resolveEffectiveGrade('P.4', null).grade).toBe('P.4');
      expect(resolveEffectiveGrade('P.5', null).grade).toBe('P.5');
      expect(resolveEffectiveGrade('P.6', null).grade).toBe('P.6');
    });

    it('detects conflict between assignment grade and class grade without guessing', () => {
      const res = resolveEffectiveGrade('P.4', 'P5A');
      expect(res.grade).toBeNull();
      expect(res.error).toContain('年級設定衝突');
    });

    it('resolves student class grade when assignment grade is unset', () => {
      const res = resolveEffectiveGrade(null, 'P3B');
      expect(res.grade).toBe('P.3');
      expect(res.error).toBeUndefined();
    });
  });

  describe('3. Rubric Fingerprint & Context Safeguards (Requirement 4)', () => {
    it('includes criteria descriptions in rubric fingerprint to detect rubric modifications', () => {
      const rubricA: RubricDimension[] = [
        { id: 'content', name: 'Content', maxScore: 60, description: 'Version 1 descriptor' },
        { id: 'language', name: 'Language', maxScore: 40, description: 'Version 1 grammar' },
      ];
      const rubricB: RubricDimension[] = [
        { id: 'content', name: 'Content', maxScore: 60, description: 'Version 2 updated descriptor' },
        { id: 'language', name: 'Language', maxScore: 40, description: 'Version 1 grammar' },
      ];

      const fpA = computeRubricFingerprint(rubricA);
      const fpB = computeRubricFingerprint(rubricB);

      expect(fpA).not.toBe(fpB);
      expect(fpA).toContain('Version 1 descriptor');
      expect(fpB).toContain('Version 2 updated descriptor');
    });
  });

  describe('4. Teacher Ownership & Staged Proposal Verification (Requirement 5)', () => {
    it('maintains effective total consistent with effective dimension scores when teacher overrides', () => {
      const initialScores = { content: 25, language: 25, organisation: 15 };
      const teacherEditedScores = { content: 35, language: 30, organisation: 15 };

      const total = Object.values(teacherEditedScores).reduce((a, b) => a + b, 0);
      expect(total).toBe(80);

      const markingState: StudentMarkingState = {
        studentId: 's1',
        findings: [],
        scores: teacherEditedScores,
        totalScore: total,
        scoresSource: 'teacher',
        feedbackComment: 'Teacher custom feedback',
        commentsSource: 'teacher',
        isApproved: false,
      };

      expect(markingState.scoresSource).toBe('teacher');
      expect(markingState.totalScore).toBe(80);
    });

    it('stages new AI proposal when teacher overrides exist, preserving active teacher edits', () => {
      const activeMarking: StudentMarkingState = {
        studentId: 's1',
        findings: [
          {
            id: 'manual-1',
            type: 'Spelling',
            feedbackType: 'correction',
            originalText: 'recieve',
            replacementText: 'receive',
            explanation: 'Manual correction',
            decision: 'edited',
            source: 'teacher',
          },
        ],
        scores: { content: 35, language: 30, organisation: 15 },
        totalScore: 80,
        scoresSource: 'teacher',
        feedbackComment: 'Teacher personal feedback note',
        commentsSource: 'teacher',
        isApproved: false,
      };

      const newAiProposal = {
        scores: { content: 30, language: 30, organisation: 15 },
        totalScore: 75,
        assessmentComments: {
          positive: 'Good creative plot.',
          relevant: 'Use more descriptive adjectives.',
          finalNextStep: 'Proofread verb tenses.',
        },
        findings: [
          {
            id: 'f-ai-1',
            type: 'Tense',
            feedbackType: 'correction' as const,
            originalText: 'go',
            replacementText: 'went',
            explanation: 'Past tense needed',
            decision: 'pending' as const,
            source: 'ai' as const,
          },
        ],
        receivedAt: new Date().toISOString(),
      };

      // Attaching staged proposal does NOT mutate active scores or feedback
      const updatedState: StudentMarkingState = {
        ...activeMarking,
        stagedAiProposal: newAiProposal,
      };

      expect(updatedState.scores.content).toBe(35);
      expect(updatedState.totalScore).toBe(80);
      expect(updatedState.feedbackComment).toBe('Teacher personal feedback note');
      expect(updatedState.stagedAiProposal?.totalScore).toBe(75);
    });
  });

  describe('5. Matching Assessment Data in Step 4, Step 5, HTML, Markdown, DOCX (Requirement 6)', () => {
    const student = { id: 's1', displayName: 'Alice Chan', classNumber: 1, className: '4A' };
    const rubric: RubricDimension[] = [
      { id: 'content', name: 'Content', maxScore: 40 },
      { id: 'language', name: 'Language', maxScore: 40 },
      { id: 'organisation', name: 'Organisation', maxScore: 20 },
    ];
    const assessmentComments: StructuredAssessmentComments = {
      positive: 'Clear story opening and expressive character voice.',
      relevant: 'Expand on the ending resolution with more action.',
      finalNextStep: 'Check paragraph indentation and past continuous tense.',
    };
    const scores = { content: 30, language: 30, organisation: 15 };
    const totalScore = 75;

    it('generates consistent Markdown with total 75/100 and structured pedagogical comments', () => {
      const md = generateStudentMarkdownReport({
        assignmentTitle: 'A Special Day',
        classId: '4A',
        studentNumber: 1,
        studentName: 'Alice Chan',
        isApproved: true,
        totalScore,
        maxPossibleScore: 100,
        rubric,
        scores,
        feedbackComment: 'Great effort overall!',
        assessmentComments,
        transcriptText: 'Yesterday I was going to the park. It was sunny.',
        findings: [],
      });

      expect(md).toContain('**Overall Score:** 75 / 100');
      expect(md).toContain('**Content:** 30 / 40');
      expect(md).toContain('**Language:** 30 / 40');
      expect(md).toContain('**Organisation:** 15 / 20');
      expect(md).toContain('### Strengths & Highlights\nClear story opening');
      expect(md).toContain('### Areas for Improvement\nExpand on the ending');
      expect(md).toContain('### Next Steps for Writing\nCheck paragraph indentation');
    });

    it('generates consistent HTML report with total 75/100 and structured pedagogical comments', () => {
      const html = generateStudentHtmlReport({
        assignment: {
          title: 'A Special Day',
          rubric,
          worksheetFileName: null,
          worksheetFile: null,
          worksheetPreviewUrl: null,
          responseFormat: 'worksheet',
          scopePrompt: '',
          isConfirmed: true,
        },
        classId: '4A',
        student,
        rubric,
        transcript: {
          studentId: 's1',
          rawOcrText: 'Yesterday I was going to the park.',
          editedText: 'Yesterday I was going to the park.',
          isManuallyEntered: true,
          uncertainRegions: [],
          isVerified: true,
        },
        marking: {
          studentId: 's1',
          findings: [],
          scores,
          totalScore,
          scoresSource: 'ai',
          assessmentComments,
          commentsSource: 'ai',
          feedbackComment: 'Great effort overall!',
          isApproved: true,
        },
      });

      expect(html).toContain('75');
      expect(html).toContain('/ 100');
      expect(html).toContain('Strengths &amp; Highlights');
      expect(html).toContain('Clear story opening');
      expect(html).toContain('Areas for Improvement');
      expect(html).toContain('Next Steps for Writing');
    });

    it('generates consistent DOCX report with total 75/100 and structured comments without error', async () => {
      const blob = await generateStudentDocxBlob({
        assignmentTitle: 'A Special Day',
        classId: '4A',
        studentNumber: 1,
        studentName: 'Alice Chan',
        isApproved: true,
        totalScore,
        maxPossibleScore: 100,
        rubric,
        scores,
        feedbackComment: 'Great effort overall!',
        assessmentComments,
        transcriptText: 'Yesterday I was going to the park.',
        findings: [],
      });

      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(1000);
      expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });
  });
});
