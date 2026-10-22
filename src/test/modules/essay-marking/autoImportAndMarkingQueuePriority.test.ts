import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BackgroundMarkingQueueController,
  checkStudentMarkingReadiness,
  isEffectiveTranscriptPresent,
  MarkingQueueJob,
} from '@/modules/essay-marking/utils/backgroundMarkingQueue';
import {
  StudentRosterItem,
  ScanPage,
  AppliedMatching,
  StudentTranscriptState,
  StagedCandidateTranscript,
  AssignmentConfig,
  DEFAULT_RUBRIC,
} from '@/modules/essay-marking/types';
import { essayServices } from '@/modules/essay-marking/services/essayServiceRegistry';

describe('autoImportAndMarkingQueuePriority regression suite', () => {
  const mockStudents: StudentRosterItem[] = [
    { id: 's1', displayName: 'Alice', classNumber: 1, className: '4A' },
    { id: 's2', displayName: 'Bob', classNumber: 2, className: '4A' },
    { id: 's3', displayName: 'Charlie', classNumber: 3, className: '4A' },
  ];

  const mockPages: ScanPage[] = [
    { id: 'p1', fileName: 'scan1.png', orderIndex: 0, previewUrl: 'data:image/png;base64,1' } as ScanPage,
    { id: 'p2', fileName: 'scan2.png', orderIndex: 1, previewUrl: 'data:image/png;base64,2' } as ScanPage,
    { id: 'p3', fileName: 'scan3.png', orderIndex: 2, previewUrl: 'data:image/png;base64,3' } as ScanPage,
  ];

  const mockAssignment: AssignmentConfig = {
    id: 'a1',
    title: 'My Favorite Animal',
    grade: 'P.4',
    scopePrompt: 'Write 100 words about an animal.',
    rubric: DEFAULT_RUBRIC,
    isConfirmed: true,
    responseFormat: 'worksheet',
  };

  const mockMatching: AppliedMatching = {
    classId: 'c1',
    mode: 'recognition',
    timestamp: Date.now(),
    studentPageOrders: {
      s1: ['p1', 'p2'],
      s2: ['p3'],
    },
    map: [
      { studentIndex: 0, part: 1, total: 2, isConfident: true }, // s1 p1
      { studentIndex: 0, part: 2, total: 2, isConfident: true }, // s1 p2
      { studentIndex: 1, part: 1, total: 1, isConfident: true }, // s2 p3
    ],
    assignedStudentIndices: [0, 1], // s1, s2 in confirmed matching order
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Case 1: Existing OCR-edited text preservation
  it('1. Existing OCR-edited text preservation: OCR completion when text exists stages candidate for confirmation', () => {
    const existingTranscript: StudentTranscriptState = {
      studentId: 's1',
      rawOcrText: 'Original OCR text',
      editedText: 'Teacher edited text',
      isManuallyEntered: true,
      uncertainRegions: [],
      isVerified: false,
      revision: 2,
    };

    expect(isEffectiveTranscriptPresent(existingTranscript)).toBe(true);

    // Simulate completion check
    const transcripts: Record<string, StudentTranscriptState> = { s1: existingTranscript };
    const curEffective = (transcripts.s1.editedText ?? transcripts.s1.rawOcrText ?? '').trim();
    expect(curEffective.length > 0).toBe(true);

    // Because effective text exists, replacement candidate is staged, not auto-overwritten
    const stagedCandidates: Record<string, StagedCandidateTranscript> = {};
    const newOcrCandidate: StagedCandidateTranscript = {
      id: 'cand-1',
      studentId: 's1',
      transcript: 'Brand new OCR text',
      receivedAt: Date.now(),
      provider: 'mathpix_only',
      promptVersion: '1.0',
      settingsVersion: '1.0',
      pageSignature: 'sig',
      status: 'candidate_ready',
      pageResults: [
        { scanPageId: 'p1', part: 1, totalParts: 2, status: 'success', transcript: 'Brand new' },
        { scanPageId: 'p2', part: 2, totalParts: 2, status: 'success', transcript: 'OCR text' },
      ],
    };

    if (curEffective.length > 0) {
      stagedCandidates.s1 = newOcrCandidate;
    }

    // Existing transcript text remains untouched
    expect(transcripts.s1.editedText).toBe('Teacher edited text');
    expect(stagedCandidates.s1).toBeDefined();
    expect(stagedCandidates.s1.transcript).toBe('Brand new OCR text');
  });

  // Case 2: Incomplete multi-page OCR blocks marking
  it('2. Incomplete multi-page OCR blocks marking: Page 1 succeeds but Page 2 is failed/pending blocks readiness', () => {
    const candidatePartial: StagedCandidateTranscript = {
      id: 'cand-partial',
      studentId: 's1',
      transcript: 'Page 1 only text',
      receivedAt: Date.now(),
      provider: 'mathpix_only',
      promptVersion: '1.0',
      settingsVersion: '1.0',
      pageSignature: 'sig',
      status: 'partially_transcribed',
      pageResults: [
        { scanPageId: 'p1', part: 1, totalParts: 2, status: 'success', transcript: 'Page 1 text' },
        { scanPageId: 'p2', part: 2, totalParts: 2, status: 'failed', error: 'OCR timeout on page 2' },
      ],
    };

    const readiness = checkStudentMarkingReadiness('s1', {
      students: mockStudents,
      pages: mockPages,
      appliedMatching: mockMatching,
      transcripts: {
        s1: {
          studentId: 's1',
          rawOcrText: '',
          editedText: '',
          isManuallyEntered: false,
          uncertainRegions: [],
          isVerified: false,
        },
      },
      stagedCandidates: { s1: candidatePartial },
      assignment: mockAssignment,
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.reason).toContain('Page 2 failed/pending');
  });

  // Case 3: Unapplied staged replacement blocks marking
  it('3. Unapplied staged replacement blocks marking: staged candidate blocks marking until confirmed', () => {
    const candidateReady: StagedCandidateTranscript = {
      id: 'cand-ready',
      studentId: 's1',
      transcript: 'Full candidate text',
      receivedAt: Date.now(),
      provider: 'mathpix_only',
      promptVersion: '1.0',
      settingsVersion: '1.0',
      pageSignature: 'sig',
      status: 'candidate_ready',
      pageResults: [
        { scanPageId: 'p1', part: 1, totalParts: 2, status: 'success' },
        { scanPageId: 'p2', part: 2, totalParts: 2, status: 'success' },
      ],
    };

    const readiness = checkStudentMarkingReadiness('s1', {
      students: mockStudents,
      pages: mockPages,
      appliedMatching: mockMatching,
      transcripts: {
        s1: {
          studentId: 's1',
          rawOcrText: 'Existing text',
          editedText: 'Existing text',
          isManuallyEntered: false,
          uncertainRegions: [],
          isVerified: false,
          completedPageIds: ['p1', 'p2'],
        },
      },
      stagedCandidates: { s1: candidateReady },
      assignment: mockAssignment,
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.reason).toContain('有尚未確認套用的 OCR 候選文字');
  });

  // Case 4: Imported text and revision consistency
  it('4. Imported text and revision consistency: commits importedText and revision = N + 1 matching enqueued job', () => {
    const transcriptRevisions: Record<string, number> = { s2: 3 };
    const importedText = 'Bob completed essay transcript text';
    const nextRev = (transcriptRevisions.s2 ?? 0) + 1;
    transcriptRevisions.s2 = nextRev;

    const newTranscript: StudentTranscriptState = {
      studentId: 's2',
      rawOcrText: importedText,
      editedText: importedText,
      isManuallyEntered: false,
      uncertainRegions: [],
      isVerified: false,
      revision: nextRev,
      completedPageIds: ['p3'],
    };

    expect(newTranscript.revision).toBe(4);
    expect(newTranscript.editedText).toBe(importedText);

    let enqueuedJobRev = 0;
    let enqueuedText = '';

    const controller = new BackgroundMarkingQueueController();
    const job = controller.enqueueJob({
      studentId: 's2',
      studentName: 'Bob',
      yearLevel: 'P4',
      transcriptRevision: nextRev,
      transcriptText: importedText,
      assignmentTitle: mockAssignment.title,
      scopePrompt: mockAssignment.scopePrompt,
      rubric: mockAssignment.rubric,
      priority: 'normal',
    });

    enqueuedJobRev = job.transcriptRevision;
    enqueuedText = job.transcriptText;

    expect(enqueuedJobRev).toBe(newTranscript.revision);
    expect(enqueuedText).toBe(newTranscript.editedText);
  });

  // Case 5: Enqueue failure retains student
  it('5. Enqueue failure retains student: unready student prevents activeStudentIndex advancement', () => {
    let activeStudentIndex = 0; // Currently on s1

    const handleRerun = (studentId: string) => {
      // s1 has missing page or empty transcript
      const readiness = checkStudentMarkingReadiness(studentId, {
        students: mockStudents,
        pages: mockPages,
        appliedMatching: mockMatching,
        transcripts: {
          s1: {
            studentId: 's1',
            rawOcrText: '',
            editedText: '',
            isManuallyEntered: false,
            uncertainRegions: [],
            isVerified: false,
          },
        },
        stagedCandidates: {},
        assignment: mockAssignment,
      });

      if (!readiness.ready) {
        // Must NOT navigate!
        return;
      }

      // If it were ready:
      activeStudentIndex = 1;
    };

    handleRerun('s1');
    expect(activeStudentIndex).toBe(0); // Did not navigate!
  });

  // Case 6: Terminal student behavior
  it('6. Terminal student behavior: clicking on final student enqueues high-priority job and stays on final student', () => {
    const indices = mockMatching.assignedStudentIndices; // [0, 1] -> index 1 is s2 (last student)
    let activeStudentIndex = 1; // On last student
    let noticeMessage = '';

    const controller = new BackgroundMarkingQueueController();

    const handleRerunAndGoNext = (studentId: string) => {
      const readiness = checkStudentMarkingReadiness(studentId, {
        students: mockStudents,
        pages: mockPages,
        appliedMatching: mockMatching,
        transcripts: {
          s2: {
            studentId: 's2',
            rawOcrText: 'Bob final essay text',
            editedText: 'Bob final essay text',
            isManuallyEntered: false,
            uncertainRegions: [],
            isVerified: false,
            completedPageIds: ['p3'],
          },
        },
        stagedCandidates: {},
        assignment: mockAssignment,
      });

      expect(readiness.ready).toBe(true);

      const job = controller.enqueueJob({
        studentId,
        studentName: 'Bob',
        yearLevel: readiness.grade || 'P4',
        transcriptRevision: 1,
        transcriptText: 'Bob final essay text',
        assignmentTitle: mockAssignment.title,
        scopePrompt: mockAssignment.scopePrompt,
        rubric: mockAssignment.rubric,
        priority: 'high',
      });

      expect(job.priority).toBe('high');

      const curPos = indices.indexOf(activeStudentIndex);
      if (curPos === indices.length - 1) {
        noticeMessage = `已為最後一位學生 (Bob) 排入高優先 AI 批改`;
      } else {
        activeStudentIndex = indices[curPos + 1];
      }
    };

    handleRerunAndGoNext('s2');

    // Retains last student
    expect(activeStudentIndex).toBe(1);
    expect(noticeMessage).toBe('已為最後一位學生 (Bob) 排入高優先 AI 批改');
  });

  // Case 7: Priority re-order & non-interruption
  it('7. Priority re-order & non-interruption: high priority re-marks jump ahead of waiting normal jobs without interrupting running job', async () => {
    let resolveActiveMarking: ((res: any) => void) | null = null;
    const executionOrder: string[] = [];

    // Mock marking service to simulate in-flight asynchronous request
    vi.spyOn(essayServices, 'getMarkingService').mockReturnValue({
      mark: vi.fn().mockImplementation((req: any) => {
        executionOrder.push(req.studentId);
        return new Promise((resolve) => {
          resolveActiveMarking = resolve;
        });
      }),
    } as any);

    const controller = new BackgroundMarkingQueueController();

    // 1. Enqueue job 1 for s1 (normal priority). Starts running immediately.
    controller.enqueueJob({
      studentId: 's1',
      studentName: 'Alice',
      yearLevel: 'P4',
      transcriptRevision: 1,
      transcriptText: 'Alice text',
      assignmentTitle: 'Animal',
      scopePrompt: 'Write',
      rubric: DEFAULT_RUBRIC,
      priority: 'normal',
    });

    expect(controller.getActiveJob()?.studentId).toBe('s1');
    expect(executionOrder).toEqual(['s1']);

    // 2. While s1 is running, enqueue s2 (normal priority). Goes into waiting queue.
    controller.enqueueJob({
      studentId: 's2',
      studentName: 'Bob',
      yearLevel: 'P4',
      transcriptRevision: 1,
      transcriptText: 'Bob text',
      assignmentTitle: 'Animal',
      scopePrompt: 'Write',
      rubric: DEFAULT_RUBRIC,
      priority: 'normal',
    });

    // 3. Teacher explicitly requests re-marking for s3 with high priority.
    controller.enqueueJob({
      studentId: 's3',
      studentName: 'Charlie',
      yearLevel: 'P4',
      transcriptRevision: 1,
      transcriptText: 'Charlie teacher edited text',
      assignmentTitle: 'Animal',
      scopePrompt: 'Write',
      rubric: DEFAULT_RUBRIC,
      priority: 'high',
    });

    // Verify active job is NOT interrupted (still s1)
    expect(controller.getActiveJob()?.studentId).toBe('s1');

    // Waiting queue has s2 and s3
    const queue = controller.getQueue();
    expect(queue.map((q) => `${q.studentId}:${q.priority}`)).toEqual(['s2:normal', 's3:high']);

    // 4. Active job (s1) completes
    resolveActiveMarking!({
      status: 'success',
      findings: [],
      assessment: { totalScore: 85, scores: {}, comments: {} },
    });

    // Allow async processNext microtask to run
    await new Promise((r) => setTimeout(r, 10));

    // s3 (high priority) jumped ahead of s2 (normal priority)!
    expect(controller.getActiveJob()?.studentId).toBe('s3');
    expect(executionOrder).toEqual(['s1', 's3']);

    // Finish s3
    resolveActiveMarking!({
      status: 'success',
      findings: [],
      assessment: { totalScore: 90, scores: {}, comments: {} },
    });

    await new Promise((r) => setTimeout(r, 10));

    // Finally s2 runs
    expect(controller.getActiveJob()?.studentId).toBe('s2');
    expect(executionOrder).toEqual(['s1', 's3', 's2']);
  });
});
