if (typeof DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {};
}
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { EssayMarkingPage } from '@/modules/essay-marking/EssayMarkingPage';
import {
  saveWorkbenchSession,
  clearWorkbenchSession,
  loadWorkbenchSession,
} from '@/modules/essay-marking/utils/essayMarkingStorage';
import { reportClientError, getLatestClientErrors } from '@/modules/essay-marking/utils/clientErrorLogger';

vi.mock('@/modules/essay-marking/components/PdfTemplateRegionEditor', () => ({
  PdfTemplateRegionEditor: () => <div data-testid="mock-pdf-region-editor" />,
}));

vi.mock('@/modules/essay-marking/utils/pdfProcessor', () => ({
  renderPdfPagesLocally: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        not: vi.fn().mockResolvedValue({ data: [{ class: '4A' }], error: null }),
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'std-1',
                  display_name: 'Bernice',
                  class: '4A',
                  class_number: 1,
                  role: 'user',
                },
              ],
              error: null,
            }),
          }),
        }),
      })),
    })),
  },
}));

// Setup in-memory IndexedDB mock
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

describe('EssayMarking Session Persistence & Error Logging', () => {
  beforeEach(async () => {
    setupInMemoryIndexedDB();
    await clearWorkbenchSession();
    vi.restoreAllMocks();
  });

  it('restores workflow step and session data from IndexedDB upon page reload', async () => {
    // Seed Step 4 (OCR / Transcript Verification) into IndexedDB
    await saveWorkbenchSession({
      currentStep: 'ocr',
      assignment: {
        id: 'asg-test-4',
        title: 'Super Cop Assignment',
        isTitleCustomized: true,
        grade: 'P.4',
        worksheetFileName: 'cop.pdf',
        worksheetFile: null,
        worksheetPreviewUrl: null,
        responseFormat: 'worksheet',
        scopePrompt: 'Write about a superhero',
        isConfirmed: true,
        rubric: [],
        templateRegions: [],
        transcriptionSettings: {
          version: 'v1.4',
          printedLabelsMode: 'exclude',
          primaryLanguage: 'en',
          notes: 'Ruled writing area',
          readingOrder: [],
        },
      },
      files: [],
      pages: [
        {
          id: 'p1',
          fileId: 'f1',
          fileName: 'page-1.png',
          sourcePageNumber: 1,
          previewUrl: 'data:image/png;base64,mockPngPreview',
          orderIndex: 0,
        },
      ],
      selectedClassId: '4A',
      studentPageCounts: [1],
      selectedStudentIndices: [0],
      appliedMatching: {
        classId: '4A',
        counts: [1],
        map: [
          {
            studentIndex: 0,
            studentId: 'std-1',
            studentName: 'Bernice',
            classNumber: 1,
            part: 1,
            total: 1,
          },
        ],
        assignedStudentIndices: [0],
        mode: 'sequential',
        contextFingerprint: 'fp-1',
      },
      activeStudentIndex: 0,
      transcripts: {
        'std-1': {
          studentId: 'std-1',
          rawOcrText: 'Dog man is a very special cop.',
          editedText: 'Dog man is a very special cop.',
          linesWithBboxes: [{ text: 'Dog man is a very special cop.', bbox: [187, 689, 830, 725] }],
          isManuallyEntered: false,
          uncertainRegions: [],
          isVerified: true,
        },
      },
      markings: {},
    });

    // Render EssayMarkingPage (simulates page reload)
    render(<EssayMarkingPage />);

    // Expect automatic restoration to Step 4 ('Recognition & Transcript Verification')
    await waitFor(() => {
      expect(
        screen.getByText('Recognition & Transcript Verification')
      ).toBeInTheDocument();
    });

    // Expect 'Clear saved session' action button in header
    const clearButton = screen.getByRole('button', { name: /Clear saved session/i });
    expect(clearButton).toBeInTheDocument();

    // Verify student transcript was restored
    await waitFor(() => {
      expect(
        screen.getByDisplayValue('Dog man is a very special cop.')
      ).toBeInTheDocument();
    });

    // Test 'Clear saved session' action
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(clearButton);

    // Verify it resets to Step 1 (Preparation)
    await waitFor(() => {
      expect(
        screen.getByText('Confirm assignment title, template worksheet, scope prompts, and rubric dimensions before intake.')
      ).toBeInTheDocument();
    });

    // Verify IndexedDB session was wiped
    const wiped = await loadWorkbenchSession();
    expect(wiped).toBeNull();
  });

  it('captures client errors and makes them available for copying', async () => {
    await reportClientError(new Error('Uncaught syntax fault'), 'ocr');

    const errors = getLatestClientErrors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toBe('Uncaught syntax fault');
    expect(errors[0].currentStep).toBe('ocr');
  });
});
