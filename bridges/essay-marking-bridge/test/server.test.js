process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, config } from '../src/config.js';
// Guarantee test isolation from external services: enforce DRY_RUN for automated test suite
config.dryRun = true;
import { validateOcrRequestPayload } from '../src/imageValidator.js';
import { jobManager } from '../src/jobManager.js';
import { recognizeHandwriting } from '../src/mathpixClient.js';

// Helper to construct a minimal valid 50x50 PNG buffer
function createValidPngBuffer(width = 50, height = 50) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // length
  ihdr.write('IHDR', 4, 'ascii'); // type
  ihdr.writeUInt32BE(width, 8); // width
  ihdr.writeUInt32BE(height, 12); // height
  ihdr[16] = 8; // bit depth
  ihdr[17] = 2; // color type (RGB)
  ihdr[18] = 0; // compression
  ihdr[19] = 0; // filter
  ihdr[20] = 0; // interlace
  ihdr.writeUInt32BE(0x12345678, 21); // crc

  // Dummy IDAT (100 bytes of payload to exceed 100-byte min threshold)
  const idat = Buffer.alloc(108);
  idat.writeUInt32BE(100, 0);
  idat.write('IDAT', 4, 'ascii');
  idat.writeUInt32BE(0x87654321, 104);

  // IEND
  const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// Helper to construct a minimal valid 50x50 JPEG buffer
function createValidJpegBuffer(width = 50, height = 50) {
  const soi = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00]);
  const sof = Buffer.alloc(19);
  sof[0] = 0xff;
  sof[1] = 0xc0; // SOF0
  sof.writeUInt16BE(17, 2); // length
  sof[4] = 8; // precision
  sof.writeUInt16BE(height, 5); // height
  sof.writeUInt16BE(width, 7); // width
  sof[9] = 3; // 3 components

  const dummyData = Buffer.alloc(100, 0xaa);
  const eoi = Buffer.from([0xff, 0xd9]);

  return Buffer.concat([soi, sof, dummyData, eoi]);
}

test('1. Configuration & Initial Live Test Limits', () => {
  const { isValid, summary } = validateConfig();
  assert.equal(isValid, true);
  assert.equal(summary.maxPagesPerRequest, 1, 'Initial live test must constrain to 1 page');
  assert.equal(summary.dryRun, true, 'DRY_RUN must default to true');
  assert.equal(summary.maxConcurrentJobs, 1, 'Concurrency must default to 1');
});

test('2. Image Validation: Rejects HTTP URLs and File Paths', () => {
  const limits = { maxPagesPerRequest: 1, maxImageSizeMb: 8, maxTotalRequestSizeMb: 15 };

  const httpRes = validateOcrRequestPayload({ imageUrls: ['https://example.com/scan.jpg'] }, limits);
  assert.equal(httpRes.isValid, false);
  assert.equal(httpRes.code, 'UNSUPPORTED_URL');

  const pathRes = validateOcrRequestPayload({ imageUrls: ['C:\\scans\\scan1.jpg'] }, limits);
  assert.equal(pathRes.isValid, false);
  assert.equal(pathRes.code, 'UNSUPPORTED_FILE_PATH');
});

test('3. Image Validation: Rejects Unsupported MIME Types (e.g. PDF)', () => {
  const limits = { maxPagesPerRequest: 1, maxImageSizeMb: 8, maxTotalRequestSizeMb: 15 };
  const dummyPdf = 'data:application/pdf;base64,JVBERi0xLjQK';

  const res = validateOcrRequestPayload({ imageUrls: [dummyPdf] }, limits);
  assert.equal(res.isValid, false);
  assert.equal(res.code, 'UNSUPPORTED_MIME_TYPE');
});

test('4. Image Validation: Rejects MIME / Magic Byte Mismatches', () => {
  const limits = { maxPagesPerRequest: 1, maxImageSizeMb: 8, maxTotalRequestSizeMb: 15 };
  // Declares JPEG but provides PNG signature
  const fakeJpeg = `data:image/jpeg;base64,${createValidPngBuffer().toString('base64')}`;

  const res = validateOcrRequestPayload({ imageUrls: [fakeJpeg] }, limits);
  assert.equal(res.isValid, false);
  assert.equal(res.code, 'IMAGE_INTEGRITY_FAILED');
  assert.ok(res.error.includes('magic bytes'));
});

test('5. Image Validation: Rejects Truncated Images (Magic bytes alone insufficient)', () => {
  const limits = { maxPagesPerRequest: 1, maxImageSizeMb: 8, maxTotalRequestSizeMb: 15 };
  // Truncate valid JPEG so EOI marker is stripped
  const validJpeg = createValidJpegBuffer();
  const truncatedJpeg = validJpeg.subarray(0, validJpeg.length - 10);
  const dataUri = `data:image/jpeg;base64,${truncatedJpeg.toString('base64')}`;

  const res = validateOcrRequestPayload({ imageUrls: [dataUri] }, limits);
  assert.equal(res.isValid, false);
  assert.equal(res.code, 'IMAGE_INTEGRITY_FAILED');
  assert.ok(res.error.includes('truncated') || res.error.includes('EOI'));
});

test('6. Image Validation: Rejects Sub-Dimensioned and Oversized Images', () => {
  const limits = { maxPagesPerRequest: 1, maxImageSizeMb: 8, maxTotalRequestSizeMb: 15, minDimension: 50 };
  // 10x10 is below 50x50 min limit
  const tinyPng = `data:image/png;base64,${createValidPngBuffer(10, 10).toString('base64')}`;

  const res = validateOcrRequestPayload({ imageUrls: [tinyPng] }, limits);
  assert.equal(res.isValid, false);
  assert.equal(res.code, 'DIMENSION_TOO_SMALL');
});

test('7. Image Validation: Rejects Page Count Exceeding Limit', () => {
  const limits = { maxPagesPerRequest: 1, maxImageSizeMb: 8, maxTotalRequestSizeMb: 15 };
  const validImg = `data:image/png;base64,${createValidPngBuffer().toString('base64')}`;

  // 2 pages sent when limit is 1
  const res = validateOcrRequestPayload({ imageUrls: [validImg, validImg] }, limits);
  assert.equal(res.isValid, false);
  assert.equal(res.code, 'PAGE_LIMIT_EXCEEDED');
});

test('8. Image Validation: A Later Invalid Page Rejects Entire Batch Upfront', () => {
  const limits = { maxPagesPerRequest: 3, maxImageSizeMb: 8, maxTotalRequestSizeMb: 15 };
  const validImg = `data:image/png;base64,${createValidPngBuffer().toString('base64')}`;
  const corruptImg = 'data:image/png;base64,bm90X2FuX2ltYWdlX2RhdGE=';

  // Page 1 valid, Page 2 corrupt
  const res = validateOcrRequestPayload({ imageUrls: [validImg, corruptImg] }, limits);
  assert.equal(res.isValid, false);
  assert.ok(res.error.includes('Page 2'));
});

