/**
 * IndexedDB persistence layer for Essay Marking Workbench.
 *
 * Requirements:
 * - Persists current step, assignment settings, scans, student matching, transcripts, findings, review status.
 * - Restores state after page reload (preventing state loss on Vite reload).
 * - NEVER uses localStorage for image or document storage.
 * - Provides clearWorkbenchSession action to wipe saved state.
 */

const DB_NAME = 'EssayMarkingWorkbenchDB';
const DB_VERSION = 1;
const STORE_NAME = 'workbench_session';
const SESSION_KEY = 'active_session';

import {
  WorkflowStep,
  AssignmentConfig,
  ScanFileRecord,
  ScanPage,
  AppliedMatching,
  StudentTranscriptState,
  StudentMarkingState,
  PageIdentityRecognition,
  MatchingMode,
} from '../types';

export interface PersistedSessionData {
  timestamp: number;
  currentStep: WorkflowStep;
  assignment: AssignmentConfig;
  files: ScanFileRecord[];
  pages: ScanPage[];
  selectedClassId: string;
  studentPageCounts: number[];
  selectedStudentIndices: number[];
  appliedMatching: AppliedMatching | null;
  activeStudentIndex: number;
  transcripts: Record<string, StudentTranscriptState>;
  markings: Record<string, StudentMarkingState>;
  recognitionResults?: Record<string, PageIdentityRecognition>;
  matchingMode?: MatchingMode;
  stagedCandidatesByStudent?: Record<string, any>;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available in this environment.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveWorkbenchSession(data: Omit<PersistedSessionData, 'timestamp'>): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: PersistedSessionData = {
        ...data,
        timestamp: Date.now(),
      };
      const putReq = store.put(record, SESSION_KEY);

      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('[EssayMarkingStorage] Failed to save session to IndexedDB:', err);
  }
}

export async function loadWorkbenchSession(): Promise<PersistedSessionData | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(SESSION_KEY);

      getReq.onsuccess = () => {
        const data = (getReq.result as PersistedSessionData) || null;
        if (!data) {
          resolve(null);
          return;
        }

        // Recreate live object URLs from persisted page image blobs
        if (Array.isArray(data.pages)) {
          data.pages = data.pages.map((p) => {
            if (p.imageBlob && (p.imageBlob instanceof Blob || (typeof p.imageBlob === 'object' && 'size' in (p.imageBlob as any)))) {
              try {
                const blob = p.imageBlob instanceof Blob ? p.imageBlob : new Blob([(p.imageBlob as any)], { type: (p.imageBlob as any).type || 'image/jpeg' });
                const freshUrl = URL.createObjectURL(blob);
                return {
                  ...p,
                  previewUrl: freshUrl,
                  imageBlob: blob,
                };
              } catch (e) {
                console.warn('[EssayMarkingStorage] Failed to create object URL from restored blob:', e);
              }
            }
            return p;
          });
        }

        resolve(data);
      };
      getReq.onerror = () => reject(getReq.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('[EssayMarkingStorage] Failed to load session from IndexedDB:', err);
    return null;
  }
}

export async function clearWorkbenchSession(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const delReq = store.delete(SESSION_KEY);

      delReq.onsuccess = () => resolve();
      delReq.onerror = () => reject(delReq.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('[EssayMarkingStorage] Failed to clear session from IndexedDB:', err);
  }
}
