import { useState, useMemo, useCallback } from 'react';
import {
  Chunk,
  WallSegment,
  chunksToTiles,
  getExpandableChunks,
  calculateWallSegments,
  getChunksBounds,
  isPlacementValid,
  wouldCreateHole
} from '@/utils/roomGeometry';

export interface RoomLayoutState {
  roomChunks: Chunk[];
  activeTiles: Set<string>;
  wallSegments: WallSegment[];
  expandableChunks: Chunk[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface HistoryEntry {
  id: number;
  name: string;
  timestamp: string;
  chunks: Chunk[];
}

export function useRoomLayout(storageKey: string = 'mp_room_chunks') {
  // Initialize with a single 2x2 chunk at origin
  const [roomChunks, setRoomChunks] = useState<Chunk[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [{ cx: 0, cy: 0 }];
        }
      }
    }
    return [{ cx: 0, cy: 0 }];
  });

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Derived state
  const activeTiles = useMemo(() => chunksToTiles(roomChunks), [roomChunks]);
  const wallSegments = useMemo(() => calculateWallSegments(activeTiles), [activeTiles]);
  const expandableChunks = useMemo(() => getExpandableChunks(roomChunks), [roomChunks]);
  const bounds = useMemo(() => getChunksBounds(roomChunks), [roomChunks]);

  // Persist to localStorage
  const saveChunks = useCallback((chunks: Chunk[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(chunks));
    }
  }, [storageKey]);

  // Record history entry
  const recordHistory = useCallback((name: string, chunks: Chunk[]) => {
    const entry: HistoryEntry = {
      id: Date.now(),
      name,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      chunks: [...chunks]
    };
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, entry].slice(-30);
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // Add a chunk
  const addChunk = useCallback((chunk: Chunk) => {
    // Validate no hole creation
    if (roomChunks.length > 0 && wouldCreateHole(roomChunks, chunk)) {
      console.warn('Cannot add chunk - would create disconnected region');
      return false;
    }

    // Check if already exists
    const exists = roomChunks.some(c => c.cx === chunk.cx && c.cy === chunk.cy);
    if (exists) return false;

    const newChunks = [...roomChunks, chunk];
    setRoomChunks(newChunks);
    saveChunks(newChunks);
    recordHistory('新增區塊', newChunks);
    return true;
  }, [roomChunks, saveChunks, recordHistory]);

  // Remove a chunk
  const removeChunk = useCallback((chunk: Chunk) => {
    const newChunks = roomChunks.filter(c => c.cx !== chunk.cx || c.cy !== chunk.cy);
    if (newChunks.length === 0) {
      console.warn('Cannot remove last chunk');
      return false;
    }
    setRoomChunks(newChunks);
    saveChunks(newChunks);
    recordHistory('移除區塊', newChunks);
    return true;
  }, [roomChunks, saveChunks, recordHistory]);

  // Reset to single chunk
  const resetLayout = useCallback(() => {
    const defaultChunks = [{ cx: 0, cy: 0 }];
    setRoomChunks(defaultChunks);
    saveChunks(defaultChunks);
    recordHistory('重置空間', defaultChunks);
  }, [saveChunks, recordHistory]);

  // Set entire chunk layout (for loading blueprints)
  const setLayout = useCallback((chunks: Chunk[]) => {
    setRoomChunks(chunks);
    saveChunks(chunks);
    recordHistory('載入藍圖', chunks);
  }, [saveChunks, recordHistory]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevEntry = history[historyIndex - 1];
      setRoomChunks(prevEntry.chunks);
      saveChunks(prevEntry.chunks);
      setHistoryIndex(prev => prev - 1);
    }
  }, [history, historyIndex, saveChunks]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextEntry = history[historyIndex + 1];
      setRoomChunks(nextEntry.chunks);
      saveChunks(nextEntry.chunks);
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex, saveChunks]);

  // Check if furniture fits at position
  const canPlaceFurniture = useCallback((x: number, y: number, width: number, depth: number) => {
    return isPlacementValid(activeTiles, x, y, width, depth);
  }, [activeTiles]);

  return {
    roomChunks,
    activeTiles,
    wallSegments,
    expandableChunks,
    bounds,
    addChunk,
    removeChunk,
    resetLayout,
    setLayout,
    canPlaceFurniture,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    history
  };
}