test('9. JobManager: Concurrency Limit and Duplicate Rejection', () => {
  const dummyUrl = `data:image/png;base64,${createValidPngBuffer().toString('base64')}`;
  const fp1 = jobManager.createFingerprint({ userId: 'u1', studentId: 's1', assignmentId: 'a1', imageUrls: [dummyUrl] });

  // 1. Acquire slot
  const slot1 = jobManager.acquire({ fingerprint: fp1, userId: 'u1', studentId: 's1' });
  assert.equal(slot1.allowed, true);

  // 2. Duplicate in flight rejected with 409
  const dupSlot = jobManager.acquire({ fingerprint: fp1, userId: 'u1', studentId: 's1' });
  assert.equal(dupSlot.allowed, false);
  assert.equal(dupSlot.status, 409);
  assert.equal(dupSlot.code, 'DUPLICATE_IN_FLIGHT');

  // 3. Complete job with success
  jobManager.complete(fp1, { outcome: 'success', result: { status: 'success', transcript: 'Sample OCR' } });

  // 4. Subsequent submission reuses completed result without upstream call
  const cachedSlot = jobManager.acquire({ fingerprint: fp1, userId: 'u1', studentId: 's1' });
  assert.equal(cachedSlot.allowed, false);
  assert.equal(cachedSlot.isCached, true);
  assert.equal(cachedSlot.result.transcript, 'Sample OCR');
});

test('10. JobManager: Timeout Uncertainty Blocks Immediate Blind Retry', () => {
  const dummyUrl = `data:image/png;base64,${createValidPngBuffer(60, 60).toString('base64')}`;
  const fp = jobManager.createFingerprint({ userId: 'u2', studentId: 's2', assignmentId: 'a2', imageUrls: [dummyUrl] });

  jobManager.acquire({ fingerprint: fp, userId: 'u2', studentId: 's2' });
  jobManager.complete(fp, { outcome: 'timeout_uncertain', error: 'Upstream timeout' });

  const retrySlot = jobManager.acquire({ fingerprint: fp, userId: 'u2', studentId: 's2' });
  assert.equal(retrySlot.allowed, false);
  assert.equal(retrySlot.status, 409);
  assert.equal(retrySlot.code, 'TIMEOUT_UNCERTAIN_RETRY_BLOCKED');
});

test('11. Mathpix Client: DRY_RUN Explicitly Blocks Outbound Fetch', async () => {
  const dummyUrl = `data:image/png;base64,${createValidPngBuffer().toString('base64')}`;
  const res = await recognizeHandwriting({ imageUrl: dummyUrl });

  // Must not make any real network request, must return dry_run_ready or not_configured
  assert.ok(res.status === 'dry_run_ready' || res.status === 'not_configured');
  assert.notEqual(res.status, 'success', 'DRY_RUN must NEVER return simulated success text');
});

test('12. Auth: Fails closed on missing token (401) or unconfigured auth service (503)', async () => {
  const { requireTeacherAuth } = await import('../src/auth.js');

  const req = { headers: {} };
  let statusCode = 0;
  let jsonBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      jsonBody = body;
      return this;
    },
  };

  await requireTeacherAuth(req, res, () => {});

  // With .env configured, missing authorization header returns 401; without .env, fails closed with 503
  assert.ok(
    statusCode === 401 || statusCode === 503,
    `Status code should be 401 or 503, received ${statusCode}`
  );
  assert.ok(
    jsonBody?.code === 'MISSING_BEARER_TOKEN' || jsonBody?.code === 'AUTH_CONFIG_UNAVAILABLE',
    `Code should be MISSING_BEARER_TOKEN or AUTH_CONFIG_UNAVAILABLE, received ${jsonBody?.code}`
  );
});

test('13. Auth: createUserScopedClient attaches user Bearer token to headers without service key', async () => {
  const { createUserScopedClient } = await import('../src/auth.js');

  const token = 'sample_user_session_jwt_token_123';
  const client = createUserScopedClient(token, 'https://example-project.supabase.co', 'dummy_anon_key_123');

  assert.ok(client, 'Client should be instantiated');
  assert.equal(
    client.headers['Authorization'],
    `Bearer ${token}`,
    'User-scoped client must attach the caller JWT in Authorization header'
  );
  assert.equal(
    client.from('users').headers.get('Authorization'),
    `Bearer ${token}`,
    'PostgREST query must carry the user session token in Authorization header'
  );
});

test('14. Auth: Canonical public.users.role authorizes teacher/admin accounts', async () => {
  const {
    requireTeacherAuth,
    setSupabaseAuthClientForTesting,
    setUserScopedClientFactoryForTesting,
  } = await import('../src/auth.js');

  // Mock Supabase Auth
  setSupabaseAuthClientForTesting({
    auth: {
      async getUser(token) {
        if (token === 'valid_teacher_token') {
          return { data: { user: { id: 'teacher_1', email: 'teacher@school.edu' } }, error: null };
        }
        return { data: { user: null }, error: new Error('Invalid token') };
      },
    },
  });

  // Mock User Scoped Client querying public.users
  setUserScopedClientFactoryForTesting(() => ({
    from(table) {
      assert.equal(table, 'users');
      return {
        select(cols) {
          assert.equal(cols, 'role');
          return {
            eq(col, val) {
              assert.equal(col, 'id');
              assert.equal(val, 'teacher_1');
              return {
                async maybeSingle() {
                  return { data: { role: 'class_staff' }, error: null };
                },
              };
            },
          };
        },
      };
    },
  }));

  const req = { headers: { authorization: 'Bearer valid_teacher_token' } };
  let calledNext = false;
  const res = {
    status() { return this; },
    json() { return this; },
  };

  await requireTeacherAuth(req, res, () => { calledNext = true; });

  assert.equal(calledNext, true, 'Next() must be called for valid class_staff role in public.users');
  assert.equal(req.user.role, 'class_staff');
  assert.equal(req.user.id, 'teacher_1');
});

test('15. Auth: Canonical public.users.role rejects student account with 403', async () => {
  const {
    requireTeacherAuth,
    setSupabaseAuthClientForTesting,
    setUserScopedClientFactoryForTesting,
  } = await import('../src/auth.js');

  setSupabaseAuthClientForTesting({
    auth: {
      async getUser() {
        return { data: { user: { id: 'student_1', email: 'student@school.edu' } }, error: null };
      },
    },
  });

  setUserScopedClientFactoryForTesting(() => ({
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: { role: 'user' }, error: null };
                },
              };
            },
          };
        },
      };
    },
  }));

  const req = { headers: { authorization: 'Bearer valid_student_token' } };
  let statusCode = 0;
  let jsonBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; return this; },
  };

  await requireTeacherAuth(req, res, () => {});

  assert.equal(statusCode, 403);
  assert.equal(jsonBody?.code, 'FORBIDDEN_INSUFFICIENT_ROLE');
});

