import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Building, CityDecoration } from "@/types/city";
import { INITIAL_CITY_LAYOUT } from "@/constants/cityLevels";
import { SYSTEM_DEFAULT_USER_ID } from "@/constants/adminDefaults";

export interface AdminCityLayoutReturn {
  buildings: Building[];
  decorations: CityDecoration[];
  cityLevel: number;
  cameraSettings: { zoom: number; offset: { x: number; y: number } };
  coins: number;
  isLoading: boolean;
  error: string | null;
  loadUserLayout: (userId: string) => Promise<void>;
  setBuildings: React.Dispatch<React.SetStateAction<Building[]>>;
  setDecorations: React.Dispatch<React.SetStateAction<CityDecoration[]>>;
  setCityLevel: React.Dispatch<React.SetStateAction<number>>;
  setCameraSettings: React.Dispatch<React.SetStateAction<{ zoom: number, offset: { x: number, y: number } }>>;
  setCoins: React.Dispatch<React.SetStateAction<number>>;
  addBuilding: (building: Omit<Building, "id">) => void;
  updateBuilding: (id: string, updates: Partial<Building>) => void;
  removeBuilding: (id: string) => void;
  addDecoration: (decoration: Omit<CityDecoration, "id">) => void;
  updateDecoration: (id: string, updates: Partial<CityDecoration>) => void;
  removeDecoration: (id: string) => void;
  saveLayout: (userId: string) => Promise<boolean>;
  resetToDefault: () => void;
}

export function useAdminCityLayout(): AdminCityLayoutReturn {
  const [buildings, setBuildings] = useState<Building[]>(INITIAL_CITY_LAYOUT.buildings);
  const [decorations, setDecorations] = useState<CityDecoration[]>(INITIAL_CITY_LAYOUT.decorations);
  const [cityLevel, setCityLevel] = useState(0);
  const [cameraSettings, setCameraSettings] = useState(INITIAL_CITY_LAYOUT.cameraSettings || { zoom: 1, offset: { x: 0, y: 0 } });
  const [coins, setCoins] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load city layout for a specific user (admin only)
  const loadUserLayout = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("user_room_data")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError;
      }

      if (data) {
        setCoins(data.coins ?? 0);
        const customData = data.custom_catalog as any;
        if (customData?.cityLayout) {
          setBuildings(customData.cityLayout.buildings || INITIAL_CITY_LAYOUT.buildings);
          setDecorations(customData.cityLayout.decorations || INITIAL_CITY_LAYOUT.decorations);
          setCityLevel(customData.cityLayout.cityLevel || 0);
          setCameraSettings(customData.cityLayout.cameraSettings || INITIAL_CITY_LAYOUT.cameraSettings || { zoom: 1, offset: { x: 0, y: 0 } });
          setIsLoading(false);
          return;
        }
      }

      // If user has no city layout yet (or no room record), and we're not loading the system default itself, try master default
      if (userId !== SYSTEM_DEFAULT_USER_ID) {
        const { data: defaultData } = await supabase
          .from("user_room_data")
          .select("*")
          .eq("user_id", SYSTEM_DEFAULT_USER_ID)
          .single();

        if (defaultData && (defaultData.custom_catalog as any)?.cityLayout) {
          const customData = defaultData.custom_catalog as any;
          setBuildings(customData.cityLayout.buildings || INITIAL_CITY_LAYOUT.buildings);
          setDecorations(customData.cityLayout.decorations || INITIAL_CITY_LAYOUT.decorations);
          setCityLevel(customData.cityLayout.cityLevel || 0);
          setCameraSettings(customData.cityLayout.cameraSettings || INITIAL_CITY_LAYOUT.cameraSettings || { zoom: 1, offset: { x: 0, y: 0 } });
          setCoins(0); // Use 0 for target user rather than master's coins
          setIsLoading(false);
          return;
        }
      }

      // Final fallback to hardcoded defaults
      setBuildings(INITIAL_CITY_LAYOUT.buildings);
      setDecorations(INITIAL_CITY_LAYOUT.decorations);
      setCityLevel(0);
      setCameraSettings(INITIAL_CITY_LAYOUT.cameraSettings || { zoom: 1, offset: { x: 0, y: 0 } });
      setCoins(0);
    } catch (err) {
      console.error("Error loading city layout:", err);
      setError("無法載入城市佈局");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add a new building
  const addBuilding = useCallback((building: Omit<Building, "id">) => {
    const newBuilding: Building = {
      ...building,
      id: `building_${Date.now()}`,
    };
    setBuildings((prev) => [...prev, newBuilding]);
  }, []);

  // Update an existing building
  const updateBuilding = useCallback((id: string, updates: Partial<Building>) => {
    setBuildings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  }, []);

  // Remove a building
  const removeBuilding = useCallback((id: string) => {
    setBuildings((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // Add a decoration
  const addDecoration = useCallback((decoration: Omit<CityDecoration, "id">) => {
    const newDecoration: CityDecoration = {
      ...decoration,
      id: `decoration_${Date.now()}`,
    };
    setDecorations((prev) => [...prev, newDecoration]);
  }, []);

  // Update a decoration
  const updateDecoration = useCallback((id: string, updates: Partial<CityDecoration>) => {
    setDecorations((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  }, []);

  // Remove a decoration
  const removeDecoration = useCallback((id: string) => {
    setDecorations((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // Save layout to database for a specific user (admin only)
  const saveLayout = useCallback(async (userId: string): Promise<boolean> => {
    try {
      setError(null);

      // Get current user_room_data
      const { data: existingData } = await supabase
        .from("user_room_data")
        .select("id, custom_catalog")
        .eq("user_id", userId)
        .single();

      const cityLayoutData = {
        buildings,
        decorations,
        cityLevel,
        cameraSettings,
        updatedAt: new Date().toISOString(),
      };

      const updatedCatalog = {
        ...(existingData?.custom_catalog as object || {}),
        cityLayout: cityLayoutData,
      };

      if (existingData) {
        const { error: updateError } = await supabase
          .from("user_room_data")
          .update({
            custom_catalog: updatedCatalog as any,
            coins: coins,
          })
          .eq("id", existingData.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("user_room_data")
          .insert(({
            user_id: userId,
            custom_catalog: updatedCatalog as any,
            coins: coins,
          } as any));

        if (insertError) throw insertError;
      }

      return true;
    } catch (err) {
      console.error("Error saving city layout:", err);
      setError("無法儲存城市佈局");
      return false;
    }
  }, [buildings, decorations, cityLevel, coins]);

  // Reset to default layout
  const resetToDefault = useCallback(() => {
    setBuildings(INITIAL_CITY_LAYOUT.buildings);
    setDecorations(INITIAL_CITY_LAYOUT.decorations);
    setCityLevel(0);
    setCameraSettings(INITIAL_CITY_LAYOUT.cameraSettings || { zoom: 1, offset: { x: 0, y: 0 } });
  }, []);

  return {
    buildings,
    decorations,
    cityLevel,
    cameraSettings,
    coins,
    isLoading,
    error,
    loadUserLayout,
    setBuildings,
    setDecorations,
    setCityLevel,
    setCameraSettings,
    setCoins,
    addBuilding,
    updateBuilding,
    removeBuilding,
    addDecoration,
    updateDecoration,
    removeDecoration,
    saveLayout,
    resetToDefault,
  };
}
