/**
 * imageValidator.js — Comprehensive image payload, MIME, magic-byte,
 * structural integrity, and dimension validator.
 * 
 * Strict validation:
 * - Only supported data URIs: image/jpeg, image/png, image/webp.
 * - Rejects HTTP/HTTPS URLs, local file paths, PDFs, and malformed strings.
 * - Validates base64 integrity and decoded byte sizes.
 * - Inspects magic bytes and matches against declared MIME.
 * - Structural integrity check: verifies SOF/EOI for JPEG, IHDR/IEND for PNG, RIFF/VP8 for WebP.
 * - Enforces minimum and maximum pixel dimension limits (50px to 8192px, <= 32MP).
 * - Validates ALL pages upfront before returning.
 */

const SUPPORTED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Magic byte signatures
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_IEND = Buffer.from([0x49, 0x45, 0x4e, 0x44]); // 'IEND'

/**
 * Validates a single image buffer for JPEG structure and dimensions.
 */
function validateJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
    return { valid: false, error: 'File declared as JPEG does not have valid JPEG magic bytes (FF D8 FF).' };
  }

  // Must end with EOI marker (FF D9), allowing for up to 32 bytes of trailing metadata/padding
  const searchTail = buffer.subarray(Math.max(0, buffer.length - 64));
  let hasEoi = false;
  for (let i = 0; i < searchTail.length - 1; i++) {
    if (searchTail[i] === 0xff && searchTail[i + 1] === 0xd9) {
      hasEoi = true;
      break;
    }
  }

  if (!hasEoi) {
    return { valid: false, error: 'JPEG is truncated or missing End-Of-Image (EOI FF D9) marker.' };
  }

  // Parse SOF markers to extract dimensions
  let offset = 2;
  let width = 0;
  let height = 0;
  let foundSof = false;

  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    // Skip fill bytes 0xFF
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset++;
    }

    if (offset >= buffer.length) break;
    const marker = buffer[offset];
    offset++;

    // Markers without length
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      continue;
    }

    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);

    // SOF markers: C0, C1, C2, C3, C5, C6, C7, C9, CA, CB, CD, CE, CF
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSof && length >= 7 && offset + length <= buffer.length) {
      height = buffer.readUInt16BE(offset + 3);
      width = buffer.readUInt16BE(offset + 5);
      foundSof = true;
      break;
    }

    offset += length;
  }

  if (!foundSof || width === 0 || height === 0) {
    return { valid: false, error: 'JPEG is corrupted: Start-Of-Frame (SOF) marker with dimensions not found.' };
  }

  return { valid: true, width, height };
}

/**
 * Validates a single image buffer for PNG structure and dimensions.
 */
function validatePng(buffer) {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    return { valid: false, error: 'File declared as PNG does not match PNG signature (89 50 4E 47 0D 0A 1A 0A).' };
  }

  // Must have IHDR chunk right after magic bytes
  const chunkType = buffer.subarray(12, 16).toString('ascii');
  if (chunkType !== 'IHDR') {
    return { valid: false, error: 'Corrupt PNG: First chunk is not IHDR.' };
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  // Must contain IEND chunk near end of file
  const tail = buffer.subarray(Math.max(0, buffer.length - 64));
  let hasIend = false;
  for (let i = 0; i <= tail.length - 4; i++) {
    if (tail.subarray(i, i + 4).equals(PNG_IEND)) {
      hasIend = true;
      break;
    }
  }

  if (!hasIend) {
    return { valid: false, error: 'PNG is truncated or missing IEND terminator chunk.' };
  }

  return { valid: true, width, height };
}

/**
 * Validates a single image buffer for WebP structure and dimensions.
 */
function validateWebP(buffer) {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    buffer.subarray(8, 12).toString('ascii') !== 'WEBP'
  ) {
    return { valid: false, error: 'File declared as WebP does not match RIFF/WEBP signature.' };
  }

  const chunkType = buffer.subarray(12, 16).toString('ascii');
  let width = 0;
  let height = 0;

  if (chunkType === 'VP8 ') {
    if (buffer.length < 30 || buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) {
      return { valid: false, error: 'Corrupt WebP VP8 bitstream.' };
    }
    width = buffer.readUInt16LE(26) & 0x3fff;
    height = buffer.readUInt16LE(28) & 0x3fff;
  } else if (chunkType === 'VP8L') {
    if (buffer.length < 25 || buffer[20] !== 0x2f) {
      return { valid: false, error: 'Corrupt WebP VP8L lossless bitstream.' };
    }
    const b1 = buffer[21];
    const b2 = buffer[22];
    const b3 = buffer[23];
    const b4 = buffer[24];
    width = 1 + (((b2 & 0x3f) << 8) | b1);
    height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
  } else if (chunkType === 'VP8X') {
    if (buffer.length < 30) {
      return { valid: false, error: 'Corrupt WebP VP8X extended bitstream.' };
    }
    width = 1 + buffer.readUIntLE(24, 3);
    height = 1 + buffer.readUIntLE(27, 3);
  } else {
    return { valid: false, error: `Unsupported WebP chunk type: ${chunkType}` };
  }

  return { valid: true, width, height };
}

/**
 * Validates an array of imageUrls against all security and structural limits.
 * Validates ALL pages upfront before returning.
 */