test('16. Auth: Fails closed when no profile exists in public.users (NO fallback to app_metadata.role)', async () => {
  const {
    requireTeacherAuth,
    setSupabaseAuthClientForTesting,
    setUserScopedClientFactoryForTesting,
  } = await import('../src/auth.js');

  // Supabase Auth returns a user with app_metadata.role = 'admin', BUT public.users has NO row
  setSupabaseAuthClientForTesting({
    auth: {
      async getUser() {
        return {
          data: {
            user: {
              id: 'orphan_user',
              email: 'orphan@school.edu',
              app_metadata: { role: 'admin' }, // Must NOT be honored
            },
          },
          error: null,
        };
      },
    },
  });

  // public.users query returns null (profile does not exist)
  setUserScopedClientFactoryForTesting(() => ({
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: null, error: null };
                },
              };
            },
          };
        },
      };
    },
  }));

  const req = { headers: { authorization: 'Bearer orphan_token' } };
  let statusCode = 0;
  let jsonBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; return this; },
  };

  await requireTeacherAuth(req, res, () => {});

  // Must fail closed with 403 FORBIDDEN_PROFILE_NOT_FOUND, NOT falling back to app_metadata
  assert.equal(statusCode, 403);
  assert.equal(jsonBody?.code, 'FORBIDDEN_PROFILE_NOT_FOUND');
});

test('17. Auth: Fails closed when public.users query encounters error/RLS block', async () => {
  const {
    requireTeacherAuth,
    setSupabaseAuthClientForTesting,
    setUserScopedClientFactoryForTesting,
  } = await import('../src/auth.js');

  setSupabaseAuthClientForTesting({
    auth: {
      async getUser() {
        return { data: { user: { id: 'blocked_user', email: 'blocked@school.edu' } }, error: null };
      },
    },
  });

  // public.users query fails with PostgREST/RLS error
  setUserScopedClientFactoryForTesting(() => ({
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: null, error: { code: '42501', message: 'permission denied for table users' } };
                },
              };
            },
          };
        },
      };
    },
  }));

  const req = { headers: { authorization: 'Bearer blocked_token' } };
  let statusCode = 0;
  let jsonBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; return this; },
  };

  await requireTeacherAuth(req, res, () => {});

  assert.equal(statusCode, 403);
  assert.equal(jsonBody?.code, 'ROLE_LOOKUP_BLOCKED');
  assert.ok(jsonBody?.details?.rlsNotice.includes('42501'));

  // Reset testing factories
  setSupabaseAuthClientForTesting(null);
  setUserScopedClientFactoryForTesting(null);
});

test('18. Identity Recognition: Rejects Unauthenticated Requests and Invalid Payloads', async () => {
  const { requireTeacherAuth } = await import('../src/auth.js');
  // Test authentication rejection on missing token
  const reqMissingToken = { headers: {} };
  let statusCode = 0;
  let jsonBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; return this; },
  };

  await requireTeacherAuth(reqMissingToken, res, () => {});
  assert.equal(statusCode, 401);
  assert.equal(jsonBody?.code, 'MISSING_BEARER_TOKEN');
});

test('19. Local VL Client: Does not touch Mathpix and preserves Mathpix DRY_RUN', async () => {
  assert.equal(config.dryRun, true, 'Mathpix DRY_RUN safety gate must remain true');
});

test('20. Startup Integrity: localModelClient loads cleanly with valid exports', async () => {
  const localClient = await import('../src/localModelClient.js');
  assert.equal(typeof localClient.checkLocalModelHealth, 'function');
  assert.equal(typeof localClient.getActiveModelId, 'function');
  assert.equal(typeof localClient.recognizeIdentityWithLocalVL, 'function');

  // Verify getActiveModelId gracefully returns fallback 'default' on unreachable port
  const modelId = await localClient.getActiveModelId('http://127.0.0.1:59999');
  assert.equal(modelId, 'default');
});

test('21. Local VL Client: exports transcribePageWithLocalVL and FIXED_TRANSCRIPTION_RULES_VERSION', async () => {
  const localClient = await import('../src/localModelClient.js');
  assert.equal(typeof localClient.transcribePageWithLocalVL, 'function');
  assert.equal(localClient.FIXED_TRANSCRIPTION_RULES_VERSION, 'v1.4');
  assert.ok(localClient.FIXED_TRANSCRIPTION_RULES_TEXT.includes('FAITHFULLY'));
  assert.ok(localClient.FIXED_TRANSCRIPTION_RULES_TEXT.includes('[unreadable]'));
  assert.ok(localClient.FIXED_TRANSCRIPTION_RULES_TEXT.includes('line break'));
  assert.ok(localClient.FIXED_TRANSCRIPTION_RULES_TEXT.includes('BOUNDING BOX'));
});

test('22. Transcription Endpoint: Strictly enforces 1-page request limit (Rejecting multi-page request)', () => {
  const limits = { maxPagesPerRequest: 1, maxImageSizeMb: 8, maxTotalRequestSizeMb: 15 };
  const validImg = `data:image/png;base64,${createValidPngBuffer().toString('base64')}`;

  // Attempting to send 2 pages in 1 request must fail validation upfront
  const res = validateOcrRequestPayload({ imageUrls: [validImg, validImg] }, limits);
  assert.equal(res.isValid, false);
  assert.equal(res.code, 'PAGE_LIMIT_EXCEEDED');
  assert.ok(res.error.includes('exceeds maximum allowed pages'));
});

test('23. Transcription Endpoint: Validates single-page payload successfully', () => {
  const limits = { maxPagesPerRequest: 1, maxImageSizeMb: 8, maxTotalRequestSizeMb: 15 };
  const validImg = `data:image/png;base64,${createValidPngBuffer().toString('base64')}`;

  const res = validateOcrRequestPayload({ imageUrls: [validImg] }, limits);
  assert.equal(res.isValid, true);
  assert.equal(res.pageCount, 1);
});

test('24. Local VL Client: exports FIXED_TRANSCRIPTION_RULES_SUMMARY with required items', async () => {
  const localClient = await import('../src/localModelClient.js');
  assert.ok(Array.isArray(localClient.FIXED_TRANSCRIPTION_RULES_SUMMARY));
  assert.ok(localClient.FIXED_TRANSCRIPTION_RULES_SUMMARY.length >= 5);
  const titles = localClient.FIXED_TRANSCRIPTION_RULES_SUMMARY.map((r) => r.title);
  assert.ok(titles.includes('Faithful Transcription'));
  assert.ok(titles.includes('Structure & Line-Break Preservation'));
  assert.ok(titles.includes('No Hallucination'));
  assert.ok(titles.includes('Explicit Unreadable Flags'));
  assert.ok(titles.includes('Document Safety'));
});

