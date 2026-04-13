import { postRunToGoogleSheet } from './googleSheetsLogger';
import { postRun, RunPayload } from './notionLogger';

export interface SyncPayload {
  id: string;
  sheetsData: Record<string, any>;
  notionData: RunPayload;
  status: 'pending' | 'failed';
  timestamp: number;
}

const QUEUE_KEY = 'anagram_sync_queue';

export function getQueue(): SyncPayload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveQueue(queue: SyncPayload[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("Local storage quota exceeded or unavailable");
  }
}

export function enqueueRun(sheetsData: Record<string, any>, notionData: RunPayload) {
  const queue = getQueue();
  const id = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  queue.push({
    id,
    sheetsData,
    notionData,
    status: 'pending',
    timestamp: Date.now()
  });
  saveQueue(queue);
  return id;
}

export function removeRun(id: string) {
  const queue = getQueue();
  saveQueue(queue.filter(q => q.id !== id));
}

export async function processQueue() {
  const queue = getQueue();
  if (queue.length === 0) return;

  console.log(`[SyncQueue] Processing ${queue.length} items...`);
  
  for (const item of queue) {
    try {
      // Execute both simultaneous, don't throw if one fails
      const sheetPromise = postRunToGoogleSheet(item.sheetsData).catch(e => {
        console.error(`[SyncQueue] Google Sheets failed for ${item.id}`, e);
        return null;
      });
      
      const notionPromise = postRun(item.notionData).catch(e => {
         console.error(`[SyncQueue] Notion failed for ${item.id}`, e);
         return null;
      });
      
      await Promise.all([sheetPromise, notionPromise]);
      
      // Even if one failed, we remove it from the queue to prevent infinite failing loops
      // The user still gets at least partial data (most likely Notion)
      console.log(`[SyncQueue] Removing ${item.id} from queue.`);
      removeRun(item.id);
    } catch (err) {
      console.error(`[SyncQueue] Fatal error processing ${item.id}`, err);
    }
  }
}
