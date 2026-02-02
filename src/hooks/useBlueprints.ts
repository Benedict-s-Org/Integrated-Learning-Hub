import { useState, useCallback } from 'react';
import { Chunk } from '@/utils/roomGeometry';

export interface Blueprint {
  id: string;
  name: string;
  description: string;
  price: number;
  tags: string[];
  previewImage?: string;
  roomChunks: Chunk[];
  floorStyle?: {
    activeFloorId: string | null;
    overrides?: Record<string, string>;
  };
  wallStyle?: {
    activeWallId: string | null;
    overrides?: Record<string, string>;
  };
  placements: Array<{
    furnitureId: string;
    x: number;
    y: number;
    rotation: number;
  }>;
  wallPlacements: Array<{
    furnitureId: string;
    segmentId: string;
    gridPos: number;
    z: number;
  }>;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'mp_blueprints';

export function useBlueprints() {
  const [blueprints, setBlueprints] = useState<Blueprint[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const saveToStorage = useCallback((bps: Blueprint[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bps));
    }
  }, []);

  const createBlueprint = useCallback((data: Omit<Blueprint, 'id' | 'createdAt' | 'updatedAt' | 'isPublished'>) => {
    const newBlueprint: Blueprint = {
      ...data,
      id: crypto.randomUUID(),
      isPublished: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const updated = [...blueprints, newBlueprint];
    setBlueprints(updated);
    saveToStorage(updated);
    return newBlueprint;
  }, [blueprints, saveToStorage]);

  const updateBlueprint = useCallback((id: string, data: Partial<Blueprint>) => {
    const updated = blueprints.map(bp => 
      bp.id === id 
        ? { ...bp, ...data, updatedAt: new Date().toISOString() }
        : bp
    );
    setBlueprints(updated);
    saveToStorage(updated);
  }, [blueprints, saveToStorage]);

  const deleteBlueprint = useCallback((id: string) => {
    const updated = blueprints.filter(bp => bp.id !== id);
    setBlueprints(updated);
    saveToStorage(updated);
  }, [blueprints, saveToStorage]);

  const getBlueprint = useCallback((id: string) => {
    return blueprints.find(bp => bp.id === id);
  }, [blueprints]);

  const duplicateBlueprint = useCallback((id: string) => {
    const original = blueprints.find(bp => bp.id === id);
    if (!original) return null;

    const copy: Blueprint = {
      ...original,
      id: crypto.randomUUID(),
      name: `${original.name} (副本)`,
      isPublished: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [...blueprints, copy];
    setBlueprints(updated);
    saveToStorage(updated);
    return copy;
  }, [blueprints, saveToStorage]);

  const publishBlueprint = useCallback((id: string) => {
    const updated = blueprints.map(bp => 
      bp.id === id 
        ? { ...bp, isPublished: true, updatedAt: new Date().toISOString() }
        : bp
    );
    setBlueprints(updated);
    saveToStorage(updated);
  }, [blueprints, saveToStorage]);

  const unpublishBlueprint = useCallback((id: string) => {
    const updated = blueprints.map(bp => 
      bp.id === id 
        ? { ...bp, isPublished: false, updatedAt: new Date().toISOString() }
        : bp
    );
    setBlueprints(updated);
    saveToStorage(updated);
  }, [blueprints, saveToStorage]);

  const getPublishedBlueprints = useCallback(() => {
    return blueprints.filter(bp => bp.isPublished);
  }, [blueprints]);

  return {
    blueprints,
    createBlueprint,
    updateBlueprint,
    deleteBlueprint,
    getBlueprint,
    duplicateBlueprint,
    publishBlueprint,
    unpublishBlueprint,
    getPublishedBlueprints
  };
}