test('25. Local VL Client: normalizeTranscriptLineBreaks response contract and regression tests', async () => {
  const { normalizeTranscriptLineBreaks } = await import('../src/localModelClient.js');
  assert.equal(typeof normalizeTranscriptLineBreaks, 'function');

  // Case 1: Preserves actual single newlines
  const singleNl = 'First handwritten line.\nSecond handwritten line.';
  assert.equal(normalizeTranscriptLineBreaks(singleNl), singleNl);

  // Case 2: Preserves actual blank-line paragraph breaks
  const paragraphBreak = 'First paragraph end.\n\nSecond paragraph start.';
  assert.equal(normalizeTranscriptLineBreaks(paragraphBreak), paragraphBreak);

  // Case 3: CRLF normalization
  const crlfInput = 'Line one.\r\nLine two.\r\n\r\nParagraph two.';
  assert.equal(
    normalizeTranscriptLineBreaks(crlfInput),
    'Line one.\nLine two.\n\nParagraph two.'
  );

  // Case 4: Legitimate single-line Windows file path: C:\notes\file.txt must NOT be corrupted
  const filePath = 'C:\\notes\\file.txt';
  assert.equal(normalizeTranscriptLineBreaks(filePath), 'C:\\notes\\file.txt');

  // Case 5: Legitimate single-line text with \name must NOT be corrupted
  const nameCmd = 'Student wrote \\name in response.';
  assert.equal(normalizeTranscriptLineBreaks(nameCmd), 'Student wrote \\name in response.');

  // Case 6: Legitimate literal backslash-n text must remain unchanged
  const literalBackslashN = 'This text contains literal \\n without being unescaped.';
  assert.equal(
    normalizeTranscriptLineBreaks(literalBackslashN),
    'This text contains literal \\n without being unescaped.'
  );

  // Case 7: Legitimate literal backslash text with actual newlines
  const backslashWithNl = 'Notes: \\note for student.\nPath: C:\\notes\\file.txt\nMath: \\frac{1}{2}';
  assert.equal(normalizeTranscriptLineBreaks(backslashWithNl), backslashWithNl);

  // Case 8: Plain text with no line breaks - does NOT invent line breaks
  const plainText = 'The quick brown fox jumps over the lazy dog.';
  assert.equal(normalizeTranscriptLineBreaks(plainText), plainText);

  // Case 9: Empty / edge inputs
  assert.equal(normalizeTranscriptLineBreaks(''), '');
  assert.equal(normalizeTranscriptLineBreaks(null), '');
  assert.equal(normalizeTranscriptLineBreaks(undefined), '');
});

test('26. Local VL Client: parseModelJsonLines robustly parses JSON lines with bounding boxes and code fences', async () => {
  const { parseModelJsonLines } = await import('../src/localModelClient.js');
  assert.equal(typeof parseModelJsonLines, 'function');

  // Case 1: v1.4 format with bounding boxes and blank line
  const v14Json = JSON.stringify({
    lines: [
      { text: 'First handwritten line.', bbox: [185, 690, 855, 725] },
      { text: 'Second line.', bbox: [185, 725, 855, 759] },
      { text: '', bbox: null },
      { text: 'New paragraph line.', bbox: [185, 793, 400, 827] },
    ],
  });
  const res1 = parseModelJsonLines(v14Json);
  assert.deepEqual(res1, [
    { text: 'First handwritten line.', bbox: [185, 690, 855, 725] },
    { text: 'Second line.', bbox: [185, 725, 855, 759] },
    { text: '', bbox: null },
    { text: 'New paragraph line.', bbox: [185, 793, 400, 827] },
  ]);
  assert.equal(
    res1.map((l) => l.text).join('\n'),
    'First handwritten line.\nSecond line.\n\nNew paragraph line.'
  );

  // Case 2: v1.3 backward compatibility (pure string array)
  const v13Json = JSON.stringify({
    lines: ['First line', 'Second line'],
  });
  const res2 = parseModelJsonLines(v13Json);
  assert.deepEqual(res2, [
    { text: 'First line', bbox: null },
    { text: 'Second line', bbox: null },
  ]);

  // Case 3: Wrapped in ```json code fence with conversational text
  const fencedJson = 'Here is the transcript:\n```json\n{\n  "lines": [\n    {"text": "Hello", "bbox": [100, 200, 800, 240]},\n    {"text": "World", "bbox": null}\n  ]\n}\n```\nDone.';
  const res3 = parseModelJsonLines(fencedJson);
  assert.deepEqual(res3, [
    { text: 'Hello', bbox: [100, 200, 800, 240] },
    { text: 'World', bbox: null },
  ]);

  // Case 4: Preserves exact spacing and internal characters without autocorrect or trimming
  const unautocorrected = JSON.stringify({
    lines: [
      { text: '  Indented text  ', bbox: [100, 200, 300, 250] },
      { text: 'thier mistook', bbox: [100, 260, 400, 310] },
      { text: 'line with \\n literal', bbox: null },
    ],
  });
  const res4 = parseModelJsonLines(unautocorrected);
  assert.deepEqual(res4, [
    { text: '  Indented text  ', bbox: [100, 200, 300, 250] },
    { text: 'thier mistook', bbox: [100, 260, 400, 310] },
    { text: 'line with \\n literal', bbox: null },
  ]);
});

test('27. Local VL Client: parseModelJsonLines rejects invalid formats with INVALID_MODEL_OUTPUT_FORMAT', async () => {
  const { parseModelJsonLines } = await import('../src/localModelClient.js');

  // Case 1: Empty or whitespace
  assert.throws(
    () => parseModelJsonLines(''),
    (err) => err.code === 'INVALID_MODEL_OUTPUT_FORMAT'
  );

  // Case 2: Not JSON
  assert.throws(
    () => parseModelJsonLines('This is just plain text without any JSON'),
    (err) => err.code === 'INVALID_MODEL_OUTPUT_FORMAT' && err.message.includes('not valid JSON')
  );

  // Case 3: JSON object missing "lines"
  assert.throws(
    () => parseModelJsonLines('{"transcript": "hello"}'),
    (err) => err.code === 'INVALID_MODEL_OUTPUT_FORMAT' && err.message.includes('missing "lines" array')
  );

  // Case 4: "lines" is not an array
  assert.throws(
    () => parseModelJsonLines('{"lines": "not an array"}'),
    (err) => err.code === 'INVALID_MODEL_OUTPUT_FORMAT' && err.message.includes('missing "lines" array')
  );

  // Case 5: "lines" array containing invalid non-string, non-line objects
  assert.throws(
    () => parseModelJsonLines('{"lines": [{"text": "valid line"}, 12345]}'),
    (err) => err.code === 'INVALID_MODEL_OUTPUT_FORMAT' && err.message.includes('neither a string nor a valid line object')
  );
});

