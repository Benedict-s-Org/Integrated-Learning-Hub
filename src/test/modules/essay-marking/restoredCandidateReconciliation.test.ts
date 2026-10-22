import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateRestoredCandidateImport,
  reconcileRestoredCandidates,
} from '@/modules/essay-marking/utils/backgroundMarkingQueue';
import { computeStudentPageSignature } from '@/modules/essay-marking/utils/transcriptionBatchQueue';
import {
  StudentRosterItem,
  ScanPage,
  AppliedMatching,
  StudentTranscriptState,
  StagedCandidateTranscript,
} from '@/modules/essay-marking/types';

describe('restoredCandidateReconciliation regression suite', () => {
  const mockStudents: StudentRosterItem[] = [
    { id: 's1', displayName: 'Alice', classNumber: 1, className: '4A' },
    { id: 's2', displayName: 'Bob', classNumber: 2, className: '4A' },
  ];

  const mockPages: ScanPage[] = [
    { id: 'p1', fileName: 'scan1.png', orderIndex: 0, previewUrl: 'data:image/png;base64,1' } as ScanPage,
    { id: 'p2', fileName: 'scan2.png', orderIndex: 1, previewUrl: 'data:image/png;base64,2' } as ScanPage,
    { id: 'p3', fileName: 'scan3.png', orderIndex: 2, previewUrl: 'data:image/png;base64,3' } as ScanPage,
  ];

  const mockMatching: AppliedMatching = {
    classId: 'c1',
    mode: 'recognition',
    timestamp: Date.now(),
    studentPageOrders: {
      s1: ['p1', 'p2'],
      s2: ['p3'],
    },
    map: [
      { studentIndex: 0, part: 1, total: 2, isConfident: true },
      { studentIndex: 0, part: 2, total: 2, isConfident: true },
      { studentIndex: 1, part: 1, total: 1, isConfident: true },
    ],
    assignedStudentIndices: [0, 1],
  };

  const makeCandidate = (
    overrides: Partial<StagedCandidateTranscript> = {}
  ): StagedCandidateTranscript => ({
    id: 'cand-s1',
    studentId: 's1',
    transcript: 'Once upon a time there was a student.',
    receivedAt: Date.now(),
    provider: 'mathpix_only',
    promptVersion: '1.0',
    settingsVersion: '1.0',
    pageSignature: computeStudentPageSignature(0, mockMatching, mockPages),
    status: 'candidate_ready',
    pageResults: [
      { scanPageId: 'p1', part: 1, totalParts: 2, status: 'success', transcript: 'Once upon a time there was a student.' },
      { scanPageId: 'p2', part: 2, totalParts: 2, status: 'success', transcript: 'The end.' },
    ],
    ...overrides,
  });

  const makeContext = (
    transcripts: Record<string, StudentTranscriptState> = {}
  ) => ({
    students: mockStudents,
    pages: mockPages,
    appliedMatching: mockMatching,
    transcripts,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Valid restored candidate imports exactly once with a single marking job', () => {
    const candidate = makeCandidate();
    const onImport = vi.fn();

    const result = reconcileRestoredCandidates(
      { s1: candidate },
      makeContext(),
      new Set<string>(),
      onImport
    );

    expect(result.imported).toEqual(['s1']);
    expect(result.skipped).toEqual([]);
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport).toHaveBeenCalledWith('s1', candidate);
  });

  it('2. Stale restored candidate remains unapplied with a visible reason', () => {
    const candidate = makeCandidate({ pageSignature: 'WRONG_SIGNATURE' });

    const decision = evaluateRestoredCandidateImport('s1', candidate, makeContext());
    expect(decision).toEqual({
      action: 'keep_staged',
      reason: '候選文字已過時（頁面分配已變更）',
    });

    const onImport = vi.fn();
    const result = reconcileRestoredCandidates(
      { s1: candidate },
      makeContext(),
      new Set<string>(),
      onImport
    );

    expect(result.imported).toEqual([]);
    expect(result.skipped).toEqual([
      { studentId: 's1', reason: '候選文字已過時（頁面分配已變更）' },
    ]);
    expect(onImport).not.toHaveBeenCalled();
  });

  it('3. Existing teacher text remains intact (never overwritten)', () => {
    const existingTranscript: StudentTranscriptState = {
      studentId: 's1',
      rawOcrText: 'Original OCR text',
      editedText: 'Teacher edited text',
      isManuallyEntered: true,
      uncertainRegions: [],
      isVerified: false,
      revision: 3,
    };
    const candidate = makeCandidate();

    const decision = evaluateRestoredCandidateImport('s1', candidate, makeContext({ s1: existingTranscript }));
    expect(decision.action).toBe('keep_staged');
    expect(decision.reason).toBe('謄本已有文字，避免覆蓋教師編輯');

    const onImport = vi.fn();
    const result = reconcileRestoredCandidates(
      { s1: candidate },
      makeContext({ s1: existingTranscript }),
      new Set<string>(),
      onImport
    );

    expect(result.imported).toEqual([]);
    expect(onImport).not.toHaveBeenCalled();
    // Transcript object must be untouched.
    expect(existingTranscript.editedText).toBe('Teacher edited text');
    expect(existingTranscript.revision).toBe(3);
  });

  it('4. Repeated reconciliation produces no duplicate imports or marking jobs', () => {
    const candidate = makeCandidate();
    const reconciledIds = new Set<string>();
    const onImport = vi.fn();

    const first = reconcileRestoredCandidates(
      { s1: candidate },
      makeContext(),
      reconciledIds,
      onImport
    );
    expect(first.imported).toEqual(['s1']);
    expect(onImport).toHaveBeenCalledTimes(1);

    // Simulate the effect re-running with the same staged candidate and ref set.
    const second = reconcileRestoredCandidates(
      { s1: candidate },
      makeContext(),
      reconciledIds,
      onImport
    );
    expect(second.imported).toEqual([]);
    expect(second.skipped).toEqual([]);
    expect(onImport).toHaveBeenCalledTimes(1);
  });
});
