import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportPanel } from '@/modules/essay-marking/components/ReportPanel';
import {
  buildStudentDocxDocument,
  buildAnnotatedWritingSection,
  generateSafeDocxFilename,
} from '@/modules/essay-marking/utils/docxReportGenerator';
import * as docxReportGen from '@/modules/essay-marking/utils/docxReportGenerator';
import {
  AssignmentConfig,
  StudentRosterItem,
  AppliedMatching,
  RubricDimension,
  StudentTranscriptState,
  StudentMarkingState,
  MarkingFinding,
} from '@/modules/essay-marking/types';
import { Packer } from 'docx';
import mammoth from 'mammoth';

describe('Export .docx Feature Verification Tests', () => {
  const sampleRubric: RubricDimension[] = [
    { id: 'content', name: 'Content & Ideas', maxScore: 5 },
    { id: 'language', name: 'Language & Grammar', maxScore: 5 },
  ];

  const sampleAssignment: AssignmentConfig = {
    title: 'Writing Assessment',
    worksheetFileName: null,
    worksheetFile: null,
    worksheetPreviewUrl: null,
    responseFormat: 'separate_paper',
    scopePrompt: '',
    isConfirmed: true,
    rubric: sampleRubric,
  };

  const sampleStudent: StudentRosterItem = {
    id: 'std-1',
    classNumber: 1,
    studentIdNumber: '4A01',
    displayName: 'Abby Chan',
    gender: 'F',
    status: 'enrolled',
  };

  const sampleAppliedMatching: AppliedMatching = {
    classId: '4A',
    counts: [1],
    map: [],
    assignedStudentIndices: [0],
  };

  async function docxToHtml(doc: any): Promise<string> {
    const buffer = await Packer.toBuffer(doc);
    const result = await mammoth.convertToHtml({ buffer });
    return result.value;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Verification 1: Unchanged line with blank annotation row above
  // --------------------------------------------------------------------------
  it('1. Unchanged line has a dedicated blank annotation row above it', async () => {
    const transcript = 'Yesterday I went to the park with my family.';
    const findings: MarkingFinding[] = [];

    const doc = buildStudentDocxDocument({
      assignmentTitle: 'Trip to Park',
      classId: '4A',
      studentNumber: 1,
      studentName: 'Abby Chan',
      isApproved: true,
      totalScore: 10,
      maxPossibleScore: 10,
      rubric: sampleRubric,
      scores: { content: 5, language: 5 },
      transcriptText: transcript,
      findings,
    });

    const html = await docxToHtml(doc);

    // Must contain table where Row 1 has a blank paragraph and Row 2 has the student text
    expect(html).toContain('Yesterday I went to the park with my family.');
    expect(html).toContain('<table><tr><td><p> </p></td></tr><tr><td><p>Yesterday I went to the park with my family.</p></td></tr></table>');
  });

  // --------------------------------------------------------------------------
  // Verification 2: "save" -> "saved" with red strikethrough / green correction
  // --------------------------------------------------------------------------
  it('2. "save" -> "saved" formats original error in red strikethrough and correction in green', async () => {
    const transcript = 'He save his friend.';
    const findings: MarkingFinding[] = [
      {
        id: 'f-save',
        type: 'grammar',
        feedbackType: 'correction',
        originalText: 'save',
        replacementText: 'saved',
        decision: 'accepted',
        lineIndex: 0,
      },
    ];

    const doc = buildStudentDocxDocument({
      assignmentTitle: 'Story Review',
      classId: '4A',
      studentNumber: 1,
      studentName: 'Abby Chan',
      totalScore: 9,
      maxPossibleScore: 10,
      rubric: sampleRubric,
      scores: { content: 5, language: 4 },
      transcriptText: transcript,
      findings,
    });

    const html = await docxToHtml(doc);

    // "save" struck through in red, "saved" bold in green directly above
    expect(html).toContain('<strong>saved</strong>');
    expect(html).toContain('<s>save</s>');
    expect(html).toContain('<p>He </p>');
    expect(html).toContain('<p> his friend.</p>');
  });

  // --------------------------------------------------------------------------
  // Verification 3: Multiple corrections on one line
  // --------------------------------------------------------------------------
  it('3. Multiple corrections on one line are laid out horizontally in distinct columns', async () => {
    const transcript = 'The dog bark loud and run fast.';
    const findings: MarkingFinding[] = [
      {
        id: 'f-bark',
        type: 'grammar',
        feedbackType: 'correction',
        originalText: 'bark',
        replacementText: 'barked',
        decision: 'accepted',
        lineIndex: 0,
      },
      {
        id: 'f-run',
        type: 'grammar',
        feedbackType: 'correction',
        originalText: 'run',
        replacementText: 'ran',
        decision: 'accepted',
        lineIndex: 0,
      },
    ];

    const doc = buildStudentDocxDocument({
      assignmentTitle: 'Story Review',
      totalScore: 8,
      maxPossibleScore: 10,
      rubric: sampleRubric,
      scores: { content: 4, language: 4 },
      transcriptText: transcript,
      findings,
    });

    const html = await docxToHtml(doc);

    expect(html).toContain('<strong>barked</strong>');
    expect(html).toContain('<s>bark</s>');
    expect(html).toContain('<strong>ran</strong>');
    expect(html).toContain('<s>run</s>');
    expect(html).toContain('The dog ');
    expect(html).toContain(' loud and ');
    expect(html).toContain(' fast.');
  });

  // --------------------------------------------------------------------------
  // Verification 4: Blue sentence-level clarity/coherence suggestion
  // --------------------------------------------------------------------------
  it('4. Clarity/coherence suggestion appears in blue enclosed in parentheses above source line without striking through text', async () => {
    const transcript = 'He was very happy because they played together.';
    const findings: MarkingFinding[] = [
      {
        id: 'f-clarity',
        type: 'expression',
        feedbackType: 'clarity',
        originalText: 'He was very happy because they played together.',
        replacementText: 'Delighted by their adventure, he enjoyed every moment.',
        decision: 'accepted',
        lineIndex: 0,
      },
    ];

    const doc = buildStudentDocxDocument({
      totalScore: 9,
      maxPossibleScore: 10,
      rubric: sampleRubric,
      scores: { content: 5, language: 4 },
      transcriptText: transcript,
      findings,
    });

    const html = await docxToHtml(doc);

    // Suggestion enclosed in parentheses and italicized (blue)
    expect(html).toContain('<em>(Delighted by their adventure, he enjoyed every moment.)</em>');
    // Original text intact without strikethrough
    expect(html).toContain('<p>He was very happy because they played together.</p>');
    expect(html).not.toContain('<s>He was very happy because they played together.</s>');
  });

  // --------------------------------------------------------------------------
  // Verification 5: Purple optional sentence improvement
  // --------------------------------------------------------------------------
  it('5. Optional sentence improvement appears in purple enclosed in parentheses above source line without striking through text', async () => {
    const transcript = 'After the game, they went to eat some delicious ice cream.';
    const findings: MarkingFinding[] = [
      {
        id: 'f-improve',
        type: 'vocabulary',
        feedbackType: 'improvement',
        originalText: 'delicious ice cream',
        replacementText: 'Consider using "refreshing" or "delectable" to enrich imagery.',
        decision: 'accepted',
        lineIndex: 0,
      },
    ];

    const doc = buildStudentDocxDocument({
      totalScore: 9,
      maxPossibleScore: 10,
      rubric: sampleRubric,
      scores: {},
      transcriptText: transcript,
      findings,
    });

    const html = await docxToHtml(doc);

    expect(html).toContain(
      '<em>(Consider using "refreshing" or "delectable" to enrich imagery.)</em>'
    );
    expect(html).toContain('<p>After the game, they went to eat some delicious ice cream.</p>');
    expect(html).not.toContain('<s>delicious ice cream</s>');
  });

  // --------------------------------------------------------------------------
  // Verification 6: Mixed feedback requiring extra annotation space
  // --------------------------------------------------------------------------
  it('6. Mixed feedback (clarity + improvement + word correction) preserves all items on separate annotation rows', async () => {
    const transcript = 'Tommy say that we should go again tomorrow.';
    const findings: MarkingFinding[] = [
      {
        id: 'f-clarity-mixed',
        type: 'clarity',
        feedbackType: 'clarity',
        originalText: 'Tommy say that we should go again tomorrow.',
        replacementText: 'Tommy suggested returning the following day.',
        decision: 'accepted',
        lineIndex: 0,
      },
      {
        id: 'f-improve-mixed',
        type: 'vocabulary',
        feedbackType: 'improvement',
        originalText: 'go again tomorrow',
        replacementText: 'Consider "revisit" for formal variety.',
        decision: 'accepted',
        lineIndex: 0,
      },
      {
        id: 'f-corr-mixed',
        type: 'grammar',
        feedbackType: 'correction',
        originalText: 'say',
        replacementText: 'said',
        decision: 'accepted',
        lineIndex: 0,
      },
    ];

    const doc = buildStudentDocxDocument({
      totalScore: 9,
      maxPossibleScore: 10,
      rubric: sampleRubric,
      scores: {},
      transcriptText: transcript,
      findings,
    });

    const html = await docxToHtml(doc);

    // All three feedback items preserved without collisions
    expect(html).toContain('<em>(Tommy suggested returning the following day.)</em>');
    expect(html).toContain('<em>(Consider "revisit" for formal variety.)</em>');
    expect(html).toContain('<strong>said</strong>');
    expect(html).toContain('<s>say</s>');
  });

  // --------------------------------------------------------------------------
  // Verification 7: Repeated words and teacher-edited source range
  // --------------------------------------------------------------------------
  it('7. Handles repeated words using occurrenceIndex and honors teacher-edited explicit source ranges', async () => {
    const transcript = 'The that that boy saw a cat.';
    const findings: MarkingFinding[] = [
      {
        id: 'f-repeat',
        type: 'grammar',
        feedbackType: 'correction',
        originalText: 'that',
        occurrenceIndex: 1, // Only second occurrence
        replacementText: '(delete)',
        decision: 'accepted',
        lineIndex: 0,
      },
    ];

    const doc1 = buildStudentDocxDocument({
      totalScore: 9,
      maxPossibleScore: 10,
      rubric: sampleRubric,
      scores: {},
      transcriptText: transcript,
      findings,
    });

    const html1 = await docxToHtml(doc1);

    // First "that" is kept in normal text; second "that" is deleted
    expect(html1).toContain('<p>The that </p>');
    expect(html1).toContain('<s>that</s>');

    // Teacher explicit range: editing "boy" at startIndex 14, endIndex 17
    const teacherFindings: MarkingFinding[] = [
      {
        id: 'f-teacher-edited',
        type: 'grammar',
        feedbackType: 'correction',
        originalText: 'boy',
        replacementText: 'young boy',
        startIndex: 14,
        endIndex: 17,
        lineIndex: 0,
        decision: 'edited',
      } as any,
    ];

    const doc2 = buildStudentDocxDocument({
      totalScore: 9,
      maxPossibleScore: 10,
      rubric: sampleRubric,
      scores: {},
      transcriptText: transcript,
      findings: teacherFindings,
    });

    const html2 = await docxToHtml(doc2);
    expect(html2).toContain('<p>The that that </p>');
    expect(html2).toContain('<s>boy</s>');
    expect(html2).toContain('<strong>young boy</strong>');
  });

  // --------------------------------------------------------------------------
  // Verification 8: Insertions and Deletions
  // --------------------------------------------------------------------------
  it('8. Handles insertions (green text above caret marker) and deletions (red strikethrough with no invented replacement)', async () => {
    const transcript = 'He went school yesterday.\nShe had had a great time.';
    const findings: MarkingFinding[] = [
      // Insertion of "to" between "went " and "school"
      {
        id: 'f-insert',
        type: 'grammar',
        feedbackType: 'correction',
        originalText: '',
        replacementText: 'to',
        startIndex: 7,
        lineIndex: 0,
        decision: 'accepted',
      } as any,
      // Deletion of "had"
      {
        id: 'f-delete',
        type: 'grammar',
        feedbackType: 'correction',
        originalText: 'had',
        occurrenceIndex: 1,
        replacementText: '(delete)',
        lineIndex: 1,
        decision: 'accepted',
      },
    ];

    const doc = buildStudentDocxDocument({
      totalScore: 9,
      maxPossibleScore: 10,
      rubric: sampleRubric,
      scores: {},
      transcriptText: transcript,
      findings,
    });

    const html = await docxToHtml(doc);

    // Insertion: green "to" above caret "^"
    expect(html).toContain('<strong>to</strong>');
    expect(html).toContain('<strong>^</strong>');

    // Deletion: red strikethrough "had" with no replacement text
    expect(html).toContain('<s>had</s>');
  });

  // --------------------------------------------------------------------------
  // Verification 9: Full document structure, blank lines, and legend
  // --------------------------------------------------------------------------
  it('9. Document builds complete report with metadata, rubric, legend, and excludes rejected findings', async () => {
    const filename = generateSafeDocxFilename(
      'Story Review: "My Dog"',
      '4A',
      1,
      'Abby Chan / 敏'
    );
    expect(filename).toBe('Story_Review___My_Dog__4A_No01_Abby_Chan___敏.docx');

    const doc = buildStudentDocxDocument({
      assignmentTitle: 'Story Review',
      classId: '4A',
      studentNumber: 1,
      studentName: 'Abby Chan',
      isApproved: true,
      totalScore: 9,
      maxPossibleScore: 10,
      rubric: sampleRubric,
      scores: { content: 5, language: 4 },
      feedbackComment: 'Excellent effort on descriptive details.',
      transcriptText: 'He save his friend.\n\nParagraph two is here.',
      findings: [
        {
          id: 'f1',
          type: 'grammar',
          feedbackType: 'correction',
          originalText: 'save',
          replacementText: 'saved',
          decision: 'accepted',
          lineIndex: 0,
        },
        // Rejected finding - must be EXCLUDED
        {
          id: 'f-rej',
          type: 'grammar',
          feedbackType: 'correction',
          originalText: 'friend',
          replacementText: 'companion',
          decision: 'rejected',
          lineIndex: 0,
        },
      ],
    });

    const html = await docxToHtml(doc);

    // Header and metadata
    expect(html).toContain('LEARNING HUB — WRITING ASSESSMENT REPORT');
    expect(html).toContain('Story Review');
    expect(html).toContain('Abby Chan');
    expect(html).toContain('Teacher Approved');
    expect(html).toContain('9 / 10');

    // Rubric Breakdown
    expect(html).toContain('Rubric Dimension Breakdown');
    expect(html).toContain('Content &amp; Ideas');
    expect(html).toContain('5 / 5');

    // Teacher feedback
    expect(html).toContain('Excellent effort on descriptive details.');

    // Marking Legend
    expect(html).toContain('Marking Legend &amp; Visual Formatting:');
    expect(html).toContain('Red strikethrough');
    expect(html).toContain('Green bold text');

    // Corrections and rejection exclusion
    expect(html).toContain('<strong>saved</strong>');
    expect(html).not.toContain('companion'); // Rejected finding must NOT appear

    // Blank line between paragraphs preserved
    expect(html).toContain('Paragraph two is here.');
  });

  // --------------------------------------------------------------------------
  // UI Test: Export .docx button in ReportPanel
  // --------------------------------------------------------------------------
  it('10. Renders "Export .docx" button in ReportPanel and triggers download on click', async () => {
    const downloadDocxSpy = vi
      .spyOn(docxReportGen, 'downloadDocxFile')
      .mockImplementation(() => {});

    const generateBlobSpy = vi
      .spyOn(docxReportGen, 'generateStudentDocxBlob')
      .mockResolvedValue(new Blob(['fake-docx']));

    const transcripts: Record<string, StudentTranscriptState> = {
      'std-1': {
        studentId: 'std-1',
        rawOcrText: 'He save his friend.',
        editedText: 'He save his friend.',
        isManuallyEntered: false,
        uncertainRegions: [],
        isVerified: true,
      },
    };

    const markings: Record<string, StudentMarkingState> = {
      'std-1': {
        studentId: 'std-1',
        findings: [
          {
            id: 'f1',
            type: 'grammar',
            feedbackType: 'correction',
            originalText: 'save',
            replacementText: 'saved',
            decision: 'accepted',
            lineIndex: 0,
          },
        ],
        scores: { content: 5, language: 4 },
        feedbackComment: 'Great writing!',
        isApproved: true,
      },
    };

    render(
      <ReportPanel
        assignment={sampleAssignment}
        students={[sampleStudent]}
        appliedMatching={sampleAppliedMatching}
        activeStudentIndex={0}
        rubric={sampleRubric}
        transcripts={transcripts}
        markings={markings}
        onSelectStudent={vi.fn()}
        onPrev={vi.fn()}
      />
    );

    const docxBtn = screen.getByRole('button', { name: /Export \.docx/i });
    expect(docxBtn).toBeInTheDocument();

    fireEvent.click(docxBtn);

    await waitFor(() => {
      expect(generateBlobSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          studentName: 'Abby Chan',
          totalScore: 9,
          transcriptText: 'He save his friend.',
        })
      );
      expect(downloadDocxSpy).toHaveBeenCalledWith(
        'Writing_Assessment_4A_No01_Abby_Chan.docx',
        expect.any(Blob)
      );
    });
  });
});