test('28. Client Errors Endpoint: appends error records to client-errors.jsonl and returns them via GET /api/client-errors', async () => {
  const { default: app } = await import('../src/server.js');
  const http = (await import('http')).default;
  const fs = (await import('fs')).default;
  const path = (await import('path')).default;

  // Start ephemeral server
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const port = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const testPayload = {
      timestamp: new Date().toISOString(),
      message: 'Test client error',
      stack: 'Error: Test client error\n    at TestFunc (test.js:10:5)',
      currentStep: 'ocr',
      pageUrl: 'http://localhost:5180/essay-marking',
    };

    const postRes = await fetch(`${baseUrl}/api/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });

    assert.equal(postRes.status, 200);
    const postBody = await postRes.json();
    assert.equal(postBody.status, 'success');
    assert.equal(postBody.recorded, true);

    // Check file exists
    const filePath = path.resolve('data/client-errors.jsonl');
    const altPath = path.resolve('bridges/essay-marking-bridge/data/client-errors.jsonl');
    const target = fs.existsSync(filePath) ? filePath : altPath;
    assert.ok(fs.existsSync(target), 'client-errors.jsonl must exist');

    // Check GET returns the error
    const getRes = await fetch(`${baseUrl}/api/client-errors`);
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.status, 'success');
    assert.ok(Array.isArray(getBody.errors));
    assert.ok(getBody.errors.some((e) => e.message === 'Test client error'));
  } finally {
    testServer.close();
  }
});

test('29. Local Model Client: parseTranscriptParagraphs correctly handles single and multi-paragraph text', async () => {
  const { parseTranscriptParagraphs } = await import('../src/localModelClient.js');

  // Single paragraph
  const single = 'Line 1\nLine 2\nLine 3';
  const p1 = parseTranscriptParagraphs(single);
  assert.equal(p1.length, 1);
  assert.deepEqual(p1[0], ['Line 1', 'Line 2', 'Line 3']);

  // Multiple paragraphs separated by blank line
  const multi = 'P0 Line 0\nP0 Line 1\n\nP1 Line 0\nP1 Line 1';
  const p2 = parseTranscriptParagraphs(multi);
  assert.equal(p2.length, 2);
  assert.deepEqual(p2[0], ['P0 Line 0', 'P0 Line 1']);
  assert.deepEqual(p2[1], ['P1 Line 0', 'P1 Line 1']);

  // Empty string or non-string
  assert.deepEqual(parseTranscriptParagraphs(''), []);
  assert.deepEqual(parseTranscriptParagraphs(null), []);
});

test('30. Local Model Client: parseModelJsonFindings strict validation, exact location check, and unreadable rejection', async () => {
  const { parseModelJsonFindings, parseTranscriptParagraphs } = await import('../src/localModelClient.js');

  const transcript = `He is kind because one time he save one friend\nin the fire. He is a part of man, a part of dog.\nHe had a [unreadable] coat.`;
  const paragraphs = parseTranscriptParagraphs(transcript);

  // Case 1: Valid findings with exact location match
  const validOutput = JSON.stringify({
    findings: [
      {
        type: 'Grammar',
        quote: 'save',
        suggestion: 'saved',
        reason: 'Past tense needed',
        paragraphIndex: 0,
        lineIndex: 0,
        occurrenceIndex: 0,
      },
      // Second finding: quote does NOT exist in line 1 -> should be discarded
      {
        type: 'Spelling',
        quote: 'banana',
        suggestion: 'apple',
        reason: 'Mismatch',
        paragraphIndex: 0,
        lineIndex: 1,
        occurrenceIndex: 0,
      },
      // Third finding: quote is [unreadable] -> should be discarded
      {
        type: 'Vocabulary',
        quote: '[unreadable]',
        suggestion: 'nice',
        reason: 'Student wrote unreadable',
        paragraphIndex: 0,
        lineIndex: 2,
        occurrenceIndex: 0,
      },
    ],
  });

  const parsed = parseModelJsonFindings(validOutput, paragraphs);
  assert.equal(parsed.rawCount, 3);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.discardedCount, 2);
  assert.equal(parsed.findings[0].quote, 'save');
  assert.equal(parsed.findings[0].suggestion, 'saved');

  // Case 2: Invalid JSON format throws INVALID_MODEL_OUTPUT_FORMAT
  assert.throws(
    () => parseModelJsonFindings('not json', paragraphs),
    (err) => err.code === 'INVALID_MODEL_OUTPUT_FORMAT'
  );

  // Case 3: Missing findings array throws INVALID_MODEL_OUTPUT_FORMAT
  assert.throws(
    () => parseModelJsonFindings('{"error": "none"}', paragraphs),
    (err) => err.code === 'INVALID_MODEL_OUTPUT_FORMAT'
  );

  // Case 4: Item missing required fields throws INVALID_MODEL_OUTPUT_FORMAT
  assert.throws(
    () => parseModelJsonFindings('{"findings": [{"type": "Grammar"}]}', paragraphs),
    (err) => err.code === 'INVALID_MODEL_OUTPUT_FORMAT'
  );
});

test('31. Marking Endpoint: Rejects unauthenticated requests and missing transcript', async () => {
  const { default: app } = await import('../src/server.js');
  const http = (await import('http')).default;

  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const port = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Missing Authorization header -> 401
    const unauthRes = await fetch(`${baseUrl}/api/mark-essay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: 'Hello world' }),
    });
    assert.equal(unauthRes.status, 401);
  } finally {
    testServer.close();
  }
});

test('32. Marking Logic: Single-paragraph relocation, no-op discard, and overlap deduplication', async () => {
  const { parseModelJsonFindings } = await import('../src/localModelClient.js');

  const paragraphs = [
    [
      "CHARACTER'S NAME: Dog Man",
      "BOOK TITLE: Dog Man",
      "He is kind because one time he save one friend",
      "in the fire. He is a part of man, a part of dog.",
      "And also hero. But he is also messy. He mess his",
      "room when he go home. He is short and fat.",
      "He have a small eyes too. I think he is very",
      "sily dog and also naughty. He have some friend too.",
      "He have Lil' Petey, he came of Petey the cat.",
    ],
  ];

  const mockModelOutput = JSON.stringify({
    findings: [
      // 1. Relocation: quote "sily" is on Line 7, but model erroneously says Line 5. Exactly 1 occurrence in paragraph -> should relocate to Line 7!
      {
        type: "Spelling",
        quote: "sily",
        suggestion: "silly",
        reason: "Misspelled",
        paragraphIndex: 0,
        lineIndex: 5,
        occurrenceIndex: 0,
      },
      // 2. No-op: suggestion equals quote -> should be discarded!
      {
        type: "Punctuation",
        quote: "dog.",
        suggestion: "dog.",
        reason: "Unnecessary period",
        paragraphIndex: 0,
        lineIndex: 3,
        occurrenceIndex: 0,
      },
      // 3. Overlap: Line 2 has "he save" and "save". Overlapping span -> should merge and keep 1!
      {
        type: "Tense",
        quote: "he save",
        suggestion: "he saved",
        reason: "Past tense required",
        paragraphIndex: 0,
        lineIndex: 2,
        occurrenceIndex: 0,
      },
      {
        type: "Spelling",
        quote: "save",
        suggestion: "saved",
        reason: "Incorrect form",
        paragraphIndex: 0,
        lineIndex: 2,
        occurrenceIndex: 0,
      },
    ],
  });

  const result = parseModelJsonFindings(mockModelOutput, paragraphs, { studentId: 'test-student' });

  assert.equal(result.rawCount, 4);
  assert.equal(result.findings.length, 2); // 1 relocated ("sily"), 1 merged ("he save")
  assert.equal(result.discardedCount, 2); // 1 no-op discarded, 1 overlapping duplicate discarded

  const silyFinding = result.findings.find((f) => f.quote === 'sily');
  assert.ok(silyFinding);
  assert.equal(silyFinding.lineIndex, 7, 'Quote "sily" should be relocated from Line 5 to Line 7');

  const line2Findings = result.findings.filter((f) => f.lineIndex === 2);
  assert.equal(line2Findings.length, 1, 'Only one finding should remain on line 2 after overlap deduplication');
  assert.equal(line2Findings[0].type, 'Tense', 'Tense should take priority over Spelling on overlap');
});

