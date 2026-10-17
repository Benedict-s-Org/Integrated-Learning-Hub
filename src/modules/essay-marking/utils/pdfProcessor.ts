import * as pdfjsLib from 'pdfjs-dist';
import { ScanPage } from '../types';

// Configure pdfjs worker if not already configured
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

/**
 * Extracts each page of an uploaded PDF locally into a previewable canvas-generated image blob URL.
 * Preserves deterministic page numbering.
 */
export async function renderPdfPagesLocally(
  file: File,
  fileId: string,
  startOrderIndex: number
): Promise<{ pages: ScanPage[]; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    const pages: ScanPage[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Unable to create canvas context for PDF rendering');
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
      );

      const previewUrl = blob ? URL.createObjectURL(blob) : '';

      pages.push({
        id: `pdf-${fileId}-p${pageNum}`,
        fileId,
        fileName: file.name,
        sourcePageNumber: pageNum,
        previewUrl,
        orderIndex: startOrderIndex + pageNum - 1,
      });
    }

    return { pages };
  } catch (err: unknown) {
    console.error('Error rendering PDF locally:', err);
    const msg = err instanceof Error ? err.message : 'Failed to parse PDF pages locally. Please ensure the PDF is valid.';
    return {
      pages: [],
      error: msg,
    };
  }
}
