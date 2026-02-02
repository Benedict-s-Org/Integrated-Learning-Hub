import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface MemoryPoint {
  id: string;
  targetType: 'furniture' | 'wall' | 'floor' | 'tile';
  targetId: string;
  title: string;
  content: string;
  position?: { x: number; y: number };
  createdAt: string;
  updatedAt: string;
}

interface MemoryRow {
  id: string;
  user_id: string;
  room_id: string | null;
  item_instance_id: string | null;
  title: string | null;
  content: string | null;
  target_type: string | null;
  position: { x: number; y: number } | null;
  created_at: string | null;
  updated_at: string | null;
}

const MIGRATION_KEY = 'mp_memory_points_migrated';
const LOCAL_STORAGE_KEY = 'mp_memory_points';

export function useMemoryPoints() {
  const { user } = useAuth();
  const [memoryPoints, setMemoryPoints] = useState<MemoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Transform database row to MemoryPoint
  const transformRow = useCallback((row: MemoryRow): MemoryPoint => ({
    id: row.id,
    targetType: (row.target_type as MemoryPoint['targetType']) || 'furniture',
    targetId: row.item_instance_id || '',
    title: row.title || '',
    content: row.content || '',
    position: row.position || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  }), []);

  // Migrate localStorage data to Supabase
  const migrateLocalStorage = useCallback(async (userId: string) => {
    const alreadyMigrated = localStorage.getItem(MIGRATION_KEY);
    if (alreadyMigrated) return;

    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!localData) {
      localStorage.setItem(MIGRATION_KEY, 'true');
      return;
    }

    try {
      const points: MemoryPoint[] = JSON.parse(localData);
      if (points.length === 0) {
        localStorage.setItem(MIGRATION_KEY, 'true');
        return;
      }

      // Insert all local points to Supabase
      const { error } = await supabase.from('memories').insert(
        points.map((p) => ({
          user_id: userId,
          target_type: p.targetType,
          item_instance_id: p.targetId,
          title: p.title,
          content: p.content,
          position: p.position || null,
          created_at: p.createdAt,
          updated_at: p.updatedAt,
        }))
      );

      if (!error) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.setItem(MIGRATION_KEY, 'true');
        console.log(`Migrated ${points.length} memory points to Supabase`);
      } else {
        console.error('Failed to migrate memory points:', error);
      }
    } catch (err) {
      console.error('Error parsing localStorage data:', err);
    }
  }, []);

  // Fetch memory points from Supabase
  const fetchMemoryPoints = useCallback(async () => {
    if (!user) {
      setMemoryPoints([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // First migrate any existing localStorage data
    await migrateLocalStorage(user.id);

    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching memory points:', error);
      setMemoryPoints([]);
    } else {
      setMemoryPoints((data || []).map(transformRow));
    }

    setIsLoading(false);
  }, [user, migrateLocalStorage, transformRow]);

  // Load memory points when user changes
  useEffect(() => {
    fetchMemoryPoints();
  }, [fetchMemoryPoints]);

  const addMemoryPoint = useCallback(async (
    targetType: MemoryPoint['targetType'],
    targetId: string,
    title: string,
    content: string,
    position?: { x: number; y: number }
  ): Promise<MemoryPoint | null> => {
    if (!user) return null;

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('memories')
      .insert({
        user_id: user.id,
        target_type: targetType,
        item_instance_id: targetId,
        title,
        content,
        position: position || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding memory point:', error);
      return null;
    }

    const newPoint = transformRow(data);
    setMemoryPoints((prev) => [newPoint, ...prev]);
    return newPoint;
  }, [user, transformRow]);

  const updateMemoryPoint = useCallback(async (
    id: string,
    updates: Partial<Pick<MemoryPoint, 'title' | 'content'>>
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('memories')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating memory point:', error);
      return false;
    }

    setMemoryPoints((prev) =>
      prev.map((point) =>
        point.id === id
          ? { ...point, ...updates, updatedAt: new Date().toISOString() }
          : point
      )
    );
    return true;
  }, []);

  const deleteMemoryPoint = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting memory point:', error);
      return false;
    }

    setMemoryPoints((prev) => prev.filter((point) => point.id !== id));
    return true;
  }, []);

  const getMemoryPointsForTarget = useCallback(
    (targetType: string, targetId: string) => {
      return memoryPoints.filter(
        (point) => point.targetType === targetType && point.targetId === targetId
      );
    },
    [memoryPoints]
  );

  const getMemoryPointForTile = useCallback(
    (x: number, y: number) => {
      return memoryPoints.find(
        (point) =>
          point.targetType === 'tile' &&
          point.position?.x === x &&
          point.position?.y === y
      );
    },
    [memoryPoints]
  );

  const hasMemoryPoint = useCallback(
    (targetType: string, targetId: string) => {
      return memoryPoints.some(
        (point) => point.targetType === targetType && point.targetId === targetId
      );
    },
    [memoryPoints]
  );

  const hasTileMemoryPoint = useCallback(
    (x: number, y: number) => {
      return memoryPoints.some(
        (point) =>
          point.targetType === 'tile' &&
          point.position?.x === x &&
          point.position?.y === y
      );
    },
    [memoryPoints]
  );

  return {
    memoryPoints,
    isLoading,
    addMemoryPoint,
    updateMemoryPoint,
    deleteMemoryPoint,
    getMemoryPointsForTarget,
    getMemoryPointForTile,
    hasMemoryPoint,
    hasTileMemoryPoint,
    refetch: fetchMemoryPoints,
  };
}
