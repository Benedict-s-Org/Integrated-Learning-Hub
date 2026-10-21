import { TemplateRegion } from '../types';
import { loadImage, cropRegionFromImage } from './scanRegionCropper';

/**
 * regionAwareOcr.ts — shared region-aware image preparation for OCR.
 *
 * Single source of truth for single-page OCR, inline per-page OCR, batch OCR,
 * resume/retry, and Qwen verification image selection. Mathpix-only and
 * Mathpix+Qwen-verify modes crop the saved writing-area region and send ONLY
 * that crop; pages without a saved writing area keep the existing full-page
 * behavior. An explicitly saved but invalid region is an ERROR — never a
 * silent fallback to full-page OCR.
 *
 * Coordinate convention (existing): regions are normalized (0..1) relative to
 * the full page image. Display scaling (Fit width etc.) does not affect them
 * because they are ratios. cropRegionFromImage maps them onto the source
 * image's natural pixel dimensions. The original full-page image is never
 * modified.
 */

export interface PreparedOcrImage {
  /** Data URL to send for OCR/verification: the crop, or the original page image when no region exists. */
  imageUrl: string;
  /** True when a saved writing-area region was cropped. */
  isRegionCrop: boolean;
  /** Union rect actually cropped (normalized 0..1). */
  regionRect?: { x: number; y: number; width: number; height: number };
  /** The untouched original full-page image URL (for viewing/relationship mapping). */
  sourceImageUrl: string;
  /** Set when a saved region exists but is invalid/uncroppable. Callers must fail with this message. */
  error?: string;
}

/** Minimum image dimension accepted by the bridge image validator (50px). */
const MIN_CROP_PX = 50;

/**
 * Computes the union bounding box of writing-area regions (normalized 0..1).
 * Pure function — no canvas/DOM access — so the math is unit-testable.
 * Returns { ok: false, error } for structurally invalid input.
 */
export function computeWritingAreaRect(
  writingAreas: TemplateRegion[]
): { ok: true; rect: { x: number; y: number; width: number; height: number } } | { ok: false; error: string } {
  if (!Array.isArray(writingAreas) || writingAreas.length === 0) {
    return { ok: false, error: 'No writing-area region provided.' };
  }

  for (const r of writingAreas) {
    const invalid =
      !r ||
      typeof r.x !== 'number' ||
      typeof r.y !== 'number' ||
      typeof r.width !== 'number' ||
      typeof r.height !== 'number' ||
      !Number.isFinite(r.x) ||
      !Number.isFinite(r.y) ||
      !Number.isFinite(r.width) ||
      !Number.isFinite(r.height);
    if (invalid) {
      return { ok: false, error: 'The selected OCR region contains invalid coordinates. Please re-draw it in the region editor.' };
    }
  }

  const minX = Math.min(...writingAreas.map((r) => r.x));
  const minY = Math.min(...writingAreas.map((r) => r.y));
  const maxX = Math.max(...writingAreas.map((r) => r.x + r.width));
  const maxY = Math.max(...writingAreas.map((r) => r.y + r.height));

  if (minX < 0 || minY < 0 || maxX > 1 || maxY > 1) {
    return { ok: false, error: 'The selected OCR region extends outside the page bounds. Please re-draw it in the region editor.' };
  }

  // Round to 6 decimals: normalized coordinates carry no meaningful precision
  // beyond 1e-6, and this avoids binary float noise (0.2+0.5-0.2 artifacts).
  const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
  const rect = {
    x: round6(minX),
    y: round6(minY),
    width: round6(maxX - minX),
    height: round6(maxY - minY),
  };
  if (rect.width <= 0 || rect.height <= 0) {
    return { ok: false, error: 'The selected OCR region has zero size. Please re-draw it in the region editor.' };
  }

  return { ok: true, rect };
}

/**
 * Prepares the image sent for OCR / verification:
 * - writingAreas empty  -> original full-page image (existing behavior).
 * - valid regions       -> crop of the union rect (+ the cropper's own padding).
 * - invalid regions     -> error; caller must surface it (NO full-page fallback).
 */
export async function prepareOcrImageFromRegions(
  pageImageUrl: string,
  writingAreas: TemplateRegion[]
): Promise<PreparedOcrImage> {
  const noRegion: PreparedOcrImage = {
    imageUrl: pageImageUrl,
    isRegionCrop: false,
    sourceImageUrl: pageImageUrl,
  };

  if (!Array.isArray(writingAreas) || writingAreas.length === 0) {
    return noRegion; // Page has no selected region: keep existing full-page behavior.
  }

  const rectResult = computeWritingAreaRect(writingAreas);
  if (!rectResult.ok) {
    return {
      imageUrl: pageImageUrl,
      isRegionCrop: false,
      sourceImageUrl: pageImageUrl,
      error: rectResult.error,
    };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(pageImageUrl);
  } catch {
    return {
      imageUrl: pageImageUrl,
      isRegionCrop: false,
      sourceImageUrl: pageImageUrl,
      error: 'Could not load the scan image to crop the selected OCR region.',
    };
  }

  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  if (!naturalWidth || !naturalHeight) {
    return {
      imageUrl: pageImageUrl,
      isRegionCrop: false,
      sourceImageUrl: pageImageUrl,
      error: 'Scan image dimensions are unavailable; cannot crop the selected OCR region.',
    };
  }

  // Pre-check crop pixel size against the bridge validator's minimum (50px),
  // including the cropper's 4% padding, before attempting the crop.
  const padX = rectResult.rect.width * 0.04;
  const padY = rectResult.rect.height * 0.04;
  const cropW = Math.min(1 - Math.max(0, rectResult.rect.x - padX), rectResult.rect.width + padX * 2) * naturalWidth;
  const cropH = Math.min(1 - Math.max(0, rectResult.rect.y - padY), rectResult.rect.height + padY * 2) * naturalHeight;
  if (cropW < MIN_CROP_PX || cropH < MIN_CROP_PX) {
    return {
      imageUrl: pageImageUrl,
      isRegionCrop: false,
      sourceImageUrl: pageImageUrl,
      error: `The selected OCR region is too small (${Math.round(cropW)}x${Math.round(cropH)} px). Minimum is ${MIN_CROP_PX}x${MIN_CROP_PX} px. Please draw a larger region.`,
    };
  }

  const cropped = cropRegionFromImage(img, rectResult.rect);
  if (!cropped) {
    return {
      imageUrl: pageImageUrl,
      isRegionCrop: false,
      sourceImageUrl: pageImageUrl,
      error: 'Cropping the selected OCR region failed. Please re-draw the region in the region editor.',
    };
  }

  return {
    imageUrl: cropped,
    isRegionCrop: true,
    regionRect: rectResult.rect,
    sourceImageUrl: pageImageUrl,
  };
}


