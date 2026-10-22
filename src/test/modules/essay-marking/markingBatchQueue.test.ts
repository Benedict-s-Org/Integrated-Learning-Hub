import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateBatchMarkingEligibility,
  buildStudentFullEssayText,
  persistBatchState,
  loadPersistedBatchState,
  clearPersistedBatchState,
  BatchRunState,
} from '@/modules/essay-marking/utils/markingBatchQueue';
import {
  ProcessedStudentScan,
  StudentRosterItem,
  RubricCriteria,
} from '@/modules/essay-marking/types';

describe('markingBatchQueue', () => {
  const mockStudents: StudentRosterItem[] = [
    { id: 's1', name: 'Alice', studentNumber: '001', grade: 'P4', className: 'A' },
    { id: 's2', name: 'Bob', studentNumber: '002', grade: 'P4', className: 'A' },
    { id: 's3', name: 'Charlie', studentNumber: '003', grade: 'P4', className: 'A' },
    { id: 's4', name: 'David', studentNumber: '004', grade: 'P4', className: 'A' },
  ];

  const mockRubrics: RubricCriteria[] = [
    { id: 'r1', name: 'Grammar', maxScore: 10, description: 'Grammar accuracy' },
  ];

  beforeEach(() => {
    localStorage.clear();
  });

  describe('evaluateBatchMarkingEligibility', () => {
    it('correctly partitions students into eligible, already_marked, and ineligible with clear reasons', () => {
      const mockPages = [
        { id: 'p1', fileName: 'demo.pdf', pageNumber: 1, originalImageUrl: 'data:image/png;base64,1' },
        { id: 'p2', fileName: 'demo.pdf', pageNumber: 2, originalImageUrl: 'data:image/png;base64,2' },
        { id: 'p3', fileName: 'demo.pdf', pageNumber: 3, originalImageUrl: 'data:image/png;base64,3' },
        { id: 'p4', fileName: 'demo.pdf', pageNumber: 4, originalImageUrl: 'data:image/png;base64,4' },
      ];

      const appliedMatching = {
        map: [
          { pageIndex: 0, studentIndex: 0 }, // Alice p1
          { pageIndex: 1, studentIndex: 0 }, // Alice p2
          { pageIndex: 2, studentIndex: 1 }, // Bob p3
          { pageIndex: 3, studentIndex: 2 }, // Charlie p4
          // David has no pages
        ],
      };

      const transcripts = {
        s1: {
          rawOcrText: 'Alice line 1',
          editedText: 'Alice line 1\nAlice line 2',
          isVerified: true,
          verifiedLines: [
            { pageNumber: 1, lineNumber: 1, text: 'Alice line 1' },
            { pageNumber: 2, lineNumber: 1, text: 'Alice line 2' },
          ],
        },
        s2: {
          rawOcrText: 'Bob line 1',
          editedText: 'Bob line 1',
          isVerified: true,
          verifiedLines: [{ pageNumber: 3, lineNumber: 1, text: 'Bob line 1' }],
        },
        s3: {
          rawOcrText: 'Charlie unverified',
          editedText: '',
          isVerified: false,
          verifiedLines: [],
        },
        s4: {
          rawOcrText: '',
          editedText: '',
          isVerified: false,
          verifiedLines: [],
        },
      };

      const markings = {
        s2: {
          studentId: 's2',
          overallFeedback: 'Good effort',
          criteriaScores: [],
          findings: [
            {
              id: 'f1',
              type: 'grammar' as const,
              originalText: 'Bob',
              suggestedText: 'Robert',
              explanation: 'Formal',
              pageNumber: 3,
              lineNumber: 1,
            },
          ],
        },
      };

      const result = evaluateBatchMarkingEligibility({
        students: mockStudents,
        appliedMatching,
        transcripts: transcripts as any,
        markings: markings as any,
        pages: mockPages as any,
      });

      expect(result.items).toHaveLength(4);
      expect(result.eligibleCount).toBe(2); // Alice (verified) + Charlie (provisional unverified)
      expect(result.provisionalCount).toBe(1); // Charlie
      expect(result.alreadyMarkedCount).toBe(1); // Bob
      expect(result.skippedCount).toBe(2); // Bob (already), David (no pages)

      const alice = result.items.find((i) => i.studentId === 's1');
      expect(alice?.status).toBe('pending');
      expect(alice?.isProvisional).toBe(false);
      expect(alice?.pageCount).toBe(2);

      const charlie = result.items.find((i) => i.studentId === 's3');
      expect(charlie?.status).toBe('pending');
      expect(charlie?.isProvisional).toBe(true);

      const bob = result.items.find((i) => i.studentId === 's2');
      expect(bob?.status).toBe('skipped');
      expect(bob?.skipReason).toContain('已有 1 條批改記錄');

      const david = result.items.find((i) => i.studentId === 's4');
      expect(david?.status).toBe('skipped');
      expect(david?.skipReason).toContain('尚未分配掃描頁面');

      // Strict mode when allowProvisional = false
      const strictResult = evaluateBatchMarkingEligibility({
        students: mockStudents,
        appliedMatching,
        transcripts: transcripts as any,
        markings: markings as any,
        pages: mockPages as any,
        allowProvisional: false,
      });
      expect(strictResult.eligibleCount).toBe(1); // Alice only
      expect(strictResult.skippedCount).toBe(3); // Bob, Charlie (unverified), David
      const strictCharlie = strictResult.items.find((i) => i.studentId === 's3');
      expect(strictCharlie?.status).toBe('skipped');
      expect(strictCharlie?.skipReason).toContain('未核對');
    });

    it('preserves the confirmed matched student order [2, 0, 3, 1] in batch queue items', () => {
      const mockPages = [
        { id: 'p1', fileName: 'demo.pdf', pageNumber: 1, originalImageUrl: '' },
        { id: 'p2', fileName: 'demo.pdf', pageNumber: 2, originalImageUrl: '' },
        { id: 'p3', fileName: 'demo.pdf', pageNumber: 3, originalImageUrl: '' },
        { id: 'p4', fileName: 'demo.pdf', pageNumber: 4, originalImageUrl: '' },
      ];

      // Confirmed matched order: s3 (idx 2), s1 (idx 0), s4 (idx 3), s2 (idx 1)
      const appliedMatching = {
        classId: 'A',
        counts: [1, 1, 1, 1],
        assignedStudentIndices: [2, 0, 3, 1],
        map: [
          { pageIndex: 0, studentIndex: 2, studentId: 's3' },
          { pageIndex: 1, studentIndex: 0, studentId: 's1' },
          { pageIndex: 2, studentIndex: 3, studentId: 's4' },
          { pageIndex: 3, studentIndex: 1, studentId: 's2' },
        ],
      };

      const transcripts = {
        s1: { rawOcrText: 'Alice', editedText: 'Alice essay', isVerified: true },
        s2: { rawOcrText: 'Bob', editedText: 'Bob essay', isVerified: true },
        s3: { rawOcrText: 'Charlie', editedText: 'Charlie essay', isVerified: true },
        s4: { rawOcrText: 'David', editedText: 'David essay', isVerified: true },
      };

      const result = evaluateBatchMarkingEligibility({
        students: mockStudents,
        appliedMatching: appliedMatching as any,
        transcripts: transcripts as any,
        markings: {},
        pages: mockPages as any,
      });

      expect(result.items).toHaveLength(4);
      // Items must be ordered strictly as [s3, s1, s4, s2]
      expect(result.items.map((i) => i.studentId)).toEqual(['s3', 's1', 's4', 's2']);
      expect(result.items.map((i) => i.studentIndex)).toEqual([2, 0, 3, 1]);
    });
  });

  describe('persistence and F5 recovery', () => {
    it('persists batch state and converts in-flight running items to interrupted on reload', () => {
      const state = {
        batchId: 'batch-test-1',
        assignmentId: 'assign-1',
        status: 'running' as const,
        totalItems: 3,
        completedCount: 1,
        failedCount: 0,
        skippedCount: 1,
        activeStudentId: 's2',
        activeStudentName: 'Bob',
        activePageCount: 1,
        stopRequested: false,
        items: [
          {
            studentId: 's1',
            studentName: 'Alice',
            pageCount: 2,
            status: 'completed' as const,
            findingsCount: 3,
          },
          {
            studentId: 's2',
            studentName: 'Bob',
            pageCount: 1,
            status: 'running' as const, // in-flight when browser reloaded
          },
          {
            studentId: 's3',
            studentName: 'Charlie',
            pageCount: 1,
            status: 'pending' as const,
          },
        ],
      };

      persistBatchState('assign-1', state);

      const rehydrated = loadPersistedBatchState('assign-1');
      expect(rehydrated).not.toBeNull();
      // Should NOT automatically keep running on F5; status should be paused
      expect(rehydrated?.status).toBe('paused');
      // In-flight 'running' item should be converted to 'interrupted'
      const bob = rehydrated?.items.find((i) => i.studentId === 's2');
      expect(bob?.status).toBe('interrupted');
      expect(bob?.error).toContain('中斷');

      // Completed items preserved
      const alice = rehydrated?.items.find((i) => i.studentId === 's1');
      expect(alice?.status).toBe('completed');
      expect(alice?.findingsCount).toBe(3);

      clearPersistedBatchState('assign-1');
      expect(loadPersistedBatchState('assign-1')).toBeNull();
    });
  });
});