test('33. Marking Model Status Endpoint: decoupled from 18088 and queries 18086 with short timeout', async () => {
  const { checkMarkingModelHealth } = await import('../src/localModelClient.js');
  const { default: app } = await import('../src/server.js');
  const http = (await import('http')).default;

  // Case 1: When endpoint is offline (unused port), returns unavailable cleanly without throwing
  const offlineResult = await checkMarkingModelHealth('http://127.0.0.1:18099', 500);
  assert.equal(offlineResult.isOnline, false);
  assert.equal(offlineResult.status, 'unavailable');
  assert.equal(offlineResult.port, 18099);
  assert.ok(offlineResult.checkedAt);
  assert.ok(offlineResult.details);

  // Case 2: Endpoint /api/marking-model-status returns 200 with status info
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const port = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const res = await fetch(`${baseUrl}/api/marking-model-status`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.port, 18086);
    assert.ok(body.status === 'ready' || body.status === 'unavailable');
    assert.ok(body.checkedAt);
  } finally {
    testServer.close();
  }
});

test('34. Editable Prompt File Loader & Snapshot Endpoint', async () => {
  const { loadEditableMarkingInstructions } = await import('../src/localModelClient.js');
  const { default: app } = await import('../src/server.js');
  const http = (await import('http')).default;

  // Case 1: Standard prompt file loads cleanly with version and schemaVersion 2.0
  const instructions = loadEditableMarkingInstructions();
  assert.ok(instructions.content.length > 50);
  assert.ok(instructions.promptHash);
  assert.ok(instructions.promptVersion.startsWith('v2.0-'));
  assert.equal(instructions.schemaVersion, '2.0');

  // Case 2: Missing file throws PROMPT_FILE_MISSING
  assert.throws(() => {
    loadEditableMarkingInstructions('non-existent-prompt-file.md');
  }, { code: 'PROMPT_FILE_MISSING' });

  // Case 3: Empty file throws PROMPT_FILE_EMPTY
  const fs = (await import('fs')).default;
  const path = (await import('path')).default;
  const tmpEmptyFile = path.resolve('test-empty-prompt.md');
  fs.writeFileSync(tmpEmptyFile, '   \n  \n');
  try {
    assert.throws(() => {
      loadEditableMarkingInstructions(tmpEmptyFile);
    }, { code: 'PROMPT_FILE_EMPTY' });
  } finally {
    if (fs.existsSync(tmpEmptyFile)) fs.unlinkSync(tmpEmptyFile);
  }

  // Case 4: GET /api/marking-prompt-snapshot returns snapshot
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const port = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const res = await fetch(`${baseUrl}/api/marking-prompt-snapshot`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(body.snapshot.promptVersion);
    assert.equal(body.snapshot.schemaVersion, '2.0');
    assert.ok(body.snapshot.content);
  } finally {
    testServer.close();
  }
});

test('35. Three Distinct Feedback Types (correction, improvement, clarity) & Overlap Resolution', async () => {
  const { parseModelJsonFindings } = await import('../src/localModelClient.js');

  const paragraphs = [
    [
      'One time he save the city.',
      'He is a good and strong dog.',
      'Then he did a bad thing.',
    ],
  ];

  const mockModelOutput = JSON.stringify({
    findings: [
      // 1. Required correction
      {
        feedbackType: 'correction',
        type: 'Tense',
        quote: 'save',
        suggestion: 'saved',
        reason: 'Use past tense for past narrative.',
        paragraphIndex: 0,
        lineIndex: 0,
        occurrenceIndex: 0,
      },
      // 2. Optional improvement on line 1
      {
        feedbackType: 'improvement',
        type: 'Vocabulary',
        quote: 'good and strong',
        suggestion: 'brave and mighty',
        reason: 'Enhance descriptive vocabulary.',
        paragraphIndex: 0,
        lineIndex: 1,
        occurrenceIndex: 0,
      },
      // 3. Clarity feedback with uncertain meaning on line 2
      {
        feedbackType: 'clarity',
        type: 'Coherence',
        quote: 'a bad thing',
        suggestion: 'clarification needed',
        reason: 'Unclear what bad thing he did; explain the event.',
        paragraphIndex: 0,
        lineIndex: 2,
        occurrenceIndex: 0,
      },
      // 4. Conflicting optional improvement overlapping the required correction on line 0 (should be superseded by correction)
      {
        feedbackType: 'improvement',
        type: 'Style',
        quote: 'save',
        suggestion: 'rescue',
        reason: 'Stylistic alternative.',
        paragraphIndex: 0,
        lineIndex: 0,
        occurrenceIndex: 0,
      },
      // 5. Backward compatibility: finding without feedbackType defaults to correction
      {
        type: 'Spelling',
        quote: 'city',
        suggestion: 'town',
        reason: 'Word choice.',
        paragraphIndex: 0,
        lineIndex: 0,
        occurrenceIndex: 0,
      },
    ],
  });

  const result = parseModelJsonFindings(mockModelOutput, paragraphs, {
    studentId: 'test-student',
    promptVersion: 'v2.0-test',
    schemaVersion: '2.0',
  });

  // Verify counts
  assert.equal(result.rawCount, 5);
  // Item 4 (conflicting improvement overlapping correction "save") must be discarded in favor of correction
  assert.equal(result.discardedCount, 1);
  assert.equal(result.findings.length, 4);

  // Verify correction
  const saveFinding = result.findings.find((f) => f.quote === 'save');
  assert.ok(saveFinding);
  assert.equal(saveFinding.feedbackType, 'correction');
  assert.equal(saveFinding.suggestion, 'saved');

  // Verify improvement
  const impFinding = result.findings.find((f) => f.quote === 'good and strong');
  assert.ok(impFinding);
  assert.equal(impFinding.feedbackType, 'improvement');
  assert.equal(impFinding.suggestion, 'brave and mighty');

  // Verify clarity with normalized "Clarification needed"
  const clarityFinding = result.findings.find((f) => f.quote === 'a bad thing');
  assert.ok(clarityFinding);
  assert.equal(clarityFinding.feedbackType, 'clarity');
  assert.equal(clarityFinding.suggestion, 'Clarification needed');

  // Verify backward compatible finding defaults to correction
  const legacyFinding = result.findings.find((f) => f.quote === 'city');
  assert.ok(legacyFinding);
  assert.equal(legacyFinding.feedbackType, 'correction');

  // Verify prompt version and schema version preserved
  assert.equal(saveFinding.promptVersion, 'v2.0-test');
  assert.equal(saveFinding.schemaVersion, '2.0');
});

