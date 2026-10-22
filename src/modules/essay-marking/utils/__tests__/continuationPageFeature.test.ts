import { describe, it, expect, vi } from 'vitest';
import {
  evaluatePageReadiness,
  evaluateStudentMatchingReadiness,
  isEntireScriptBlank,
  deriveStudentPageOrdersFromMatching,
  reorderStudentPages,
  assignPageToStudent,
  unassignPageFromStudent,
  recomputeMatchingFromOrders,
  normalizeRegionReadingOrder,
} from '../continuationPageLogic';
import {
  resolveWritingAreasForPage,
  buildBatchTasks,
  combineCandidateTranscript,
  computeStudentPageSignature,
} from '../transcriptionBatchQueue';
import {
  ScanPage,
  TemplateRegion,
  AppliedMatching,
  StudentRosterItem,
  PageTranscriptionResult,
  DEFAULT_TRANSCRIPTION_SETTINGS,
} from '../../types';

describe('Continuation-Page & Blank-Page Logic', () => {
  const dummyPage1: ScanPage = {
    id: 'scan-1',
    fileName: 'scan1.jpg',
    previewUrl: 'data:image/jpeg;base64,scan1',
  };

  const dummyPage2: ScanPage = {
    id: 'scan-2',
    fileName: 'scan2.jpg',
    previewUrl: 'data:image/jpeg;base64,scan2',
  };

  const dummyPage3: ScanPage = {
    id: 'scan-3',
    fileName: 'scan3.jpg',
    previewUrl: 'data:image/jpeg;base64,scan3',
  };

  const dummyPage4: ScanPage = {
    id: 'scan-4',
    fileName: 'scan4.jpg',
    previewUrl: 'data:image/jpeg;base64,scan4',
  };

  const sampleRegion1: TemplateRegion = {
    id: 'reg-1',
    x: 10,
    y: 10,
    width: 80,
    height: 35,
    type: 'writing_area',
    orderIndex: 0,
    pageNumber: 1,
  };

  const sampleRegion2: TemplateRegion = {
    id: 'reg-2',
    x: 10,
    y: 50,
    width: 80,
    height: 40,
    type: 'writing_area',
    orderIndex: 1,
  };

  describe('1. Readiness Rules & Blank Status', () => {
    it('ordinary two-page student: pages 1 and 2 are ready with default OCR', () => {
      const p1Status = evaluatePageReadiness(dummyPage1, 1);
      const p2Status = evaluatePageReadiness(dummyPage2, 2);

      expect(p1Status.isReady).toBe(true);
      expect(p1Status.status).toBe('ready_default');
      expect(p2Status.isReady).toBe(true);
      expect(p2Status.status).toBe('ready_default');
    });

    it('two-page student with blank page 2: skips OCR and is ready', () => {
      const blankPage2: ScanPage = { ...dummyPage2, isBlank: true };
      const res = evaluatePageReadiness(blankPage2, 2);

      expect(res.isReady).toBe(true);
      expect(res.status).toBe('blank_skipped');
      expect(res.message).toContain('OCR skipped');
    });

    it('continuation page 3 without custom regions is setup incomplete', () => {
      const res = evaluatePageReadiness(dummyPage3, 3);

      expect(res.isReady).toBe(false);
      expect(res.status).toBe('needs_custom_regions');
      expect(res.message).toContain('Setup required');
    });

    it('continuation page 3 with custom regions is ready', () => {
      const pageWithRegions: ScanPage = {
        ...dummyPage3,
        customRegions: [sampleRegion1, sampleRegion2],
      };
      const res = evaluatePageReadiness(pageWithRegions, 3);

      expect(res.isReady).toBe(true);
      expect(res.status).toBe('ready_custom_regions');
      expect(res.message).toContain('2 custom region(s)');
    });

    it('four-page student with blank page 4 requires no regions and is ready', () => {
      const blankPage4: ScanPage = { ...dummyPage4, isBlank: true };
      const res = evaluatePageReadiness(blankPage4, 4);

      expect(res.isReady).toBe(true);
      expect(res.status).toBe('blank_skipped');
    });

    it('reversing blank status restores the requirement for custom regions on continuation pages', () => {
      const page: ScanPage = { ...dummyPage3, isBlank: true };
      expect(evaluatePageReadiness(page, 3).isReady).toBe(true);

      const unblankedPage: ScanPage = { ...page, isBlank: false };
      expect(evaluatePageReadiness(unblankedPage, 3).isReady).toBe(false);
      expect(evaluatePageReadiness(unblankedPage, 3).status).toBe('needs_custom_regions');
    });

    it('evaluateStudentMatchingReadiness identifies incomplete continuation pages', () => {
      const students: StudentRosterItem[] = [
        { id: 's1', classNumber: 1, displayName: 'Alice' },
      ];
      const pages = [dummyPage1, dummyPage2, dummyPage3];
      const appliedMatching: AppliedMatching = {
        classId: '1A',
        counts: [3],
        assignedStudentIndices: [0],
        mode: 'sequential',
        studentPageOrders: {
          s1: ['scan-1', 'scan-2', 'scan-3'],
        },
      };

      const check = evaluateStudentMatchingReadiness(students, pages, appliedMatching);
      expect(check.isReady).toBe(false);
      expect(check.incompleteContinuationPages.length).toBe(1);
      expect(check.incompleteContinuationPages[0].studentName).toBe('Alice');
      expect(check.incompleteContinuationPages[0].part).toBe(3);
    });
  });

  describe('2. Entirely Blank Script', () => {
    it('detects when an entire script is confirmed blank', () => {
      const pages = [
        { ...dummyPage1, isBlank: true },
        { ...dummyPage2, isBlank: true },
      ];
      expect(isEntireScriptBlank(pages, ['scan-1', 'scan-2'])).toBe(true);
    });

    it('returns false if any page in the script is not blank', () => {
      const pages = [
        { ...dummyPage1, isBlank: true },
        { ...dummyPage2, isBlank: false },
      ];
      expect(isEntireScriptBlank(pages, ['scan-1', 'scan-2'])).toBe(false);
    });
  });

  describe('3. Multi-page Assignment & Page Ordering Without Shifting Others', () => {
    const students: StudentRosterItem[] = [
      { id: 's1', classNumber: 1, displayName: 'Alice' },
      { id: 's2', classNumber: 2, displayName: 'Bob' },
    ];

    const initialMatching: AppliedMatching = {
      classId: '1A',
      counts: [2, 2],
      assignedStudentIndices: [0, 1],
      mode: 'sequential',
      studentPageOrders: {
        s1: ['scan-1', 'scan-2'],
        s2: ['scan-3', 'scan-4'],
      },
    };

    it('reorders pages for student 1 without affecting student 2', () => {
      const updated = reorderStudentPages(initialMatching, 's1', 0, 1);

      expect(updated.studentPageOrders?.s1).toEqual(['scan-2', 'scan-1']);
      expect(updated.studentPageOrders?.s2).toEqual(['scan-3', 'scan-4']);
    });

    it('assigns continuation page to student 1 without altering student 2 page order or count', () => {
      const updated = assignPageToStudent(initialMatching, 's1', 'scan-extra');

      expect(updated.studentPageOrders?.s1).toEqual(['scan-1', 'scan-2', 'scan-extra']);
      expect(updated.studentPageOrders?.s2).toEqual(['scan-3', 'scan-4']);
    });

    it('unassigns page from student 1 without shifting student 2', () => {
      const updated = unassignPageFromStudent(initialMatching, 's1', 'scan-1');

      expect(updated.studentPageOrders?.s1).toEqual(['scan-2']);
      expect(updated.studentPageOrders?.s2).toEqual(['scan-3', 'scan-4']);
    });
  });

  describe('4. Region Reading Order Normalization', () => {
    it('normalizes reading order preserving explicit orderIndex or top-to-bottom layout', () => {
      const r1: TemplateRegion = { id: 'r1', x: 10, y: 50, width: 80, height: 20, type: 'writing_area', orderIndex: 1 };
      const r2: TemplateRegion = { id: 'r2', x: 10, y: 10, width: 80, height: 20, type: 'writing_area', orderIndex: 0 };

      const sorted = normalizeRegionReadingOrder([r1, r2]);
      expect(sorted[0].id).toBe('r2');
      expect(sorted[0].orderIndex).toBe(0);
      expect(sorted[1].id).toBe('r1');
      expect(sorted[1].orderIndex).toBe(1);
    });
  });

  describe('5. Downstream OCR Region Resolution & Batch Tasks', () => {
    it('returns isBlank=true and empty regions for confirmed blank page', () => {
      const blankPage: ScanPage = { ...dummyPage1, isBlank: true };
      const res = resolveWritingAreasForPage(blankPage, 1, [sampleRegion1]);

      expect(res.isBlank).toBe(true);
      expect(res.regions).toEqual([]);
      expect(res.hasError).toBe(false);
    });

    it('strictly requires custom regions on page 3+ and never falls back to full page', () => {
      const unconfiguredP3: ScanPage = { ...dummyPage3, customRegions: [] };
      const res = resolveWritingAreasForPage(unconfiguredP3, 3, [sampleRegion1]);

      expect(res.hasError).toBe(true);
      expect(res.errorMessage).toContain('requires custom OCR regions');
    });

    it('buildBatchTasks skips OCR requests for confirmed blank pages', () => {
      const students: StudentRosterItem[] = [
        { id: 's1', classNumber: 1, displayName: 'Alice' },
      ];
      const pages: ScanPage[] = [
        { ...dummyPage1, isBlank: false },
        { ...dummyPage2, isBlank: true },
      ];
      const appliedMatching: AppliedMatching = {
        classId: '1A',
        counts: [2],
        assignedStudentIndices: [0],
        mode: 'sequential',
        studentPageOrders: {
          s1: ['scan-1', 'scan-2'],
        },
      };

      const { tasks } = buildBatchTasks({
        students,
        pages,
        appliedMatching,
        transcripts: {},
        templateRegions: [sampleRegion1],
      });

      expect(tasks.length).toBe(2);
      expect(tasks[0].part).toBe(1);
      expect(tasks[0].status).toBe('pending');

      const blankTask = tasks.find((t) => t.part === 2);
      expect(blankTask).toBeDefined();
      expect(blankTask?.isBlank).toBe(true);
      expect(blankTask?.status).toBe('success');
      expect(blankTask?.transcript).toBe('');
      expect(blankTask?.regions).toEqual([]);
    });
  });

  describe('6. Transcript Assembly & Page Replacement', () => {
    it('excludes confirmed blank pages from combined transcript', () => {
      const pageResults: PageTranscriptionResult[] = [
        {
          scanPageId: 'scan-1',
          part: 1,
          totalParts: 2,
          status: 'success',
          transcript: 'First page content.',
        },
        {
          scanPageId: 'scan-2',
          part: 2,
          totalParts: 2,
          status: 'success',
          transcript: '',
          isBlank: true,
        },
      ];

      const combined = combineCandidateTranscript(
        's1',
        pageResults,
        DEFAULT_TRANSCRIPTION_SETTINGS,
        'mathpix_only',
        'sig-1'
      );

      expect(combined.transcript).toBe('First page content.');
      expect(combined.isEntireScriptBlank).toBe(false);
    });

    it('sets isEntireScriptBlank=true when all page results are blank', () => {
      const pageResults: PageTranscriptionResult[] = [
        {
          scanPageId: 'scan-1',
          part: 1,
          totalParts: 2,
          status: 'success',
          transcript: '',
          isBlank: true,
        },
        {
          scanPageId: 'scan-2',
          part: 2,
          totalParts: 2,
          status: 'success',
          transcript: '',
          isBlank: true,
        },
      ];

      const combined = combineCandidateTranscript(
        's1',
        pageResults,
        DEFAULT_TRANSCRIPTION_SETTINGS,
        'mathpix_only',
        'sig-1'
      );

      expect(combined.transcript).toBe('');
      expect(combined.isEntireScriptBlank).toBe(true);
      expect(combined.status).toBe('candidate_ready');
    });

    it('re-running a page replaces only its contribution without duplicate text', () => {
      const initialResults: PageTranscriptionResult[] = [
        {
          scanPageId: 'scan-1',
          part: 1,
          totalParts: 2,
          status: 'success',
          transcript: 'Page 1 original.',
        },
        {
          scanPageId: 'scan-2',
          part: 2,
          totalParts: 2,
          status: 'success',
          transcript: 'Page 2 initial.',
        },
      ];

      const combinedInitial = combineCandidateTranscript(
        's1',
        initialResults,
        DEFAULT_TRANSCRIPTION_SETTINGS,
        'mathpix_only',
        'sig-1'
      );
      expect(combinedInitial.transcript).toBe('Page 1 original.\nPage 2 initial.');

      const rerunResults = initialResults.map((pr) =>
        pr.part === 2 ? { ...pr, transcript: 'Page 2 re-run updated.' } : pr
      );

      const combinedRerun = combineCandidateTranscript(
        's1',
        rerunResults,
        DEFAULT_TRANSCRIPTION_SETTINGS,
        'mathpix_only',
        'sig-1'
      );

      expect(combinedRerun.transcript).toBe('Page 1 original.\nPage 2 re-run updated.');
      expect(combinedRerun.transcript).not.toContain('Page 2 initial.');
    });
  });

  describe('7. Session Persistence Compatibility', () => {
    it('older sessions missing isBlank default to unchecked/false', () => {
      const legacyPage: any = {
        id: 'legacy-p1',
        fileName: 'page1.png',
        previewUrl: 'data:img',
      };

      const readiness = evaluatePageReadiness(legacyPage, 1);
      expect(readiness.isReady).toBe(true);
      expect(readiness.status).toBe('ready_default');
    });

    it('deriveStudentPageOrdersFromMatching handles older sessions without studentPageOrders', () => {
      const legacyMatching: AppliedMatching = {
        classId: '1A',
        counts: [2],
        assignedStudentIndices: [0],
        mode: 'sequential',
        map: [
          { pageIndex: 0, studentId: 's1', studentName: 'Alice', classNumber: 1, studentIndex: 0, part: 1, total: 2 },
          { pageIndex: 1, studentId: 's1', studentName: 'Alice', classNumber: 1, studentIndex: 0, part: 2, total: 2 },
        ],
      };

      const pages = [dummyPage1, dummyPage2];
      const derived = deriveStudentPageOrdersFromMatching(legacyMatching, pages);

      expect(derived['s1']).toEqual(['scan-1', 'scan-2']);
    });
  });

  describe('8. Outdated Result Protection & Signatures', () => {
    it('signature changes when page order or custom regions change', () => {
      const pages = [dummyPage1, dummyPage2];
      const matchingA: AppliedMatching = {
        classId: '1A',
        counts: [2],
        assignedStudentIndices: [0],
        mode: 'sequential',
        studentPageOrders: { s1: ['scan-1', 'scan-2'] },
      };

      const matchingB: AppliedMatching = {
        classId: '1A',
        counts: [2],
        assignedStudentIndices: [0],
        mode: 'sequential',
        studentPageOrders: { s1: ['scan-2', 'scan-1'] },
      };

      const sigA = computeStudentPageSignature(0, matchingA, pages);
      const sigB = computeStudentPageSignature(0, matchingB, pages);

      expect(sigA).not.toBe(sigB);
    });
  });
});
