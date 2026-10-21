import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the canvas-based cropper layer (jsdom cannot decode images or draw).
vi.mock('../../../modules/essay-marking/utils/scanRegionCropper', () => ({
  loadImage: vi.fn(),
  cropRegionFromImage: vi.fn(),
}));

import { loadImage, cropRegionFromImage } from '../../../modules/essay-marking/utils/scanRegionCropper';
import {
  computeWritingAreaRect,
  prepareOcrImageFromRegions,
} from '../../../modules/essay-marking/utils/regionAwareOcr';
import { TemplateRegion } from '../../../modules/essay-marking/types';

const area = (over: Partial<TemplateRegion> = {}): TemplateRegion => ({
  id: 'r1',
  type: 'writing_area' as any,
  pageNumber: 1,
  x: 0.2,
  y: 0.3,
  width: 0.5,
  height: 0.4,
  ...over,
});

const FULL_PAGE = 'data:image/png;base64,FULLPAGE';

describe('computeWritingAreaRect (pure coordinate math, normalized 0..1)', () => {
  it('returns the rect for a single region unchanged', () => {
    expect(computeWritingAreaRect([area()])).toEqual({
      ok: true,
      rect: { x: 0.2, y: 0.3, width: 0.5, height: 0.4 },
    });
  });

  it('returns the UNION rect for multiple regions on one page', () => {
    const res = computeWritingAreaRect([area(), area({ id: 'r2', x: 0.6, y: 0.1, width: 0.2, height: 0.2 })]);
    expect(res).toEqual({
      ok: true,
      rect: { x: 0.2, y: 0.1, width: 0.6, height: 0.6 },
    });
  });

  it('rejects non-finite coordinates with a clear error', () => {
    const res = computeWritingAreaRect([area({ x: NaN })]);
    expect(res.ok).toBe(false);
    expect((res as any).error).toMatch(/invalid coordinates/i);
  });

  it('rejects regions extending outside page bounds', () => {
    const res = computeWritingAreaRect([area({ width: 0.9 })]); // 0.2+0.9 > 1
    expect(res.ok).toBe(false);
    expect((res as any).error).toMatch(/outside the page bounds/i);
  });

  it('rejects zero-size regions', () => {
    const res = computeWritingAreaRect([area({ width: 0 })]);
    expect(res.ok).toBe(false);
    expect((res as any).error).toMatch(/zero size/i);
  });

  it('rejects an empty region list', () => {
    expect(computeWritingAreaRect([]).ok).toBe(false);
  });
});

describe('prepareOcrImageFromRegions', () => {
  beforeEach(() => {
    vi.mocked(loadImage).mockReset();
    vi.mocked(cropRegionFromImage).mockReset();
  });

  it('NO region: keeps existing full-page behavior (original image, no crop)', async () => {
    const res = await prepareOcrImageFromRegions(FULL_PAGE, []);
    expect(res).toEqual({
      imageUrl: FULL_PAGE,
      isRegionCrop: false,
      sourceImageUrl: FULL_PAGE,
    });
    expect(loadImage).not.toHaveBeenCalled();
  });

  it('valid region: returns the CROP and keeps the original page untouched', async () => {
    vi.mocked(loadImage).mockResolvedValue({ naturalWidth: 1000, naturalHeight: 800 } as any);
    vi.mocked(cropRegionFromImage).mockReturnValue('data:image/jpeg;base64,CROP');

    const res = await prepareOcrImageFromRegions(FULL_PAGE, [area()]);

    expect(res.imageUrl).toBe('data:image/jpeg;base64,CROP');
    expect(res.isRegionCrop).toBe(true);
    expect(res.sourceImageUrl).toBe(FULL_PAGE);
    // Normalized coords passed through to the cropper (0..1 convention)
    expect(cropRegionFromImage).toHaveBeenCalledWith(
      expect.anything(),
      { x: 0.2, y: 0.3, width: 0.5, height: 0.4 }
    );
  });

  it('invalid region: explicit error, cropper never invoked, NO silent full-page fallback', async () => {
    const res = await prepareOcrImageFromRegions(FULL_PAGE, [area({ x: NaN })]);
    expect(res.error).toMatch(/invalid coordinates/i);
    expect(loadImage).not.toHaveBeenCalled();
    expect(cropRegionFromImage).not.toHaveBeenCalled();
  });

  it('region too small in source pixels: explicit error (bridge 50px minimum)', async () => {
    vi.mocked(loadImage).mockResolvedValue({ naturalWidth: 200, naturalHeight: 200 } as any);
    const res = await prepareOcrImageFromRegions(FULL_PAGE, [area({ x: 0.4, y: 0.4, width: 0.1, height: 0.1 })]);
    expect(res.error).toMatch(/too small/i);
    expect(cropRegionFromImage).not.toHaveBeenCalled();
  });

  it('crop failure (canvas unavailable): explicit error, not a fallback', async () => {
    vi.mocked(loadImage).mockResolvedValue({ naturalWidth: 1000, naturalHeight: 800 } as any);
    vi.mocked(cropRegionFromImage).mockReturnValue(null);
    const res = await prepareOcrImageFromRegions(FULL_PAGE, [area()]);
    expect(res.error).toMatch(/cropping the selected ocr region failed/i);
  });

  it('image load failure: explicit error, not a fallback', async () => {
    vi.mocked(loadImage).mockRejectedValue(new Error('load failed'));
    const res = await prepareOcrImageFromRegions(FULL_PAGE, [area()]);
    expect(res.error).toMatch(/could not load the scan image/i);
  });
});
