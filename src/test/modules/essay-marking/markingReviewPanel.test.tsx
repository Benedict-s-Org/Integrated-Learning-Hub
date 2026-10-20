import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkingReviewPanel } from '@/modules/essay-marking/components/MarkingReviewPanel';
import {
  StudentRosterItem,
  AppliedMatching,
  StudentMarkingState,
  RubricDimension,
  ScanPage,
  StudentTranscriptState,
} from '@/modules/essay-marking/types';

describe('MarkingReviewPanel Component Rendering & Regression Tests', () => {
  const mockStudents: StudentRosterItem[] = [
    { id: 's1', displayName: 'Alice Wong', classNumber: 1, className: '4B' },
    { id: 's2', displayName: 'Bob Chan', classNumber: 2, className: '4B' },
  ];

  const mockPages: ScanPage[] = [
    {
      id: 'p1',
      fileId: 'f1',
      fileName: 'scan_p1.png',
      sourcePageNumber: 1,
      previewUrl: 'blob:http://localhost/scan_p1',
      orderIndex: 0,
    },
  ];

  const mockAppliedMatching: AppliedMatching = {
    classId: '4B',
    counts: [1, 1],
    map: [
      { studentIndex: 0, studentId: 's1', studentName: 'Alice Wong', classNumber: 1, part: 1, total: 1 },
      { studentIndex: 1, studentId: 's2', studentName: 'Bob Chan', classNumber: 2, part: 1, total: 1 },
    ],
    assignedStudentIndices: [0, 1],
    mode: 'sequential',
  };

  const mockRubric: RubricDimension[] = [
    { id: 'content', name: 'Content', maxScore: 40 },
    { id: 'language', name: 'Language', maxScore: 40 },
    { id: 'organisation', name: 'Organisation', maxScore: 20 },
  ];

  const mockTranscripts: Record<string, StudentTranscriptState> = {
    s1: {
      studentId: 's1',
      rawOcrText: 'They is running with my firend in the park.',
      editedText: 'They is running with my firend in the park.',
      isManuallyEntered: false,
      uncertainRegions: [],
      isVerified: true,
    },
  };

  const mockEmptyMarking: StudentMarkingState = {
    studentId: 's1',
    scores: { content: 30, language: 30, organisation: 15 },
    feedbackComment: 'Good effort.',
    findings: [],
    isApproved: false,
    approvedAt: undefined,
  };

  const mockMarkingWithFindings: StudentMarkingState = {
    studentId: 's1',
    scores: { content: 32, language: 28, organisation: 16 },
    feedbackComment: 'Watch subject-verb agreement.',
    findings: [
      {
        id: 'f1',
        type: 'Grammar',
        originalText: 'They is running',
        replacementText: 'They are running',
        explanation: 'Subject-verb agreement error with plural pronoun.',
        decision: 'pending',
        lineIndex: 0,
      },
      {
        id: 'f2',
        type: 'Spelling',
        originalText: 'firend',
        replacementText: 'friend',
        explanation: 'Common spelling transposition.',
        decision: 'accepted',
        lineIndex: 0,
      },
    ],
    isApproved: false,
    approvedAt: undefined,
  };

  const defaultProps = {
    pages: mockPages,
    transcripts: mockTranscripts,
    students: mockStudents,
    appliedMatching: mockAppliedMatching,
    activeStudentIndex: 0,
    rubric: mockRubric,
    markings: { s1: mockEmptyMarking },
    isRequirementsConfirmed: true,
    isTranscriptVerified: true,
    onSelectStudent: vi.fn(),
    onUpdateScores: vi.fn(),
    onUpdateFeedback: vi.fn(),
    onAddFinding: vi.fn(),
    onFindingDecision: vi.fn(),
    onDeleteFinding: vi.fn(),
    onApproveMarking: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
  };

  it('renders successfully without crashing when student has no findings', () => {
    render(<MarkingReviewPanel {...defaultProps} markings={{ s1: mockEmptyMarking }} />);

    expect(screen.getByText('Direct Full-Text Marking')).toBeInTheDocument();
    expect(screen.getByText('Handwritten Original Script')).toBeInTheDocument();
    expect(screen.getByText('Student Queue')).toBeInTheDocument();
    expect(screen.getByText(/0 Required/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Improvements/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Clarity/i)).toBeInTheDocument();
  });

  it('renders successfully with findings and displays inline marking details', () => {
    render(<MarkingReviewPanel {...defaultProps} markings={{ s1: mockMarkingWithFindings }} />);

    expect(screen.getByText(/2 findings • Original script line layout/i)).toBeInTheDocument();
    expect(screen.getByText('is')).toBeInTheDocument();
    expect(screen.getByText('are')).toBeInTheDocument();
    expect(screen.getByText('firend')).toBeInTheDocument();
    expect(screen.getByText('friend')).toBeInTheDocument();
  });

  it('renders unconfirmed requirements and unconfirmed transcript warnings without crashing', () => {
    render(
      <MarkingReviewPanel
        {...defaultProps}
        isRequirementsConfirmed={false}
        isTranscriptVerified={false}
        markings={{ s1: mockMarkingWithFindings }}
      />
    );

    expect(screen.getByText(/Writing requirements are unconfirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/The transcript for Alice Wong has not been confirmed yet/i)).toBeInTheDocument();
  });

  it('handles clicking inline finding and rejecting it via popover', () => {
    const onFindingDecision = vi.fn();
    render(
      <MarkingReviewPanel
        {...defaultProps}
        markings={{ s1: mockMarkingWithFindings }}
        onFindingDecision={onFindingDecision}
      />
    );

    // Click on the inline finding token for "is" (word-level diff from "They is running")
    const findingWord = screen.getByText('is');
    fireEvent.click(findingWord);

    // Popover opens with Reject button
    const rejectButtons = screen.getAllByRole('button', { name: /^Reject$/i });
    expect(rejectButtons.length).toBeGreaterThan(0);
    fireEvent.click(rejectButtons[0]);

    expect(onFindingDecision).toHaveBeenCalledWith('s1', 'f1', 'rejected');
  });

  it('allows expanding and collapsing the rubric scoring panel', () => {
    render(<MarkingReviewPanel {...defaultProps} markings={{ s1: mockMarkingWithFindings }} />);

    // Initially collapsed
    expect(screen.getByText('Expand ▼')).toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText('Expand ▼'));
    expect(screen.getByText('Collapse ▲')).toBeInTheDocument();
    expect(screen.getByText('Teacher Written Feedback Commentary')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByText('Collapse ▲'));
    expect(screen.getByText('Expand ▼')).toBeInTheDocument();
  });

  it('renders line bbox on scan and allows clicking scan to select line and activate Operation A & B toolbar', () => {
    const transcriptWithBbox: Record<string, StudentTranscriptState> = {
      s1: {
        studentId: 's1',
        rawOcrText: 'They is running with my firend in the park.',
        editedText: 'They is running with my firend in the park.',
        linesWithBboxes: [
          {
            text: 'They is running with my firend in the park.',
            bbox: [100, 200, 800, 280],
            pageNumber: 1,
          },
        ],
        isManuallyEntered: false,
        uncertainRegions: [],
        isVerified: true,
      },
    };

    render(
      <MarkingReviewPanel
        {...defaultProps}
        transcripts={transcriptWithBbox}
        markings={{ s1: mockMarkingWithFindings }}
      />
    );

    // Bounding box L1 should be present on the scan
    const lineBbox = screen.getByText('L1');
    expect(lineBbox).toBeInTheDocument();

    // Click line bbox
    fireEvent.click(lineBbox);

    // Active selection toolbar should appear
    expect(screen.getByText(/已選取原稿第/i)).toBeInTheDocument();
    expect(screen.getByText(/A. 修正辨識文字/i)).toBeInTheDocument();
    expect(screen.getByText(/B. 新增批改/i)).toBeInTheDocument();
  });

  it('Operation A: Correct OCR transcript updates transcript text and marks mismatching findings as needs_review', () => {
    const onUpdateTranscriptText = vi.fn();
    const onUpdateFindings = vi.fn();

    const transcriptWithBbox: Record<string, StudentTranscriptState> = {
      s1: {
        studentId: 's1',
        rawOcrText: 'He mess his room.',
        editedText: 'He mess his room.',
        linesWithBboxes: [
          {
            text: 'He mess his room.',
            bbox: [100, 100, 900, 180],
            pageNumber: 1,
          },
        ],
        isManuallyEntered: false,
        uncertainRegions: [],
        isVerified: true,
      },
    };

    const existingFindings: StudentMarkingState = {
      studentId: 's1',
      scores: {},
      feedbackComment: '',
      findings: [
        {
          id: 'f-mess',
          type: 'Grammar',
          originalText: 'mess',
          replacementText: 'messes',
          explanation: 'Subject-verb agreement',
          decision: 'pending',
          lineIndex: 0,
        },
      ],
      isApproved: false,
    };

    render(
      <MarkingReviewPanel
        {...defaultProps}
        transcripts={transcriptWithBbox}
        markings={{ s1: existingFindings }}
        onUpdateTranscriptText={onUpdateTranscriptText}
        onUpdateFindings={onUpdateFindings}
      />
    );

    // Click scan line L1
    fireEvent.click(screen.getByText('L1'));

    // Click "A. 修正辨識文字"
    fireEvent.click(screen.getByText(/A. 修正辨識文字/i));

    // Modal opens
    expect(screen.getByText(/修正辨識文字 \(Correct OCR\) — 第 1 行/i)).toBeInTheDocument();
    expect(screen.getByText(/原稿正確，但 OCR 抄錯/i)).toBeInTheDocument();

    // Change text from "He mess his room." to "He cleans his room." (mess is removed)
    const textarea = screen.getByPlaceholderText(/輸入符合手寫原稿的正確文字.../i);
    fireEvent.change(textarea, { target: { value: 'He cleans his room.' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /儲存文字修正/i }));

    // onUpdateTranscriptText should be called with new text
    expect(onUpdateTranscriptText).toHaveBeenCalledWith(
      's1',
      'He cleans his room.',
      expect.any(Array)
    );

    // Because "mess" is no longer in the line, finding f-mess should be flagged as needs_review
    expect(onUpdateFindings).toHaveBeenCalledWith(
      's1',
      expect.arrayContaining([
        expect.objectContaining({
          id: 'f-mess',
          decision: 'needs_review',
        }),
      ])
    );
  });

  it('Operation B: Add Finding creates manual teacher finding and checks for overlap', () => {
    const onAddFinding = vi.fn();

    render(
      <MarkingReviewPanel
        {...defaultProps}
        markings={{ s1: mockMarkingWithFindings }}
        onAddFinding={onAddFinding}
      />
    );

    // Click Add Finding
    fireEvent.click(screen.getByRole('button', { name: /Add Finding/i }));

    expect(screen.getByText(/新增批改 \(Add Finding\)/i)).toBeInTheDocument();
    expect(screen.getByText(/原稿本身有錯，AI 漏報/i)).toBeInTheDocument();

    // Enter a non-overlapping finding: "park" -> "garden"
    const originalInput = screen.getByPlaceholderText(/^例如：mess$/i);
    const replacementInput = screen.getByPlaceholderText(/^例如：messes$/i);

    fireEvent.change(originalInput, { target: { value: 'park' } });
    fireEvent.change(replacementInput, { target: { value: 'garden' } });

    fireEvent.click(screen.getByRole('button', { name: /儲存批改/i }));

    expect(onAddFinding).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        originalText: 'park',
        replacementText: 'garden',
        isManual: true,
        source: 'teacher',
      })
    );
  });

  it('displays needs_review findings in dedicated panel and does not render as broken inline diff', () => {
    const markingWithNeedsReview: StudentMarkingState = {
      studentId: 's1',
      scores: {},
      feedbackComment: '',
      findings: [
        {
          id: 'f-review-1',
          type: 'Tense',
          originalText: 'unmatchedword',
          replacementText: 'fixedword',
          explanation: 'Needs manual confirmation',
          decision: 'needs_review',
          reviewReason: '謄本文字已被手動修正，請重新確認。',
          lineIndex: 0,
        },
      ],
      isApproved: false,
    };

    render(
      <MarkingReviewPanel
        {...defaultProps}
        markings={{ s1: markingWithNeedsReview }}
      />
    );

    // Dedicated "待重新檢查建議" panel should appear
    expect(screen.getByText(/待重新檢查建議 \(Needs Review\)/i)).toBeInTheDocument();
    expect(screen.getByText('謄本文字已被手動修正，請重新確認。')).toBeInTheDocument();
    expect(screen.getByText('unmatchedword')).toBeInTheDocument();
    expect(screen.getByText('fixedword')).toBeInTheDocument();
  });

  it('renders all three feedback types with distinct styling and parentheses for suggestions', () => {
    const multiTypeMarking: StudentMarkingState = {
      studentId: 's1',
      scores: {},
      feedbackComment: '',
      findings: [
        {
          id: 'f-corr',
          type: 'Spelling',
          feedbackType: 'correction',
          originalText: 'firend',
          replacementText: 'friend',
          explanation: 'Clear spelling mistake',
          decision: 'pending',
          lineIndex: 0,
        },
        {
          id: 'f-imp',
          type: 'Vocabulary',
          feedbackType: 'improvement',
          originalText: 'running',
          replacementText: 'jogging',
          explanation: 'Optional improvement for richer vocabulary',
          decision: 'pending',
          lineIndex: 0,
        },
        {
          id: 'f-cla',
          type: 'Clarity',
          feedbackType: 'clarity',
          originalText: 'They',
          replacementText: 'Clarification needed',
          explanation: 'Unclear pronoun reference',
          decision: 'pending',
          lineIndex: 0,
        },
      ],
      isApproved: false,
    };

    render(
      <MarkingReviewPanel
        {...defaultProps}
        markings={{ s1: multiTypeMarking }}
      />
    );

    // Verify secondary toolbar counters count each feedback type separately
    expect(screen.getByText(/1 Required/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Improvements/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Clarity/i)).toBeInTheDocument();

    // Required correction has replacement without parens
    expect(screen.getByText('friend')).toBeInTheDocument();

    // Optional improvement has suggestion enclosed in parentheses
    expect(screen.getByText('(jogging)')).toBeInTheDocument();

    // Clarity suggestion has suggestion enclosed in parentheses
    expect(screen.getByText('(Clarification needed)')).toBeInTheDocument();
  });

  it('allows teacher to select feedback type in Add Finding modal and submits with chosen feedbackType', () => {
    const onAddFinding = vi.fn();
    render(
      <MarkingReviewPanel
        {...defaultProps}
        onAddFinding={onAddFinding}
      />
    );

    // Select a word on the page by clicking a word in InlineMarkingView
    const wordEl = screen.getByText('They');
    fireEvent.click(wordEl);

    // Click "B. 新增批改" button
    const addBtn = screen.getByText('B. 新增批改');
    fireEvent.click(addBtn);

    // Modal should appear with 3 feedback types
    expect(screen.getByText('1. 必要修正 (Red/Green)')).toBeInTheDocument();
    expect(screen.getByText('2. 潤色建議 (Purple)')).toBeInTheDocument();
    expect(screen.getByText('3. 文理連貫 (Blue)')).toBeInTheDocument();

    // Select "2. 潤色建議 (Purple)"
    fireEvent.click(screen.getByText('2. 潤色建議 (Purple)'));

    // Fill in replacement
    const replacementInput = screen.getByPlaceholderText('例如：messes');
    fireEvent.change(replacementInput, { target: { value: 'Our' } });

    // Submit form
    const submitBtn = screen.getByText('儲存批改');
    fireEvent.click(submitBtn);

    expect(onAddFinding).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        feedbackType: 'improvement',
        replacementText: 'Our',
      })
    );
  });

  it('maintains backward compatibility when finding has no feedbackType (defaults to correction)', () => {
    const legacyMarking: StudentMarkingState = {
      studentId: 's1',
      scores: {},
      feedbackComment: '',
      findings: [
        {
          id: 'f-legacy',
          type: 'Grammar',
          originalText: 'is',
          replacementText: 'are',
          explanation: 'Legacy finding without feedbackType field',
          decision: 'pending',
          lineIndex: 0,
        },
      ],
      isApproved: false,
    };

    render(
      <MarkingReviewPanel
        {...defaultProps}
        markings={{ s1: legacyMarking }}
      />
    );

    // Should count as Required Correction by default
    expect(screen.getByText(/1 Required/i)).toBeInTheDocument();
    expect(screen.getByText('are')).toBeInTheDocument();
  });
});

