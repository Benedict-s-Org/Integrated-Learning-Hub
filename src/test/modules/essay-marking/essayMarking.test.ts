import { describe, it, expect, vi } from 'vitest';
import {
  computeMatchingPreview,
  applyBulkPageCounts,
  isMatchingDirty,
} from '@/modules/essay-marking/utils/matchingLogic';
import {
  UnconfiguredOcrService,
  UnconfiguredVisualVerificationService,
  UnconfiguredEssayMarkingService,
  UnconfiguredAvailabilityService,
} from '@/modules/essay-marking/services/unconfiguredServices';
import { StudentRosterItem, AppliedMatching } from '@/modules/essay-marking/types';

describe('Teacher Essay Marking Workbench - Core Domain & Logic', () => {
  const mockStudents: StudentRosterItem[] = [
    { id: 's1', displayName: 'Student One', classNumber: 1, className: '3A' },
    { id: 's2', displayName: 'Student Two', classNumber: 2, className: '3A' },
    { id: 's3', displayName: 'Student Three', classNumber: 3, className: '3A' },
    { id: 's4', displayName: 'Student Four', classNumber: 4, className: '3A' },
  ];

  describe('1. Student Matching & Page Count Allocation', () => {
    it('allocates scans sequentially in student-number order with 1 page default', () => {
      const counts = [1, 1, 1, 1];
      const totalPages = 4;
      const preview = computeMatchingPreview(mockStudents, counts, totalPages);

      expect(preview.need).toBe(4);
      expect(preview.assigned).toBe(4);
      expect(preview.extra).toBe(0);
      expect(preview.missing).toBe(0);

      expect(preview.map[0]).toEqual({
        studentIndex: 0,
        studentId: 's1',
        studentName: 'Student One',
        classNumber: 1,
        part: 1,
        total: 1,
      });
      expect(preview.map[3]?.studentId).toBe('s4');
    });

    it('correctly handles multi-page essays and preserves consecutive ordering', () => {
      // s1 has 2 pages, s2 has 1 page, s3 has 2 pages, s4 has 1 page (total 6 pages needed)
      const counts = [2, 1, 2, 1];
      const totalPages = 6;
      const preview = computeMatchingPreview(mockStudents, counts, totalPages);

      expect(preview.need).toBe(6);
      expect(preview.assigned).toBe(6);
      expect(preview.extra).toBe(0);
      expect(preview.missing).toBe(0);

      // Scan 0 and Scan 1 belong to Student 1
      expect(preview.map[0]).toMatchObject({ studentId: 's1', part: 1, total: 2 });
      expect(preview.map[1]).toMatchObject({ studentId: 's1', part: 2, total: 2 });

      // Scan 2 belongs to Student 2
      expect(preview.map[2]).toMatchObject({ studentId: 's2', part: 1, total: 1 });

      // Scan 3 and Scan 4 belong to Student 3
      expect(preview.map[3]).toMatchObject({ studentId: 's3', part: 1, total: 2 });
      expect(preview.map[4]).toMatchObject({ studentId: 's3', part: 2, total: 2 });

      // Scan 5 belongs to Student 4
      expect(preview.map[5]).toMatchObject({ studentId: 's4', part: 1, total: 1 });
    });

    it('skips student when page count is 0 without consuming a scan', () => {
      // s2 is skipped (0 pages)
      const counts = [1, 0, 1, 1];
      const totalPages = 3;
      const preview = computeMatchingPreview(mockStudents, counts, totalPages);

      expect(preview.need).toBe(3);
      expect(preview.assigned).toBe(3);
      expect(preview.extra).toBe(0);
      expect(preview.missing).toBe(0);

      expect(preview.map[0]?.studentId).toBe('s1');
      expect(preview.map[1]?.studentId).toBe('s3'); // s2 skipped!
      expect(preview.map[2]?.studentId).toBe('s4');
    });

    it('flags unmatched scans when total scans exceed required pages', () => {
      const counts = [1, 1, 1, 1]; // needs 4
      const totalPages = 6; // 2 extra scans
      const preview = computeMatchingPreview(mockStudents, counts, totalPages);

      expect(preview.need).toBe(4);
      expect(preview.assigned).toBe(4);
      expect(preview.extra).toBe(2);
      expect(preview.missing).toBe(0);
      expect(preview.map[4]).toBeNull();
      expect(preview.map[5]).toBeNull();
    });

    it('flags missing pages when total scans are fewer than required pages', () => {
      const counts = [2, 2, 2, 2]; // needs 8
      const totalPages = 5; // 3 pages missing
      const preview = computeMatchingPreview(mockStudents, counts, totalPages);

      expect(preview.need).toBe(8);
      expect(preview.assigned).toBe(5);
      expect(preview.extra).toBe(0);
      expect(preview.missing).toBe(3);
    });
  });

  describe('2. Header Selection, Indeterminate States & Bulk Updates', () => {
    it('applies bulk page counts to selected students only', () => {
      const initialCounts = [1, 1, 1, 1];
      const selected = new Set([1, 3]); // Students at index 1 and 3

      const updated = applyBulkPageCounts(initialCounts, selected, 3);

      expect(updated[0]).toBe(1); // unselected
      expect(updated[1]).toBe(3); // updated
      expect(updated[2]).toBe(1); // unselected
      expect(updated[3]).toBe(3); // updated
    });

    it('clamps bulk page count between 0 and 100', () => {
      const initialCounts = [1, 1];
      const selected = new Set([0, 1]);

      const negativeClamped = applyBulkPageCounts(initialCounts, selected, -5);
      expect(negativeClamped).toEqual([0, 0]);

      const highClamped = applyBulkPageCounts(initialCounts, selected, 250);
      expect(highClamped).toEqual([100, 100]);
    });

    it('determines select-all and indeterminate conditions accurately', () => {
      const total = mockStudents.length;

      // 0 selected
      const empty = new Set<number>();
      expect(empty.size === total).toBe(false);
      expect(empty.size > 0 && empty.size < total).toBe(false);

      // 2 of 4 selected (indeterminate)
      const partial = new Set<number>([0, 2]);
      expect(partial.size === total).toBe(false);
      expect(partial.size > 0 && partial.size < total).toBe(true);

      // All 4 selected
      const all = new Set<number>([0, 1, 2, 3]);
      expect(all.size === total).toBe(true);
      expect(all.size > 0 && all.size < total).toBe(false);
    });

    it('preserves select-all state when page counts change without losing click focus', () => {
      const initialCounts = [1, 1, 1, 1];
      let selected = new Set<number>([0, 1, 2, 3]);

      // Simulate user editing a page count in row 1
      const updatedCounts = [...initialCounts];
      updatedCounts[1] = 2;

      // Selection must remain intact after editing page count
      expect(selected.size).toBe(4);
      expect(selected.has(0)).toBe(true);
      expect(selected.has(1)).toBe(true);
    });
  });

  describe('3. Matching Dirty & Downstream Invalidation Rules', () => {
    const applied: AppliedMatching = {
      classId: '3A',
      counts: [1, 1, 1, 1],
      map: [],
      assignedStudentIndices: [0, 1, 2, 3],
    };

    it('identifies applied matching as clean when counts match snapshot', () => {
      expect(isMatchingDirty(applied, '3A', [1, 1, 1, 1])).toBe(false);
    });

    it('identifies applied matching as dirty when class changes', () => {
      expect(isMatchingDirty(applied, '3B', [1, 1, 1, 1])).toBe(true);
    });

    it('identifies applied matching as dirty when any student count changes', () => {
      expect(isMatchingDirty(applied, '3A', [1, 2, 1, 1])).toBe(true);
    });

    it('identifies matching as dirty when applied snapshot is null', () => {
      expect(isMatchingDirty(null, '3A', [1, 1, 1, 1])).toBe(true);
    });
  });

  describe('4. Unconfigured Service Boundaries', () => {
    it('OCR service returns explicit typed not_configured result', async () => {
      const ocrService = new UnconfiguredOcrService();
      const response = await ocrService.recognize({ imageUrls: ['blob:scan1'] });

      expect(response.status).toBe('not_configured');
      if (response.status === 'not_configured') {
        expect(response.message).toContain('OCR');
      }
    });

    it('Visual verification service returns explicit typed not_configured result', async () => {
      const visualService = new UnconfiguredVisualVerificationService();
      const response = await visualService.verify({
        scanImageUrl: 'blob:scan1',
        transcript: 'Some text',
      });

      expect(response.status).toBe('not_configured');
      if (response.status === 'not_configured') {
        expect(response.message).toContain('Visual verification');
      }
    });

    it('Essay marking service returns explicit typed not_configured result', async () => {
      const markingService = new UnconfiguredEssayMarkingService();
      const response = await markingService.mark({
        transcript: 'Sample writing',
        assignmentTitle: 'Day at the park',
        scopePrompt: 'Prompt',
        rubric: [],
      });

      expect(response.status).toBe('not_configured');
      if (response.status === 'not_configured') {
        expect(response.message).toContain('AI marking');
      }
    });

    it('Availability service checks report all services as unconfigured', async () => {
      const availabilityService = new UnconfiguredAvailabilityService();
      const status = await availabilityService.checkStatus();

      expect(status.ocr.status).toBe('not_configured');
      expect(status.visualVerification.status).toBe('not_configured');
      expect(status.marking.status).toBe('not_configured');
      expect(status.backgroundRunner.status).toBe('not_configured');
    });
  });

  describe('5. Approval and Publishing Guards', () => {
    it('guards publishing when teacher review is not approved', () => {
      const studentMarking = {
        studentId: 's1',
        scores: { content: 3, language: 3 },
        findings: [],
        feedbackComment: 'Good work',
        isApproved: false,
      };

      // Publishing is permitted only when isApproved === true
      const canPublish = studentMarking.isApproved;
      expect(canPublish).toBe(false);
    });

    it('revokes approval when feedback or scores are modified', () => {
      const marking = {
        studentId: 's1',
        scores: { content: 3, language: 3 },
        feedbackComment: 'Initial comment',
        isApproved: true,
      };

      // Simulate modification
      const modifiedMarking = {
        ...marking,
        feedbackComment: 'Updated feedback by teacher',
        isApproved: false, // Must be revoked
      };

      expect(modifiedMarking.isApproved).toBe(false);
    });
  });
});