export function validateOcrRequestPayload(body, limits) {
  const { imageUrls, worksheetContext, scopePrompt, studentId } = body || {};

  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return {
      isValid: false,
      status: 400,
      code: 'INVALID_PAYLOAD',
      error: 'Invalid request: "imageUrls" array is required and must contain at least 1 image.',
    };
  }

  // Page limit enforcement
  const maxPages = limits.maxPagesPerRequest || 1;
  if (imageUrls.length > maxPages) {
    return {
      isValid: false,
      status: 400,
      code: 'PAGE_LIMIT_EXCEEDED',
      error: `Page count (${imageUrls.length}) exceeds maximum allowed pages per request (${maxPages}). Initial live test is constrained to ${maxPages} page.`,
    };
  }

  const maxImageBytes = (limits.maxImageSizeMb || 8) * 1024 * 1024;
  const maxTotalBytes = (limits.maxTotalRequestSizeMb || 15) * 1024 * 1024;
  let totalDecodedBytes = 0;
  const validatedPages = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const rawUrl = imageUrls[i];
    const pageIndex = i + 1;

    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
      return {
        isValid: false,
        status: 400,
        code: 'INVALID_IMAGE_URL',
        error: `Page ${pageIndex}: Invalid or empty image data URL.`,
      };
    }

    // Explicitly reject HTTP/HTTPS, local paths, or non-data URIs
    if (/^https?:\/\//i.test(rawUrl)) {
      return {
        isValid: false,
        status: 400,
        code: 'UNSUPPORTED_URL',
        error: `Page ${pageIndex}: Remote HTTP/HTTPS URLs are rejected. Images must be transmitted as verified local data URIs.`,
      };
    }

    if (/^[a-zA-Z]:\\|^\/|^file:\/\//i.test(rawUrl)) {
      return {
        isValid: false,
        status: 400,
        code: 'UNSUPPORTED_FILE_PATH',
        error: `Page ${pageIndex}: Local filesystem paths are rejected.`,
      };
    }

    const dataUriMatch = rawUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!dataUriMatch) {
      return {
        isValid: false,
        status: 400,
        code: 'MALFORMED_DATA_URI',
        error: `Page ${pageIndex}: Payload is not a valid base64 data URI (expected format data:image/<format>;base64,...).`,
      };
    }

    const declaredMime = dataUriMatch[1].toLowerCase();
    const base64Data = dataUriMatch[2].trim();

    if (!SUPPORTED_MIMES.has(declaredMime)) {
      return {
        isValid: false,
        status: 400,
        code: 'UNSUPPORTED_MIME_TYPE',
        error: `Page ${pageIndex}: Declared MIME type "${declaredMime}" is unsupported. Supported types: image/jpeg, image/png, image/webp. PDFs or other file types must be converted to images before submission.`,
      };
    }

    let buffer;
    try {
      buffer = Buffer.from(base64Data, 'base64');
    } catch {
      return {
        isValid: false,
        status: 400,
        code: 'INVALID_BASE64',
        error: `Page ${pageIndex}: Base64 decoding failed.`,
      };
    }

    if (buffer.length < 100) {
      return {
        isValid: false,
        status: 400,
        code: 'IMAGE_TOO_SMALL',
        error: `Page ${pageIndex}: Decoded image payload is too small (${buffer.length} bytes) to be a valid scan.`,
      };
    }

    if (buffer.length > maxImageBytes) {
      return {
        isValid: false,
        status: 400,
        code: 'IMAGE_OVERSIZED',
        error: `Page ${pageIndex}: Decoded image size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds per-image limit of ${limits.maxImageSizeMb} MB.`,
      };
    }

    totalDecodedBytes += buffer.length;
    if (totalDecodedBytes > maxTotalBytes) {
      return {
        isValid: false,
        status: 400,
        code: 'TOTAL_SIZE_EXCEEDED',
        error: `Total request payload size (${(totalDecodedBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum total limit of ${limits.maxTotalRequestSizeMb} MB.`,
      };
    }

    // Inspect format & structure
    let structResult;
    if (declaredMime === 'image/jpeg') {
      structResult = validateJpeg(buffer);
    } else if (declaredMime === 'image/png') {
      structResult = validatePng(buffer);
    } else if (declaredMime === 'image/webp') {
      structResult = validateWebP(buffer);
    }

    if (!structResult.valid) {
      return {
        isValid: false,
        status: 400,
        code: 'IMAGE_INTEGRITY_FAILED',
        error: `Page ${pageIndex}: ${structResult.error}`,
      };
    }

    const { width, height } = structResult;

    // Enforce reasonable dimension limits
    const minDim = limits.minDimension || 50;
    const maxDim = limits.maxDimension || 8192;
    const maxPixels = limits.maxPixels || 32000000; // 32 MP

    if (width < minDim || height < minDim) {
      return {
        isValid: false,
        status: 400,
        code: 'DIMENSION_TOO_SMALL',
        error: `Page ${pageIndex}: Image dimensions (${width}x${height}) are below minimum required resolution (${minDim}x${minDim}).`,
      };
    }

    if (width > maxDim || height > maxDim) {
      return {
        isValid: false,
        status: 400,
        code: 'DIMENSION_TOO_LARGE',
        error: `Page ${pageIndex}: Image dimensions (${width}x${height}) exceed maximum allowed dimension of ${maxDim}px.`,
      };
    }

    if (width * height > maxPixels) {
      return {
        isValid: false,
        status: 400,
        code: 'PIXEL_COUNT_EXCEEDED',
        error: `Page ${pageIndex}: Image pixel count (${width * height} pixels) exceeds maximum limit of ${maxPixels} pixels.`,
      };
    }

    validatedPages.push({
      pageIndex,
      mime: declaredMime,
      byteLength: buffer.length,
      width,
      height,
      dataUri: rawUrl,
    });
  }

  return {
    isValid: true,
    totalDecodedBytes,
    pageCount: validatedPages.length,
    pages: validatedPages,
  };
}
