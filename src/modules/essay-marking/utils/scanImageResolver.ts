import { ScanPage } from '../types';

/**
 * Resolves a reliable image URL for a scan page.
 * Handles:
 * 1. Data URLs (data:image/...)
 * 2. Static / server URLs (/demo-scans/..., http://..., https://...)
 * 3. Valid local blob URLs (blob:...)
 */
export function resolveScanPageImageUrl(
  page: ScanPage | null | undefined,
  fallbackPartIndex?: number
): string {
  if (!page) return '';

  const { previewUrl, fileName, imageBlob } = page;

  // If already a valid static or data URL (not blob:), return directly
  if (previewUrl && !previewUrl.startsWith('blob:')) {
    return previewUrl;
  }

  // If fileName is already one of the demo scans
  if (fileName && fileName.startsWith('demo_page_')) {
    return `/demo-scans/${fileName}`;
  }

  // If live previewUrl is present, return it
  if (previewUrl) {
    return previewUrl;
  }

  // If page has a persisted imageBlob, create a fresh live object URL
  if (imageBlob && (imageBlob instanceof Blob || (typeof imageBlob === 'object' && 'size' in (imageBlob as any)))) {
    try {
      const blob = imageBlob instanceof Blob ? imageBlob : new Blob([(imageBlob as any)], { type: (imageBlob as any).type || 'image/jpeg' });
      return URL.createObjectURL(blob);
    } catch {
      // fallback
    }
  }

  return getFallbackScanImageUrl(page, fallbackPartIndex);
}

/**
 * Provides fallback image URL.
 * First checks if page.imageBlob can produce a live URL.
 * If not, falls back to public/demo-scans/.
 */
export function getFallbackScanImageUrl(
  page: ScanPage | null | undefined,
  fallbackPartIndex?: number
): string {
  if (!page) return '';

  if (page.imageBlob && (page.imageBlob instanceof Blob || (typeof page.imageBlob === 'object' && 'size' in (page.imageBlob as any)))) {
    try {
      const blob = page.imageBlob instanceof Blob ? page.imageBlob : new Blob([(page.imageBlob as any)], { type: (page.imageBlob as any).type || 'image/jpeg' });
      return URL.createObjectURL(blob);
    } catch {
      // continue
    }
  }

  if (page.fileName && page.fileName.startsWith('demo_page_')) {
    return `/demo-scans/${page.fileName}`;
  }

  if (typeof page.orderIndex === 'number' && page.orderIndex >= 0) {
    const pageNum = (page.orderIndex % 4) + 1;
    return `/demo-scans/demo_page_${pageNum}.png`;
  }

  if (typeof fallbackPartIndex === 'number' && fallbackPartIndex >= 1) {
    const pageNum = ((fallbackPartIndex - 1) % 4) + 1;
    return `/demo-scans/demo_page_${pageNum}.png`;
  }

  return `/demo-scans/demo_page_1.png`;
}