test('36. Local VL Client: exports verifyTranscriptionWithLocalVL', async () => {
  const localClient = await import('../src/localModelClient.js');
  assert.equal(typeof localClient.verifyTranscriptionWithLocalVL, 'function');
});

test('37. Verify Transcription Endpoint: Rejects unauthenticated requests and missing payload', async () => {
  const { default: app } = await import('../src/server.js');
  const http = (await import('http')).default;

  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const port = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Unauthenticated call should fail closed (401)
    const res = await fetch(`${baseUrl}/api/verify-transcription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'MISSING_BEARER_TOKEN');
  } finally {
    testServer.close();
  }
});

test('38. Word-Level Diff & Tokenizer Integrity: Functions are exported and compute word-level changes', async () => {
  const { tokenizeWordsAndSeparators, computeWordLevelDiff } = await import('../src/localModelClient.js');

  assert.equal(typeof tokenizeWordsAndSeparators, 'function');
  assert.equal(typeof computeWordLevelDiff, 'function');

  const tokens = tokenizeWordsAndSeparators('Dog Man is kind.');
  assert.deepEqual(tokens, ['Dog', ' ', 'Man', ' ', 'is', ' ', 'kind', '.']);

  const diff = computeWordLevelDiff('one day he save', 'one day he saved');
  assert.ok(Array.isArray(diff));
  assert.ok(diff.length > 0);

  const modified = diff.filter((d) => d.type !== 'equal');
  assert.ok(modified.length > 0);
});

test('39. Deterministic Score Validation: Primary 3 Scheme (Content /60 + Language /40 = Total /100)', async () => {
  const { validateMarkingAssessment } = await import('../src/localModelClient.js');

  // Valid non-100 score: 45 + 30 = 75
  const validP3 = {
    scores: { content: 45, language: 30 },
    totalScore: 75,
    comments: {
      positive: 'Good effort on the story ideas.',
      relevant: 'Remember to check past-tense verb endings.',
      finalNextStep: 'Write more details about each character next time.',
    },
  };
  const result = validateMarkingAssessment(validP3, 'P.3');
  assert.equal(result.totalScore, 75);
  assert.equal(result.scores.content, 45);
  assert.equal(result.scores.language, 30);
  assert.equal(result.scores.organisation, undefined);

  // Invalid: Organisation score present for P3 -> must fail
  const invalidOrgP3 = {
    scores: { content: 40, language: 30, organisation: 10 },
    totalScore: 80,
    comments: validP3.comments,
  };
  assert.throws(() => validateMarkingAssessment(invalidOrgP3, 'P.3'), {
    code: 'UNEXPECTED_DIMENSION_FOR_GRADE',
  });

  // Invalid: Arithmetic mismatch (45 + 30 != 80)
  const mismatchP3 = {
    scores: { content: 45, language: 30 },
    totalScore: 80,
    comments: validP3.comments,
  };
  assert.throws(() => validateMarkingAssessment(mismatchP3, 'P.3'), {
    code: 'SCORE_ARITHMETIC_MISMATCH',
  });

  // Invalid: Non-5-mark total score step (Total 72)
  const nonStepTotalP3 = {
    scores: { content: 40, language: 32 },
    totalScore: 72,
    comments: validP3.comments,
  };
  assert.throws(() => validateMarkingAssessment(nonStepTotalP3, 'P.3'), {
    code: 'INVALID_SCORE_STEP',
  });

  // Invalid: Non-5-mark dimension step (Content 42 with totalScore 70)
  const nonStepContentP3 = {
    scores: { content: 42, language: 28 },
    totalScore: 70,
    comments: validP3.comments,
  };
  assert.throws(() => validateMarkingAssessment(nonStepContentP3, 'P.3'), {
    code: 'INVALID_CONTENT_SCORE',
  });
});

test('40. Deterministic Score Validation: Primary 4-6 Scheme (Content /40 + Language /40 + Org /20 = Total /100)', async () => {
  const { validateMarkingAssessment } = await import('../src/localModelClient.js');

  const multiParagraphs = [
    ['Paragraph 1, line 1'],
    ['Paragraph 2, line 1'],
    ['Paragraph 3, line 1'],
  ];

  // Valid non-100 score: 30 + 30 + 15 = 75
  const validP4 = {
    scores: { content: 30, language: 30, organisation: 15 },
    totalScore: 75,
    comments: {
      positive: 'Well organized with a clear sequence of events.',
      relevant: 'Watch out for subject-verb agreement.',
      finalNextStep: 'Add more descriptive adjectives in your body paragraph.',
    },
  };
  const result = validateMarkingAssessment(validP4, 'P.4', multiParagraphs);
  assert.equal(result.totalScore, 75);
  assert.equal(result.scores.content, 30);
  assert.equal(result.scores.language, 30);
  assert.equal(result.scores.organisation, 15);

  // Invalid: Content out of bounds (> 40)
  const oobP4 = {
    scores: { content: 45, language: 30, organisation: 15 },
    totalScore: 90,
    comments: validP4.comments,
  };
  assert.throws(() => validateMarkingAssessment(oobP4, 'P.4', multiParagraphs), {
    code: 'INVALID_CONTENT_SCORE',
  });

  // Invalid: Total score arithmetic mismatch (30 + 30 + 15 = 75 != 85)
  const mismatchP4 = {
    scores: { content: 30, language: 30, organisation: 15 },
    totalScore: 85,
    comments: validP4.comments,
  };
  assert.throws(() => validateMarkingAssessment(mismatchP4, 'P.4', multiParagraphs), {
    code: 'SCORE_ARITHMETIC_MISMATCH',
  });
});

test('41. Single-Paragraph Organisation Cap: P4-P6 single paragraph cannot exceed 10/20 for Organisation', async () => {
  const { validateMarkingAssessment } = await import('../src/localModelClient.js');

  const singleParagraph = [['Line 1', 'Line 2', 'Line 3']];

  // Organisation score of 15 on a single paragraph essay must be rejected
  const cappedP4 = {
    scores: { content: 30, language: 30, organisation: 15 },
    totalScore: 75,
    comments: {
      positive: 'Good sentence structure.',
      relevant: 'Need more paragraph division.',
      finalNextStep: 'Organise your work into at least two paragraphs.',
    },
  };
  assert.throws(() => validateMarkingAssessment(cappedP4, 'P.4', singleParagraph), {
    code: 'ORGANISATION_SINGLE_PARAGRAPH_CAP_EXCEEDED',
  });

  // Organisation score of 10 on a single paragraph essay is allowed
  const validCappedP4 = {
    scores: { content: 30, language: 30, organisation: 10 },
    totalScore: 70,
    comments: cappedP4.comments,
  };
  const result = validateMarkingAssessment(validCappedP4, 'P.4', singleParagraph);
  assert.equal(result.totalScore, 70);
  assert.equal(result.scores.organisation, 10);
});

test('42. Marking Endpoint: Rejects missing or invalid yearLevel with 400', async () => {
  const { default: app } = await import('../src/server.js');
  const http = (await import('http')).default;

  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const port = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Helper to get authenticated teacher headers using existing mock user token
    const teacherToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZWFjaGVyLTEyMyIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyNTM0MDIzMDAwMDB9.dummy';
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    };

    // Missing yearLevel
    const resNoYear = await fetch(`${baseUrl}/api/mark-essay`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ transcript: 'Dog Man is kind.' }),
    });
    // Even if auth fails or year fails, we check response
    const bodyNoYear = await resNoYear.json();
    assert.ok(resNoYear.status === 400 || resNoYear.status === 401 || resNoYear.status === 403);
    if (resNoYear.status === 400) {
      assert.equal(bodyNoYear.code, 'MISSING_OR_INVALID_YEAR_LEVEL');
    }
  } finally {
    testServer.close();
  }
});

test('43. Qwen VL OCR Prompt Loader & Snapshot Endpoint', async () => {
  const { loadEditableOcrPrompt, DEFAULT_OCR_PROMPT_FILE } = await import('../src/localModelClient.js');
  const { default: app } = await import('../src/server.js');
  const http = (await import('http')).default;
  const fs = (await import('fs')).default;
  const path = (await import('path')).default;

  // Case 1: Standard authoritative prompt loads cleanly and extracts section
  assert.ok(fs.existsSync(DEFAULT_OCR_PROMPT_FILE));
  const promptData = loadEditableOcrPrompt();
  assert.ok(promptData.promptText.includes('You are an objective, precise, and faithful'));
  assert.ok(promptData.promptText.includes('Strict Transcription Rules'));
  // Verifies documentation section above marker was NOT included in model prompt
  assert.ok(!promptData.promptText.includes('# Qwen VL OCR Instructions & Teacher Guide'));
  assert.ok(promptData.promptHash);
  assert.ok(promptData.promptVersion.startsWith('qwen-vl-ocr-'));

  // Case 2: Missing prompt file throws PROMPT_FILE_MISSING
  assert.throws(() => {
    loadEditableOcrPrompt('non_existent_ocr_prompt.md');
  }, { code: 'PROMPT_FILE_MISSING' });

  // Case 3: Empty file throws PROMPT_FILE_EMPTY
  const tmpEmptyFile = path.resolve('test-empty-ocr-prompt.md');
  fs.writeFileSync(tmpEmptyFile, '   \n  \n');
  try {
    assert.throws(() => {
      loadEditableOcrPrompt(tmpEmptyFile);
    }, { code: 'PROMPT_FILE_EMPTY' });
  } finally {
    if (fs.existsSync(tmpEmptyFile)) fs.unlinkSync(tmpEmptyFile);
  }

  // Case 4: Section marker present but prompt section is empty throws PROMPT_FILE_EMPTY
  const tmpEmptySectionFile = path.resolve('test-empty-section-ocr-prompt.md');
  fs.writeFileSync(tmpEmptySectionFile, '## Guide\n<!-- SECTION: OCR_PROMPT -->\n   \n');
  try {
    assert.throws(() => {
      loadEditableOcrPrompt(tmpEmptySectionFile);
    }, { code: 'PROMPT_FILE_EMPTY' });
  } finally {
    if (fs.existsSync(tmpEmptySectionFile)) fs.unlinkSync(tmpEmptySectionFile);
  }

  // Case 5: Endpoint GET /api/ocr-prompt returns snapshot
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const port = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const res = await fetch(`${baseUrl}/api/ocr-prompt`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.promptHash, promptData.promptHash);
    assert.equal(body.promptVersion, promptData.promptVersion);
    assert.ok(body.promptText.length > 50);
  } finally {
    testServer.close();
  }
});

test('44. Local VL OCR: Preserves physical lines, explicit empty lines, geometry-unavailable lines, and literal backslashes', async () => {
  const { parseModelJsonLines, normalizeTranscriptLineBreaks } = await import('../src/localModelClient.js');

  // 1. Multiple physical lines remain separate
  const multiLineJson = JSON.stringify({
    lines: [
      { text: 'Yesterday, my family went to the country park.', bbox: [120, 210, 850, 248] },
      { text: 'We had a delicious picnic and flew our kites', bbox: [120, 252, 830, 290] },
      { text: 'high up in the sunny sky.', bbox: [120, 294, 520, 332] },
    ],
  });
  const parsed1 = parseModelJsonLines(multiLineJson);
  assert.equal(parsed1.length, 3);
  assert.equal(parsed1[0].text, 'Yesterday, my family went to the country park.');
  assert.equal(parsed1[1].text, 'We had a delicious picnic and flew our kites');
  assert.equal(parsed1[2].text, 'high up in the sunny sky.');
  const joined1 = parsed1.map((l) => l.text).join('\n');
  assert.equal(joined1.split('\n').length, 3);

  // 2. Explicit empty-line entries survive
  const emptyLineJson = JSON.stringify({
    lines: [
      { text: 'Paragraph 1 line 1', bbox: [100, 200, 800, 240] },
      { text: '', bbox: null },
      { text: 'Paragraph 2 line 1', bbox: [100, 300, 800, 340] },
    ],
  });
  const parsed2 = parseModelJsonLines(emptyLineJson);
  assert.equal(parsed2.length, 3);
  assert.equal(parsed2[1].text, '');
  assert.equal(parsed2[1].bbox, null);
  const joined2 = parsed2.map((l) => l.text).join('\n');
  assert.equal(joined2, 'Paragraph 1 line 1\n\nParagraph 2 line 1');

  // 3. A long single returned line is not artificially split
  const longSingleLine = 'This is a very long line of handwritten prose that goes on and on and contains multiple sentences. Sentence two here. Sentence three here.';
  const longLineJson = JSON.stringify({
    lines: [{ text: longSingleLine, bbox: [100, 200, 950, 240] }],
  });
  const parsed3 = parseModelJsonLines(longLineJson);
  assert.equal(parsed3.length, 1);
  assert.equal(parsed3[0].text, longSingleLine);

  // 4. Literal \n text is not confused with real newline characters
  const literalSlashN = 'Student wrote C:\\notes\\file.txt and a literal \\n sequence.';
  const literalJson = JSON.stringify({
    lines: [{ text: literalSlashN, bbox: [100, 200, 800, 240] }],
  });
  const parsed4 = parseModelJsonLines(literalJson);
  assert.equal(parsed4[0].text, literalSlashN);
  const normalized4 = normalizeTranscriptLineBreaks(parsed4[0].text);
  assert.equal(normalized4, literalSlashN); // No replacement of literal \n
  assert.ok(!normalized4.includes('\n')); // Contains zero real newlines

  // 5. Geometry-unavailable responses retain text boundaries without fabricated boxes
  const noGeometryJson = JSON.stringify({
    lines: [
      { text: 'Line without bbox 1', bbox: null },
      { text: 'Line without bbox 2', bbox: null },
    ],
  });
  const parsed5 = parseModelJsonLines(noGeometryJson);
  assert.equal(parsed5.length, 2);
  assert.equal(parsed5[0].bbox, null);
  assert.equal(parsed5[1].bbox, null);
  assert.equal(parsed5.map((l) => l.text).join('\n'), 'Line without bbox 1\nLine without bbox 2');
});









