import * as pdfjsLib from 'pdfjs-dist';
import { ScanPage } from '../types';

// Configure pdfjs worker if not already configured
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export interface RenderPdfResult {
  pages: ScanPage[];
  totalDocPages: number;
  failedPageNumbers: number[];
  error?: string;
}

async function readFileAsArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    try {
      return await file.arrayBuffer();
    } catch {
      // Fallback to FileReader if native arrayBuffer throws
    }
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file as ArrayBuffer'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extracts each page of an uploaded PDF locally into a previewable canvas-generated image blob URL.
 * Preserves deterministic page numbering and persists image blobs for reliable session restore.
 */
export async function renderPdfPagesLocally(
  file: File,
  fileId: string,
  startOrderIndex: number
): Promise<RenderPdfResult> {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    // Clone buffer so worker transfer does not detach original buffer
    const bufferCopy = arrayBuffer.slice(0);
    const loadingTask = pdfjsLib.getDocument({ data: bufferCopy });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    const pages: ScanPage[] = [];
    const failedPageNumbers: number[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const scale = Math.max(2.0, dpr * 1.5);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Unable to create canvas context for PDF rendering');
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderTask = page.render({
          canvasContext: context,
          viewport: viewport,
        } as any);

        await renderTask.promise;

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88)
        );

        const previewUrl =
          blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
            ? URL.createObjectURL(blob)
            : '';

        pages.push({
          id: `pdf-${fileId}-p${pageNum}`,
          fileId,
          fileName: file.name,
          sourcePageNumber: pageNum,
          previewUrl,
          orderIndex: startOrderIndex + pageNum - 1,
          imageBlob: blob || undefined,
        });

        // Clean up individual page resources to release memory
        if (typeof (page as any).cleanup === 'function') {
          (page as any).cleanup();
        }
      } catch (pageErr: unknown) {
        console.error(`Error rendering page ${pageNum} of ${file.name}:`, pageErr);
        failedPageNumbers.push(pageNum);
      }
    }

    // Clean up document worker resources
    if (typeof (pdfDoc as any).cleanup === 'function') {
      (pdfDoc as any).cleanup();
    }

    let error: string | undefined = undefined;
    if (failedPageNumbers.length > 0) {
      if (pages.length === 0) {
        error = `所有頁面 (${numPages} 頁) 均渲染失敗。`;
      } else {
        error = `共 ${numPages} 頁，其中第 ${failedPageNumbers.join(', ')} 頁渲染失敗。已成功載入 ${pages.length} 頁。`;
      }
    }

    return {
      pages,
      totalDocPages: numPages,
      failedPageNumbers,
      error,
    };
  } catch (err: unknown) {
    console.error('Error rendering PDF locally:', err);
    const msg = err instanceof Error ? err.message : 'Failed to parse PDF pages locally. Please ensure the PDF is valid.';
    return {
      pages: [],
      totalDocPages: 0,
      failedPageNumbers: [],
      error: msg,
    };
  }
}
