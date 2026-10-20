import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveWorkbenchSession,
  loadWorkbenchSession,
  clearWorkbenchSession,
  PersistedSessionData,
} from '@/modules/essay-marking/utils/essayMarkingStorage';

// Lightweight in-memory IDB mock for headless test environment
function setupInMemoryIndexedDB() {
  const storeMap = new Map<string, any>();

  const fakeDb = {
    objectStoreNames: {
      contains: () => true,
    },
    createObjectStore: () => {},
    transaction: () => ({
      objectStore: () => ({
        put: (val: any, key: string) => {
          storeMap.set(key, val);
          const req: any = {};
          setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
          return req;
        },
        get: (key: string) => {
          const req: any = { result: storeMap.get(key) };
          setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
          return req;
        },
        delete: (key: string) => {
          storeMap.delete(key);
          const req: any = {};
          setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
          return req;
        },
      }),
      oncomplete: null as any,
    }),
    close: () => {},
  };

  (globalThis as any).indexedDB = {
    open: () => {
      const req: any = { result: fakeDb };
      setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
      return req;
    },
  };
}

describe('essayMarkingStorage IndexedDB Persistence Layer', () => {
  beforeEach(async () => {
    setupInMemoryIndexedDB();
    await clearWorkbenchSession();
  });

  it('saves and restores full essay-marking session state', async () => {
    const mockData: Omit<PersistedSessionData, 'timestamp'> = {
      currentStep: 'ocr' as const,
      assignment: {
        id: 'asg-1',
        title: 'Dog Man Essay',
        isTitleCustomized: true,
        grade: 'P.4',
        worksheetFileName: 'worksheet.pdf',
        worksheetFile: null,
        worksheetPreviewUrl: null,
        responseFormat: 'worksheet' as const,
        scopePrompt: 'Write about a superhero',
        isConfirmed: true,
        rubric: [],
        templateRegions: [],
        transcriptionSettings: {
          version: 'v1.4' as const,
          printedLabelsMode: 'exclude' as const,
          primaryLanguage: 'en' as const,
          notes: 'Focus on ruled writing area',
          readingOrder: [],
        },
      },
      files: [],
      pages: [
        {
          id: 'page-1',
          fileId: 'file-1',
          fileName: 'page-1.png',
          sourcePageNumber: 1,
          previewUrl: 'data:image/png;base64,mockPngPreview',
          orderIndex: 0,
        },
      ],
      selectedClassId: '4A',
      studentPageCounts: [1, 1],
      selectedStudentIndices: [0, 1],
      appliedMatching: {
        classId: '4A',
        counts: [1, 1],
        map: [
          {
            studentIndex: 0,
            studentId: 'student-1',
            studentName: 'Student 1',
            classNumber: 1,
            part: 1,
            total: 1,
          },
        ],
        assignedStudentIndices: [0],
        mode: 'sequential' as const,
        contextFingerprint: 'mock_fp',
      },
      activeStudentIndex: 0,
      transcripts: {
        'student-1': {
          studentId: 'student-1',
          rawOcrText: 'Dog man is a very special cop.',
          editedText: 'Dog man is a very special cop.',
          linesWithBboxes: [{ text: 'Dog man is a very special cop.', bbox: [187, 689, 830, 725] as [number, number, number, number] }],
          isManuallyEntered: false,
          uncertainRegions: [],
          isVerified: true,
        },
      },
      markings: {
        'student-1': {
          studentId: 'student-1',
          scores: {},
          findings: [],
          feedbackComment: 'Great job!',
          isApproved: true,
        },
      },
    };

    await saveWorkbenchSession(mockData);
    const restored = await loadWorkbenchSession();

    expect(restored).not.toBeNull();
    expect(restored?.currentStep).toBe('ocr');
    expect(restored?.assignment.title).toBe('Dog Man Essay');
    expect(restored?.pages[0].previewUrl).toBe('data:image/png;base64,mockPngPreview');
    expect(restored?.transcripts['student-1'].isVerified).toBe(true);
    expect(restored?.markings['student-1'].isApproved).toBe(true);
  });

  it('clears saved session completely', async () => {
    await saveWorkbenchSession({
      currentStep: 'grade',
      assignment: { title: 'Test' } as any,
      files: [],
      pages: [],
      selectedClassId: '3A',
      studentPageCounts: [],
      selectedStudentIndices: [],
      appliedMatching: null,
      activeStudentIndex: 0,
      transcripts: {},
      markings: {},
    });

    const beforeClear = await loadWorkbenchSession();
    expect(beforeClear).not.toBeNull();

    await clearWorkbenchSession();
    const afterClear = await loadWorkbenchSession();
    expect(afterClear).toBeNull();
  });
});
