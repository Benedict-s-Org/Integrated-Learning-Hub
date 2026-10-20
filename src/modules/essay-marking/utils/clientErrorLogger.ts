/**
 * Client Error Logging for Essay Marking Module.
 *
 * Requirements:
 * - Captures uncaught errors and unhandled promise rejections.
 * - Dispatches them to Bridge endpoint POST /api/client-errors.
 * - Stores latest errors in memory so the debug panel can show them with a "Copy" button.
 * - Local only, fail-silent if bridge is offline.
 */

export interface ClientErrorRecord {
  id: string;
  timestamp: string;
  message: string;
  stack: string;
  currentStep: string | null;
  pageUrl: string;
}

const MAX_STORED_ERRORS = 50;
let inMemoryErrors: ClientErrorRecord[] = [];
const errorListeners = new Set<() => void>();

export function getLatestClientErrors(): ClientErrorRecord[] {
  return [...inMemoryErrors];
}

export function subscribeToClientErrors(listener: () => void): () => void {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

export async function reportClientError(
  error: unknown,
  currentStep: string | null = null
): Promise<void> {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : JSON.stringify(error);

  const stack = error instanceof Error && error.stack ? error.stack : '';
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

  const record: ClientErrorRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    message,
    stack,
    currentStep,
    pageUrl,
  };

  // Add to in-memory list
  inMemoryErrors = [record, ...inMemoryErrors].slice(0, MAX_STORED_ERRORS);
  errorListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore listener error
    }
  });

  // Send to local bridge endpoint
  try {
    const bridgeUrl = 'http://127.0.0.1:18089/api/client-errors';
    await fetch(bridgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(record),
    });
  } catch {
    // Local bridge might be offline; fail silently
  }
}

export function setupGlobalErrorCatchers(getCurrentStep: () => string | null): () => void {
  if (typeof window === 'undefined') return () => {};

  const errorHandler = (event: ErrorEvent) => {
    reportClientError(event.error || event.message, getCurrentStep());
  };

  const rejectionHandler = (event: PromiseRejectionEvent) => {
    reportClientError(event.reason || 'Unhandled Promise Rejection', getCurrentStep());
  };

  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', rejectionHandler);

  return () => {
    window.removeEventListener('error', errorHandler);
    window.removeEventListener('unhandledrejection', rejectionHandler);
  };
}
