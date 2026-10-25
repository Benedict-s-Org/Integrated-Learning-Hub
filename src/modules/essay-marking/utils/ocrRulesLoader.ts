import {
  OcrRulesConfig,
  parseAndValidateOcrRules,
} from './ocrRulesSchema';

export interface OcrRulesSnapshot {
  config: OcrRulesConfig;
  hash: string;
  loadedAt: number;
  rawMarkdown: string;
}

let cachedSnapshot: OcrRulesSnapshot | null = null;

/**
 * Gets the static asset URL for the OCR cleanup rules markdown file,
 * respecting the Vite base URL and appending a timestamp to prevent stale HTTP caching.
 */
export function getOcrRulesAssetUrl(): string {
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${cleanBase}essay-marking/ocr-cleanup-rules.md?t=${Date.now()}`;
}

/**
 * Reset or invalidate the cached rules snapshot (useful when user triggers a fresh batch or re-read).
 */
export function resetOcrRulesCache(): void {
  cachedSnapshot = null;
}

/**
 * Set an explicit rules snapshot in memory (e.g. for testing or mocking without filesystem/network).
 */
export function setOcrRulesSnapshotForTesting(snapshot: OcrRulesSnapshot | null): void {
  cachedSnapshot = snapshot;
}

/**
 * Loads and validates the OCR cleanup rules markdown file.
 * Returns an immutable snapshot with config and hash.
 * If validation fails, returns an actionable error string and does not cache the failure.
 */
export async function loadOcrRulesSnapshot(
  forceFresh = false
): Promise<{ ok: true; snapshot: OcrRulesSnapshot } | { ok: false; error: string }> {
  if (!forceFresh && cachedSnapshot) {
    return { ok: true, snapshot: cachedSnapshot };
  }

  let markdownContent = '';

  // 1. Try browser fetch if fetch is available
  if (typeof fetch === 'function') {
    const url = getOcrRulesAssetUrl();
    try {
      const response = await fetch(url, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!response.ok) {
        // If 404 or other HTTP error in browser
        // In local Node / test environment, fetch may fail if static server isn't running
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      markdownContent = await response.text();
    } catch (fetchErr) {
      // In Node.js environment (e.g. Vitest), fall back to fs
      if (typeof process !== 'undefined' && process.versions?.node) {
        try {
          const fs = await import('fs');
          const path = await import('path');
          const filePath = path.resolve(process.cwd(), 'public/essay-marking/ocr-cleanup-rules.md');
          if (fs.existsSync(filePath)) {
            markdownContent = fs.readFileSync(filePath, 'utf-8');
          } else {
            return {
              ok: false,
              error: `OCR rules file not found at ${filePath}. Ensure public/essay-marking/ocr-cleanup-rules.md exists.`,
            };
          }
        } catch (fsErr) {
          return {
            ok: false,
            error: `Failed to load OCR rules from ${url} (Fetch failed: ${fetchErr}; FS fallback failed: ${fsErr})`,
          };
        }
      } else {
        return {
          ok: false,
          error: `Failed to fetch OCR rules file from ${url}: ${
            fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
          }`,
        };
      }
    }
  } else if (typeof process !== 'undefined' && process.versions?.node) {
    // Node environment without fetch
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), 'public/essay-marking/ocr-cleanup-rules.md');
      if (fs.existsSync(filePath)) {
        markdownContent = fs.readFileSync(filePath, 'utf-8');
      } else {
        return {
          ok: false,
          error: `OCR rules file not found at ${filePath}. Ensure public/essay-marking/ocr-cleanup-rules.md exists.`,
        };
      }
    } catch (fsErr) {
      return {
        ok: false,
        error: `Failed to read rules file from disk: ${fsErr instanceof Error ? fsErr.message : String(fsErr)}`,
      };
    }
  } else {
    return {
      ok: false,
      error: 'Neither fetch nor file system access is available to load OCR rules file.',
    };
  }

  const parsed = parseAndValidateOcrRules(markdownContent);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const snapshot: OcrRulesSnapshot = {
    config: parsed.config,
    hash: parsed.hash,
    loadedAt: Date.now(),
    rawMarkdown: markdownContent,
  };

  cachedSnapshot = snapshot;
  return { ok: true, snapshot };
}
