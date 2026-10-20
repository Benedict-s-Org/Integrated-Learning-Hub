import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderPdfPagesLocally } from '@/modules/essay-marking/utils/pdfProcessor';
import { loadWorkbenchSession, saveWorkbenchSession } from '@/modules/essay-marking/utils/essayMarkingStorage';
import * as pdfjsLib from 'pdfjs-dist';

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => {
  return {
    GlobalWorkerOptions: {
      workerSrc: '',
    },
    version: '4.0.379',
    getDocument: vi.fn(),
  };
});

describe('PDF Processor Regression Tests: page is not defined & persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn((_blob: Blob) => `blob:mock-url-${Date.now()}`);
    } else {
      vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mock-url-${Date.now()}`);
    }
  });

  it('renders multi-page PDF by calling pdfDoc.getPage(pageNum) and never throws page is not defined', async () => {
    const mockCleanup = vi.fn();
    const mockRender = vi.fn().mockReturnValue({
      promise: Promise.resolve(),
    });
    const mockGetViewport = vi.fn().mockReturnValue({ width: 612, height: 792 });

    const mockGetPage = vi.fn().mockImplementation((_pageNum: number) => {
      return Promise.resolve({
        getViewport: mockGetViewport,
        render: mockRender,
        cleanup: mockCleanup,
      });
    });

    const mockPdfDoc = {
      numPages: 4,
      getPage: mockGetPage,
      cleanup: vi.fn(),
    };

    (pdfjsLib.getDocument as any).mockReturnValue({
      promise: Promise.resolve(mockPdfDoc),
    });

    // Mock canvas context and toBlob
    const mockContext = {};
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        const canvas = originalCreateElement('canvas');
        canvas.getContext = vi.fn().mockReturnValue(mockContext);
        canvas.toBlob = vi.fn().mockImplementation((cb: (b: Blob) => void) => {
          cb(new Blob(['fake-page-image'], { type: 'image/jpeg' }));
        });
        return canvas;
      }
      return originalCreateElement(tagName);
    });

    const file = new File(['%PDF-1.4 fake content'], 'P4 Wr1DEMO.pdf', {
      type: 'application/pdf',
    });

    const result = await renderPdfPagesLocally(file, 'file-123', 0);

    // Verify no "page is not defined" error occurred
    expect(result.error).toBeUndefined();
    expect(result.totalDocPages).toBe(4);
    expect(result.pages.length).toBe(4);
    expect(result.failedPageNumbers).toEqual([]);

    // Verify getPage was called for every page 1..4
    expect(mockGetPage).toHaveBeenCalledTimes(4);
    expect(mockGetPage).toHaveBeenNthCalledWith(1, 1);
    expect(mockGetPage).toHaveBeenNthCalledWith(2, 2);
    expect(mockGetPage).toHaveBeenNthCalledWith(3, 3);
    expect(mockGetPage).toHaveBeenNthCalledWith(4, 4);

    // Verify page resources were cleaned up after each page
    expect(mockCleanup).toHaveBeenCalledTimes(4);

    // Verify imageBlobs are saved on each page for persistent session restore
    result.pages.forEach((p, idx) => {
      expect(p.fileName).toBe('P4 Wr1DEMO.pdf');
      expect(p.sourcePageNumber).toBe(idx + 1);
      expect(p.imageBlob).toBeInstanceOf(Blob);
      expect(p.previewUrl).toMatch(/^blob:/);
    });
  });

  it('handles partial page rendering failures gracefully without dropping successful pages', async () => {
    const mockGetPage = vi.fn().mockImplementation((pageNum: number) => {
      if (pageNum === 2) {
        // Page 2 fails to render
        return Promise.reject(new Error('Corrupt stream on page 2'));
      }
      return Promise.resolve({
        getViewport: vi.fn().mockReturnValue({ width: 612, height: 792 }),
        render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
        cleanup: vi.fn(),
      });
    });

    const mockPdfDoc = {
      numPages: 3,
      getPage: mockGetPage,
      cleanup: vi.fn(),
    };

    (pdfjsLib.getDocument as any).mockReturnValue({
      promise: Promise.resolve(mockPdfDoc),
    });

    const file = new File(['%PDF-1.4 fake'], 'partially_corrupt.pdf', {
      type: 'application/pdf',
    });

    const result = await renderPdfPagesLocally(file, 'file-456', 0);

    // Preserves successful pages (1 and 3)
    expect(result.pages.length).toBe(2);
    expect(result.totalDocPages).toBe(3);
    expect(result.failedPageNumbers).toEqual([2]);
    expect(result.error).toContain('第 2 頁渲染失敗');
    expect(result.pages[0].sourcePageNumber).toBe(1);
    expect(result.pages[1].sourcePageNumber).toBe(3);
  });

  it('rehydrates imageBlob into fresh live object URLs on session restore', async () => {
    // Setup fake IndexedDB
    let storedSession: any = null;
    const fakeStore = {
      put: vi.fn((data: any) => {
        storedSession = data;
        const req: any = {};
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      get: vi.fn(() => {
        const req: any = { result: storedSession };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
    };
    const fakeTx = {
      objectStore: vi.fn(() => fakeStore),
      oncomplete: null as any,
    };
    const fakeDb = {
      transaction: vi.fn(() => fakeTx),
      close: vi.fn(),
      objectStoreNames: { contains: () => true },
    };
    const fakeReq: any = { result: fakeDb };
    (globalThis as any).indexedDB = {
      open: vi.fn(() => {
        setTimeout(() => fakeReq.onsuccess?.({ target: fakeReq }), 0);
        return fakeReq;
      }),
    };

    const dummyBlob = new Blob(['sample-page-bytes'], { type: 'image/jpeg' });
    const deadBlobUrl = 'blob:http://localhost:5180/dead-url-from-previous-session';

    // Save session with imageBlob
    await saveWorkbenchSession({
      currentStep: 'pair',
      assignment: { title: 'Test Essay', isConfirmed: false } as any,
      files: [{ id: 'f1', name: 'P4 Wr1DEMO.pdf', size: 1000, type: 'pdf', pageCount: 1, addedAt: 1 }],
      pages: [
        {
          id: 'p1',
          fileId: 'f1',
          fileName: 'P4 Wr1DEMO.pdf',
          sourcePageNumber: 1,
          previewUrl: deadBlobUrl,
          orderIndex: 0,
          imageBlob: dummyBlob,
        },
      ],
      selectedClassId: 'class-1',
      studentPageCounts: [1],
      selectedStudentIndices: [0],
      appliedMatching: null,
      activeStudentIndex: 0,
      transcripts: {},
      markings: {},
    });

    // Load session and verify previewUrl was regenerated from imageBlob
    const restored = await loadWorkbenchSession();
    expect(restored).not.toBeNull();
    expect(restored!.pages.length).toBe(1);
    expect(restored!.pages[0].previewUrl).not.toBe(deadBlobUrl);
    expect(restored!.pages[0].previewUrl).toMatch(/^blob:/);
    expect(restored!.pages[0].imageBlob).toBeDefined();
  });
});
