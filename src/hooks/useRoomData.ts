import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Placement, WallPlacement, CustomFurniture } from "@/types/furniture";
import { CustomWall, CustomFloor } from "@/types/room";

export interface RoomData {
  placements: Placement[];
  wallPlacements: WallPlacement[];
  inventory: string[];
  customCatalog: CustomFurniture[];
  customModels: Record<string, any>;
  customWalls: CustomWall[];
  customFloors: CustomFloor[];
  activeWallId: string | null;
  activeFloorId: string | null;
  houseLevel: number;
  coins: number;
  history: any[];
}

const DEFAULT_ROOM_DATA: RoomData = {
  placements: [],
  wallPlacements: [],
  inventory: ["hk_stool", "hk_table", "hk_bed", "basement_stairs"],
  customCatalog: [],
  customModels: {},
  customWalls: [],
  customFloors: [],
  activeWallId: null,
  activeFloorId: null,
  houseLevel: 0,
  coins: 0,
  history: [],
};

const ADMIN_FUNDS = 9999999999;
const DEBOUNCE_MS = 1000;



// Helper to ensure we always have an array
const safeArray = <T>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];
  return [];
};

export const useRoomData = () => {
  console.log("useRoomData: Hook called");
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  console.log("useRoomData: Auth state", { hasUser: !!user, authLoading });
  const [data, setData] = useState<RoomData>(DEFAULT_ROOM_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [roomError, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);
  const dataIdRef = useRef<string | null>(null);

  // Load data from Supabase
  const loadData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: roomData, error: fetchError } = await supabase
        .from("user_room_data")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle() as any;

      if (fetchError) throw fetchError;

      if (roomData) {
        dataIdRef.current = roomData.id;
        // Handle custom_catalog - it could be an array or an object with cityLayout
        const rawCatalog = roomData.custom_catalog;
        let parsedCatalog: CustomFurniture[] = [];
        if (Array.isArray(rawCatalog)) {
          parsedCatalog = rawCatalog;
        } else if (rawCatalog && typeof rawCatalog === 'object' && !Array.isArray(rawCatalog)) {
          // If it's an object (like {cityLayout: ...}), keep it empty for customCatalog
          // The cityLayout data is handled by useCityLayout hook
          parsedCatalog = [];
        }

        setData({
          placements: safeArray<Placement>(roomData.placements),
          wallPlacements: safeArray<WallPlacement>(roomData.wall_placements),
          inventory: safeArray<string>(roomData.inventory) || DEFAULT_ROOM_DATA.inventory,
          customCatalog: parsedCatalog,
          customModels: (roomData.custom_models as Record<string, unknown>) || {},
          customWalls: safeArray<CustomWall>(roomData.custom_walls),
          customFloors: safeArray<CustomFloor>(roomData.custom_floors),
          activeWallId: roomData.active_wall_id,
          activeFloorId: roomData.active_floor_id,
          houseLevel: roomData.house_level || 0,
          coins: isAdmin ? ADMIN_FUNDS : (roomData.coins || 0),
          history: [],
        });
      } else {
        // Create new record for user
        const { data: newRecord, error: insertError } = await supabase
          .from("user_room_data")
          .insert({
            user_id: user.id,
            placements: DEFAULT_ROOM_DATA.placements as any,
            wall_placements: DEFAULT_ROOM_DATA.wallPlacements as any,
            inventory: DEFAULT_ROOM_DATA.inventory as any,
            custom_catalog: DEFAULT_ROOM_DATA.customCatalog as any,
            custom_models: DEFAULT_ROOM_DATA.customModels as any,
            custom_walls: DEFAULT_ROOM_DATA.customWalls as any,
            custom_floors: DEFAULT_ROOM_DATA.customFloors as any,
            active_wall_id: null,
            active_floor_id: null,
            house_level: 0,
            coins: 0,
          } as any)
          .select()
          .single() as any;

        if (insertError) {
          // Foreign key error - user might not exist in auth.users or session is stale
          if (insertError.code === '23503') {
            console.error("Foreign key violation - refreshing session");
            await supabase.auth.refreshSession();
            setError("用戶驗證失敗，請重新登入");
            return;
          }
          throw insertError;
        }
        dataIdRef.current = newRecord.id;
        setData({ ...DEFAULT_ROOM_DATA, coins: isAdmin ? ADMIN_FUNDS : 0 });
      }

      hasInitializedRef.current = true;
    } catch (err) {
      console.error("Failed to load room data:", err);
      setError("無法載入數據，請重新整理頁面");
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin]);

  // Save data to Supabase with debounce
  const saveData = useCallback(async (newData: RoomData) => {
    if (!user || !hasInitializedRef.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce the save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        const { error: updateError } = await supabase
          .from("user_room_data")
          .update({
            placements: newData.placements,
            wall_placements: newData.wallPlacements,
            inventory: newData.inventory,
            custom_catalog: newData.customCatalog,
            custom_models: newData.customModels,
            custom_walls: newData.customWalls,
            custom_floors: newData.customFloors,
            active_wall_id: newData.activeWallId,
            active_floor_id: newData.activeFloorId,
            house_level: newData.houseLevel,
            coins: isAdmin ? 0 : newData.coins, // Don't save admin funds
          } as any)
          .eq("user_id", user.id);

        if (updateError) throw updateError;
      } catch (err) {
        console.error("Failed to save room data:", err);
        setError("儲存失敗，請檢查網絡連接");
      } finally {
        setIsSaving(false);
      }
    }, DEBOUNCE_MS);
  }, [user, isAdmin]);

  // Load on mount and when user changes
  useEffect(() => {
    if (!authLoading && user) {
      loadData();
    } else if (!authLoading && !user) {
      setData(DEFAULT_ROOM_DATA);
      setIsLoading(false);
      hasInitializedRef.current = false;
    }
  }, [user, authLoading, loadData]);

  // Save when data changes
  useEffect(() => {
    if (hasInitializedRef.current) {
      saveData(data);
    }
  }, [data, saveData]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-room-data-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_room_data",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as {
            placements: Placement[];
            wall_placements: WallPlacement[];
            inventory: string[];
            custom_catalog: unknown;
            custom_models: Record<string, unknown>;
            custom_walls: unknown;
            custom_floors: unknown;
            active_wall_id: string | null;
            active_floor_id: string | null;
            house_level: number;
            coins: number;
          };

          // Handle custom_catalog - it could be an array or an object
          let parsedCatalog: CustomFurniture[] = [];
          if (Array.isArray(newData.custom_catalog)) {
            parsedCatalog = newData.custom_catalog;
          }

          // Only update if change came from elsewhere (e.g., another tab)
          setData({
            placements: newData.placements || [],
            wallPlacements: newData.wall_placements || [],
            inventory: newData.inventory || DEFAULT_ROOM_DATA.inventory,
            customCatalog: parsedCatalog,
            customModels: newData.custom_models || {},
            customWalls: Array.isArray(newData.custom_walls) ? (newData.custom_walls as CustomWall[]) : [],
            customFloors: Array.isArray(newData.custom_floors) ? (newData.custom_floors as CustomFloor[]) : [],
            activeWallId: newData.active_wall_id,
            activeFloorId: newData.active_floor_id,
            houseLevel: newData.house_level || 0,
            coins: isAdmin ? ADMIN_FUNDS : (newData.coins || 0),
            history: [],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Update functions
  const updateData = useCallback((updates: Partial<RoomData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const setCoins = useCallback((value: number | ((prev: number) => number)) => {
    if (isAdmin) return; // Admin has unlimited funds
    setData((prev) => ({
      ...prev,
      coins: typeof value === "function" ? value(prev.coins) : value,
    }));
  }, [isAdmin]);

  const setHouseLevel = useCallback((value: number | ((prev: number) => number)) => {
    setData((prev) => ({
      ...prev,
      houseLevel: typeof value === "function" ? value(prev.houseLevel) : value,
    }));
  }, []);

  const setInventory = useCallback((value: string[] | ((prev: string[]) => string[])) => {
    setData((prev) => ({
      ...prev,
      inventory: typeof value === "function" ? value(prev.inventory) : value,
    }));
  }, []);

  const setPlacements = useCallback((value: Placement[] | ((prev: Placement[]) => Placement[])) => {
    setData((prev) => ({
      ...prev,
      placements: typeof value === "function" ? value(prev.placements) : value,
    }));
  }, []);

  const setWallPlacements = useCallback((value: WallPlacement[] | ((prev: WallPlacement[]) => WallPlacement[])) => {
    setData((prev) => ({
      ...prev,
      wallPlacements: typeof value === "function" ? value(prev.wallPlacements) : value,
    }));
  }, []);

  const setCustomCatalog = useCallback((value: CustomFurniture[] | ((prev: CustomFurniture[]) => CustomFurniture[])) => {
    setData((prev) => ({
      ...prev,
      customCatalog: typeof value === "function" ? value(prev.customCatalog) : value,
    }));
  }, []);

  const setCustomModels = useCallback((value: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => {
    setData((prev) => ({
      ...prev,
      customModels: typeof value === "function" ? value(prev.customModels) : value,
    }));
  }, []);

  const setCustomWalls = useCallback((value: CustomWall[] | ((prev: CustomWall[]) => CustomWall[])) => {
    setData((prev) => ({
      ...prev,
      customWalls: typeof value === "function" ? value(prev.customWalls) : value,
    }));
  }, []);

  const setCustomFloors = useCallback((value: CustomFloor[] | ((prev: CustomFloor[]) => CustomFloor[])) => {
    setData((prev) => ({
      ...prev,
      customFloors: typeof value === "function" ? value(prev.customFloors) : value,
    }));
  }, []);

  const setActiveWallId = useCallback((value: string | null) => {
    setData((prev) => ({ ...prev, activeWallId: value }));
  }, []);

  const setActiveFloorId = useCallback((value: string | null) => {
    setData((prev) => ({ ...prev, activeFloorId: value }));
  }, []);

  const historyAction = useCallback(() => { }, []);
  const restoreHistory = useCallback(() => { }, []);

  return {
    ...data,
    isLoading: isLoading || authLoading,
    roomError,
    isSaving,
    isAdmin,
    setCoins,
    setHouseLevel,
    setInventory,
    setPlacements,
    setWallPlacements,
    setCustomCatalog,
    setCustomModels,
    setCustomWalls,
    setCustomFloors,
    setActiveWallId,
    setActiveFloorId,
    historyAction,
    restoreHistory,
    updateData,
    reload: loadData,
  };
};
