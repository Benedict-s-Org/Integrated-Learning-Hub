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
      expect(result.eligibleCount).toBe(1); // Alice
      expect(result.alreadyMarkedCount).toBe(1); // Bob
      expect(result.unverifiedCount).toBe(1); // Charlie
      expect(result.skippedCount).toBe(3); // Bob (already), Charlie (unverified), David (no pages)

      const alice = result.items.find((i) => i.studentId === 's1');
      expect(alice?.status).toBe('pending');
      expect(alice?.pageCount).toBe(2);

      const bob = result.items.find((i) => i.studentId === 's2');
      expect(bob?.status).toBe('skipped');
      expect(bob?.skipReason).toContain('已有 1 條批改記錄');

      const charlie = result.items.find((i) => i.studentId === 's3');
      expect(charlie?.status).toBe('skipped');
      expect(charlie?.skipReason).toContain('未核對');

      const david = result.items.find((i) => i.studentId === 's4');
      expect(david?.status).toBe('skipped');
      expect(david?.skipReason).toContain('尚未分配掃描頁面');
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
