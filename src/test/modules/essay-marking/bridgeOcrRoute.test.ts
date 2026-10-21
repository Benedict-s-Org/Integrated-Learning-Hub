import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// SAFETY: The Mathpix client is mocked at module level so the route test can
// NEVER trigger a paid api.mathpix.com call. The route wiring (express app ->
// requireTeacherAuth -> image validation -> mathpixClient.recognizeHandwriting
// -> response) is exercised for real.
vi.mock('../../../../bridges/essay-marking-bridge/src/mathpixClient.js', () => ({
  recognizeHandwriting: vi.fn(),
}));

// @ts-ignore -- bridge ESM module without type declarations
import { recognizeHandwriting } from '../../../../bridges/essay-marking-bridge/src/mathpixClient.js';

// Env must be set before the dynamic import of server.js (config.js reads these
// at import time; dotenv does not override pre-set process.env values).
process.env.BRIDGE_API_KEY = 'test-bridge-key';
process.env.NODE_ENV = 'test';

// Valid 64x64 PNG fixtures (>=100 bytes, >=50px per side). Distinct colors ->
// distinct dedup fingerprints. Locally generated; no upstream calls.
const PNG_A =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAeklEQVR4nNXOQREAAAyDMPybZiL62BEFwTiMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwziMwzi+A6sDylPSwv6dS34AAAAASUVORK5CYII=';
const PNG_B =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAkElEQVR4nO3PsQkAABDCQGvrr7P/mD+GCMINkMhHNcULvAGqKV7gDVBN8QJvgGqKF3gDVFO8wBugmuIF3gDVFC/wBqimeIE3QDXFC7wBqile4A1QTfECb4Bqihd4A1RTvMAboJriBd4A1RQv8AaopniBN0A1xQu8AaopXuANUE3xAm+AaooXeANUU7zAG6DaAz2EwC4oN0NXAAAAAElFTkSuQmCC';

describe('POST /api/ocr route wiring (Mathpix client invocation)', () => {
  let app: any;
  let srv: any;
  let baseUrl: string;

  beforeEach(() => {
    vi.mocked(recognizeHandwriting).mockClear();
  });

  beforeAll(async () => {
    // @ts-ignore -- bridge ESM module without type declarations
    ({ default: app } = await import('../../../../bridges/essay-marking-bridge/src/server.js'));
    await new Promise<void>((resolve) => {
      srv = app.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${srv.address().port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  });

  it('invokes the imported Mathpix client and returns its result (regression: missing import caused ReferenceError 500)', async () => {
    vi.mocked(recognizeHandwriting).mockResolvedValueOnce({
      status: 'success',
      transcript: 'Mocked Mathpix transcript line 1.\nMocked line 2.',
      uncertainRegions: [],
    } as any);

    const res = await fetch(`${baseUrl}/api/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-bridge-key',
      },
      body: JSON.stringify({
        studentId: 'student-test',
        assignmentId: 'assign-test',
        imageUrls: [PNG_A],
      }),
    });

    const body = await res.json();

    // The Mathpix client module imported by server.js must have been invoked.
    expect(recognizeHandwriting).toHaveBeenCalledTimes(1);
    expect(recognizeHandwriting).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: PNG_A,
        worksheetContext: undefined,
        scopePrompt: undefined,
      })
    );

    // Its result is returned verbatim through the route.
    expect(res.status).toBe(200);
    expect(body.status).toBe('success');
    expect(body.transcript).toBe('Mocked Mathpix transcript line 1.\nMocked line 2.');
    // Request-ID middleware ran (keeps new diagnostic logging wired).
    expect(body.requestId).toMatch(/^req_/);
  });

  it('maps a Mathpix client error result to HTTP 502 and preserves the code', async () => {
    vi.mocked(recognizeHandwriting).mockResolvedValueOnce({
      status: 'error',
      code: 'UPSTREAM_HTTP_500',
      message: 'Mocked upstream failure',
    } as any);

    const res = await fetch(`${baseUrl}/api/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-bridge-key',
      },
      body: JSON.stringify({
        studentId: 'student-test',
        assignmentId: 'assign-test',
        imageUrls: [PNG_B],
      }),
    });

    const body = await res.json();
    expect(recognizeHandwriting).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(502);
    expect(body.status).toBe('error');
    expect(body.code).toBe('UPSTREAM_HTTP_500');
    expect(body.message).toBe('Mocked upstream failure');
    expect(body.requestId).toMatch(/^req_/);
  });

  it('rejects unauthenticated requests with 401 before any OCR call (no billing risk)', async () => {
    const res = await fetch(`${baseUrl}/api/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrls: [PNG_A] }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe('MISSING_BEARER_TOKEN');
    expect(recognizeHandwriting).not.toHaveBeenCalled();
  });

  it('different crops of the same page produce DIFFERENT dedup fingerprints (no false cache reuse)', async () => {
    // @ts-ignore -- bridge ESM module without type declarations
    const { jobManager } = await import('../../../../bridges/essay-marking-bridge/src/jobManager.js');

    const fpFull = jobManager.createFingerprint({
      userId: 'u1',
      studentId: 's1',
      assignmentId: 'a1',
      imageUrls: [PNG_A],
    });
    // A different crop of the same page = different image content
    const fpCrop1 = jobManager.createFingerprint({
      userId: 'u1',
      studentId: 's1',
      assignmentId: 'a1',
      imageUrls: [PNG_B],
    });
    // Identical crop re-submitted = same fingerprint (dedup/cache applies)
    const fpCrop1Again = jobManager.createFingerprint({
      userId: 'u1',
      studentId: 's1',
      assignmentId: 'a1',
      imageUrls: [PNG_B],
    });

    expect(fpCrop1).not.toBe(fpFull); // crop vs full page -> distinct request
    expect(fpCrop1Again).toBe(fpCrop1); // identical crop -> dedup/cache reuse
  });
});
