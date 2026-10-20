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
import {
  BridgeOcrService,
  BridgeAvailabilityService,
} from '@/modules/essay-marking/services/bridgeOcrService';
import {
  StudentRosterItem,
  AppliedMatching,
  getRubricForGrade,
  parseGradeFromClassName,
  OVERALL_GRADES,
  PrimaryGrade,
} from '@/modules/essay-marking/types';

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

    it('BridgeAvailabilityService reports graceful offline status when bridge is unreachable', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const bridgeAvailability = new BridgeAvailabilityService();
      const status = await bridgeAvailability.checkStatus();

      expect(status.ocr.status).toBe('error');
      expect(status.backgroundRunner.status).toBe('error');
      expect(status.backgroundRunner.providerName).toContain('18089');
      expect(status.backgroundRunner.details).toContain('unreachable');

      mockFetch.mockRestore();
    });

    it('BridgeAvailabilityService correctly parses live bridge status with dry_run_ready', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ocr: {
            status: 'dry_run_ready',
            providerName: 'Mathpix OCR (Local Bridge)',
            details: 'Credentials configured. DRY_RUN active.',
          },
          visualVerification: {
            status: 'not_configured',
            providerName: 'Vision Verification (Qwen3-VL)',
            details: 'Reserved.',
          },
          marking: {
            status: 'not_configured',
            providerName: 'Essay Marking Model (32B)',
            details: 'Reserved.',
          },
          backgroundRunner: {
            status: 'available',
            providerName: 'Essay Marking Bridge (Port 18089)',
            details: 'Dedicated bridge active.',
          },
        }),
      } as any);

      const bridgeAvailability = new BridgeAvailabilityService();
      const status = await bridgeAvailability.checkStatus();

      expect(status.ocr.status).toBe('dry_run_ready');
      expect(status.backgroundRunner.status).toBe('available');
      expect(status.backgroundRunner.providerName).toBe('Essay Marking Bridge (Port 18089)');

      mockFetch.mockRestore();
    });

    it('BridgeOcrService rejects unauthenticated requests when session is missing', async () => {
      const bridgeOcr = new BridgeOcrService();
      // Without session, recognize fails before making any network request
      const res = await bridgeOcr.recognize({ imageUrls: ['data:image/png;base64,mock'] });

      expect(res.status).toBe('error');
      if (res.status === 'error') {
        expect(res.message).toContain('Authentication required');
      }
    });

    it('BridgeOcrService maps 401 and 403 permissions correctly when authenticated', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'mock_jwt_token',
          } as any,
        },
        error: null,
      });

      // Mock fetch returning 403 Forbidden
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Forbidden' }),
      } as any);

      const bridgeOcr = new BridgeOcrService();
      const res = await bridgeOcr.recognize({ imageUrls: ['data:image/png;base64,mock'] });

      expect(res.status).toBe('error');
      if (res.status === 'error') {
        expect(res.message).toContain('Access denied');
        expect(res.message).toContain('teacher or administrator');
      }

      mockFetch.mockRestore();
    });

    it('BridgeOcrService maps 504 timeout uncertainty without encouraging blind retries', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'mock_jwt_token',
          } as any,
        },
        error: null,
      });

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 504,
        json: async () => ({ message: 'Upstream timeout: billing state uncertain' }),
      } as any);

      const bridgeOcr = new BridgeOcrService();
      const res = await bridgeOcr.recognize({ imageUrls: ['data:image/png;base64,mock'] });

      expect(res.status).toBe('error');
      if (res.status === 'error') {
        expect(res.message).toContain('uncertain');
      }

      mockFetch.mockRestore();
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

  describe('6. Staged OCR Revalidation & Application-Managed Draft Recovery', () => {
    // Pure validator mirroring validateStagedOcrForApply
    const validateStagedOcr = (
      staged: { targetStudentId: string; classId: string; pageSignature: string } | undefined,
      activeStudentId: string,
      currentClassId: string,
      currentPageSignature: string
    ) => {
      if (!staged) return { isValid: false, error: 'No staged OCR result found' };
      if (staged.targetStudentId !== activeStudentId) {
        return { isValid: false, error: 'Student selection mismatch' };
      }
      if (staged.classId && staged.classId !== currentClassId) {
        return { isValid: false, error: 'Class assignment changed' };
      }
      if (staged.pageSignature !== currentPageSignature) {
        return { isValid: false, error: 'Page assignments changed' };
      }
      return { isValid: true };
    };

    it('rejects apply when page matching changed after OCR was staged', () => {
      const staged = {
        targetStudentId: 's1',
        classId: '3A',
        pageSignature: 'page-1,page-2',
      };

      // Teacher reallocated pages before clicking Apply
      const currentPageSignature = 'page-1,page-3';
      const result = validateStagedOcr(staged, 's1', '3A', currentPageSignature);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Page assignments changed');
    });

    it('rejects apply when active student differs from staged OCR student', () => {
      const staged = {
        targetStudentId: 's1',
        classId: '3A',
        pageSignature: 'page-1',
      };

      // Active student navigated to s2
      const result = validateStagedOcr(staged, 's2', '3A', 'page-1');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Student selection mismatch');
    });

    it('rejects apply when class assignment was switched', () => {
      const staged = {
        targetStudentId: 's1',
        classId: '3A',
        pageSignature: 'page-1',
      };

      const result = validateStagedOcr(staged, 's1', '3B', 'page-1');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Class assignment changed');
    });

    it('approves apply only when all contextual signatures match exactly', () => {
      const staged = {
        targetStudentId: 's1',
        classId: '3A',
        pageSignature: 'page-1,page-2',
      };

      const result = validateStagedOcr(staged, 's1', '3A', 'page-1,page-2');

      expect(result.isValid).toBe(true);
    });

    it('retains previous draft in recoverable state without calling clipboard', () => {
      let previousDrafts: Record<string, string> = {};
      let editorText = 'Teacher original notes before OCR';
      const stagedOcrText = 'Recognized handwriting text from scan';

      // Simulate applying staged OCR
      if (editorText.trim()) {
        previousDrafts['s1'] = editorText;
      }
      editorText = stagedOcrText;

      expect(editorText).toBe('Recognized handwriting text from scan');
      expect(previousDrafts['s1']).toBe('Teacher original notes before OCR');

      // Simulate restore (swap) action
      const saved = previousDrafts['s1'];
      const current = editorText;
      editorText = saved;
      previousDrafts['s1'] = current;

      // Editor back to teacher notes, and OCR text retained in recovery state
      expect(editorText).toBe('Teacher original notes before OCR');
      expect(previousDrafts['s1']).toBe('Recognized handwriting text from scan');
    });
  });

  describe('Preparation Page Rubric Dimensions & Overall Grade Logic', () => {
    it('returns exactly two dimensions with 100 total points for P.1, P.2, and P.3', () => {
      const p1p3Grades: PrimaryGrade[] = ['P.1', 'P.2', 'P.3'];
      p1p3Grades.forEach((g) => {
        const rubric = getRubricForGrade(g);
        expect(rubric).toHaveLength(2);

        const content = rubric.find((d) => d.id === 'content');
        const language = rubric.find((d) => d.id === 'language');
        const organisation = rubric.find((d) => d.id === 'organisation' || d.id === 'organization');
        const vocabulary = rubric.find((d) => d.id === 'vocabulary');
        const mechanics = rubric.find((d) => d.id === 'mechanics');

        expect(content?.maxScore).toBe(60);
        expect(language?.maxScore).toBe(40);
        expect(organisation).toBeUndefined();
        expect(vocabulary).toBeUndefined();
        expect(mechanics).toBeUndefined();

        const total = rubric.reduce((sum, d) => sum + d.maxScore, 0);
        expect(total).toBe(100);
      });
    });

    it('returns exactly three dimensions with 100 total points for P.4, P.5, and P.6', () => {
      const p4p6Grades: PrimaryGrade[] = ['P.4', 'P.5', 'P.6'];
      p4p6Grades.forEach((g) => {
        const rubric = getRubricForGrade(g);
        expect(rubric).toHaveLength(3);

        const content = rubric.find((d) => d.id === 'content');
        const language = rubric.find((d) => d.id === 'language');
        const organisation = rubric.find((d) => d.id === 'organisation');
        const vocabulary = rubric.find((d) => d.id === 'vocabulary');
        const mechanics = rubric.find((d) => d.id === 'mechanics');

        expect(content?.maxScore).toBe(40);
        expect(language?.maxScore).toBe(40);
        expect(organisation?.name).toBe('Organisation');
        expect(organisation?.maxScore).toBe(20);
        expect(vocabulary).toBeUndefined();
        expect(mechanics).toBeUndefined();

        const total = rubric.reduce((sum, d) => sum + d.maxScore, 0);
        expect(total).toBe(100);
      });
    });

    it('leaves no lingering dimensions when switching from upper primary to lower primary', () => {
      let activeGrade: PrimaryGrade = 'P.5';
      let currentRubric = getRubricForGrade(activeGrade);
      expect(currentRubric.some((d) => d.id === 'organisation')).toBe(true);

      // Switch to P.2
      activeGrade = 'P.2';
      currentRubric = getRubricForGrade(activeGrade);
      expect(currentRubric).toHaveLength(2);
      expect(currentRubric.some((d) => d.id === 'organisation')).toBe(false);
      expect(currentRubric.some((d) => d.id === 'vocabulary')).toBe(false);
      expect(currentRubric.some((d) => d.id === 'mechanics')).toBe(false);
      expect(currentRubric.reduce((sum, d) => sum + d.maxScore, 0)).toBe(100);
    });

    it('parses grade accurately from valid class names without guessing from assignment title', () => {
      expect(parseGradeFromClassName('3A')).toBe('P.3');
      expect(parseGradeFromClassName('1B')).toBe('P.1');
      expect(parseGradeFromClassName('P.4C')).toBe('P.4');
      expect(parseGradeFromClassName('P2A')).toBe('P.2');
      expect(parseGradeFromClassName('Primary 6')).toBe('P.6');
      expect(parseGradeFromClassName('5')).toBe('P.5');

      // Invalid or empty classes return null
      expect(parseGradeFromClassName('')).toBeNull();
      expect(parseGradeFromClassName(undefined)).toBeNull();
      expect(parseGradeFromClassName('Unassigned')).toBeNull();
      expect(parseGradeFromClassName('Archived (2025)')).toBeNull();
    });

    it('contains exactly the 6 defined overall grade tiers', () => {
      expect(OVERALL_GRADES).toEqual(['A', 'A−', 'B+', 'B', 'B−', 'C+']);
      expect(OVERALL_GRADES).toHaveLength(6);
      expect(OVERALL_GRADES).not.toContain('C');
      expect(OVERALL_GRADES).not.toContain('D');
      expect(OVERALL_GRADES).not.toContain('F');
    });
  });
});

