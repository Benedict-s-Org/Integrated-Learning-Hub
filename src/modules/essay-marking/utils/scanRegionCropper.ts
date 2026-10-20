import { TemplateRegion } from '../types';

export interface CroppedIdentityResult {
  classImage?: string;
  nameImage?: string;
  numberImage?: string;
  combinedImage?: string;
  hasAllRegions: boolean;
  missingTypes: string[];
}

/**
 * Loads an image from a URL (blob: or data: or http:) into an HTMLImageElement.
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image for cropping: ' + e));
    img.src = url;
  });
}

/**
 * Crops a sub-region from an image using normalized coordinates (0..1).
 */
export function cropRegionFromImage(
  img: HTMLImageElement,
  region: { x: number; y: number; width: number; height: number }
): string | null {
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  if (naturalWidth === 0 || naturalHeight === 0) return null;

  // Add 4% padding around the box to avoid cutting off edge handwriting
  const padX = region.width * 0.04;
  const padY = region.height * 0.04;

  const clampX = Math.max(0, region.x - padX);
  const clampY = Math.max(0, region.y - padY);
  const clampW = Math.min(1 - clampX, region.width + padX * 2);
  const clampH = Math.min(1 - clampY, region.height + padY * 2);

  const sx = Math.round(clampX * naturalWidth);
  const sy = Math.round(clampY * naturalHeight);
  const sw = Math.round(clampW * naturalWidth);
  const sh = Math.round(clampH * naturalHeight);

  if (sw <= 0 || sh <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Crops Class, Student Name, and Class Number regions, and stitches them into a labeled composite image.
 */
export async function cropIdentityRegions(
  imageUrl: string,
  regions: TemplateRegion[]
): Promise<CroppedIdentityResult> {
  const classRegion = regions.find((r) => r.type === 'class');
  const nameRegion = regions.find((r) => r.type === 'student_name');
  const numberRegion = regions.find((r) => r.type === 'class_number');

  const missingTypes: string[] = [];
  if (!classRegion) missingTypes.push('Class');
  if (!nameRegion) missingTypes.push('Student Name');
  if (!numberRegion) missingTypes.push('Class Number');

  const img = await loadImage(imageUrl);

  const classImage = classRegion ? cropRegionFromImage(img, classRegion) || undefined : undefined;
  const nameImage = nameRegion ? cropRegionFromImage(img, nameRegion) || undefined : undefined;
  const numberImage = numberRegion ? cropRegionFromImage(img, numberRegion) || undefined : undefined;

  // Stitch into a labeled vertical composite image for Qwen3-VL
  const rawItems = [
    { label: 'CLASS', dataUrl: classImage },
    { label: 'STUDENT NAME', dataUrl: nameImage },
    { label: 'CLASS NUMBER', dataUrl: numberImage },
  ];
  const items = rawItems.filter((item): item is { label: string; dataUrl: string } => Boolean(item.dataUrl));

  let combinedImage: string | undefined = undefined;

  if (items.length > 0) {
    const loadedCrops = await Promise.all(
      items.map(async (item) => ({
        label: item.label,
        cropImg: await loadImage(item.dataUrl),
      }))
    );

    const headerHeight = 28;
    const padding = 10;
    const maxWidth = Math.max(300, ...loadedCrops.map((c) => c.cropImg.naturalWidth));
    const totalHeight = loadedCrops.reduce(
      (sum, c) => sum + headerHeight + c.cropImg.naturalHeight + padding,
      padding
    );

    const canvas = document.createElement('canvas');
    canvas.width = maxWidth + padding * 2;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Clean white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let currentY = padding;

      for (const item of loadedCrops) {
        // Label background & text
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`[${item.label}]`, padding, currentY + 18);
        currentY += headerHeight;

        // Draw cropped region with subtle border
        ctx.drawImage(item.cropImg, padding, currentY);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.strokeRect(padding, currentY, item.cropImg.naturalWidth, item.cropImg.naturalHeight);

        currentY += item.cropImg.naturalHeight + padding;
      }

      combinedImage = canvas.toDataURL('image/jpeg', 0.95);
    }
  }

  return {
    classImage,
    nameImage,
    numberImage,
    combinedImage,
    hasAllRegions: missingTypes.length === 0,
    missingTypes,
  };
}
