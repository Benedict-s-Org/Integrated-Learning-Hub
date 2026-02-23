import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Building, CityDecoration } from "@/types/city";
import { INITIAL_CITY_LAYOUT } from "@/constants/cityLevels";

// Helper for deep comparison to prevent unnecessary re-renders/loops
const isDifferent = (a: any, b: any) => JSON.stringify(a) !== JSON.stringify(b);

export interface UseCityLayoutReturn {
  buildings: Building[];
  decorations: CityDecoration[];
  cityLevel: number;
  cameraSettings: { zoom: number; offset: { x: number; y: number } };
  isLoading: boolean;
  error: string | null;
  addBuilding: (building: Omit<Building, "id">) => void;
  updateBuilding: (id: string, updates: Partial<Building>) => void;
  removeBuilding: (id: string) => void;
  addDecoration: (decoration: Omit<CityDecoration, "id">) => void;
  removeDecoration: (id: string) => void;
  setCityLevel: (level: number) => void;
  setCameraSettings: (settings: { zoom: number; offset: { x: number; y: number } }) => void;
  saveLayout: () => Promise<void>;
  refreshMetadata: () => Promise<void>;
}

export function useCityLayout(): UseCityLayoutReturn {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>(INITIAL_CITY_LAYOUT.buildings);
  const [decorations, setDecorations] = useState<CityDecoration[]>(INITIAL_CITY_LAYOUT.decorations);
  const [cityLevel, setCityLevel] = useState(0);
  const [cameraSettings, setCameraSettings] = useState(INITIAL_CITY_LAYOUT.cameraSettings || { zoom: 1, offset: { x: 0, y: 0 } });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load city layout from database
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadLayout = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // For now, we'll use user_room_data to store city layout
        // In production, this should be a dedicated city_layouts table
        const { data, error: fetchError } = await supabase
          .from("user_room_data")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") {
          throw fetchError;
        }

        if (data) {
          // Check if custom_catalog has city layout data
          const customData = data.custom_catalog as any;
          if (customData?.cityLayout) {
            setBuildings(customData.cityLayout.buildings || INITIAL_CITY_LAYOUT.buildings);
            setDecorations(customData.cityLayout.decorations || INITIAL_CITY_LAYOUT.decorations);
            setCityLevel(customData.cityLayout.cityLevel || 0);
            setCameraSettings(customData.cityLayout.cameraSettings || INITIAL_CITY_LAYOUT.cameraSettings || { zoom: 1, offset: { x: 0, y: 0 } });
          }
        }
      } catch (err) {
        console.error("Error loading city layout:", err);
        setError("Failed to load city layout");
      } finally {
        setIsLoading(false);
      }
    };

    loadLayout();

    // Subscribe to Realtime updates
    const channel = supabase
      .channel(`room-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_room_data',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          const newLayout = newData?.custom_catalog?.cityLayout;

          if (newLayout) {
            // Only update state if data is strictly different to prevent infinite autosave loops
            setBuildings((prev) => {
              const next = newLayout.buildings || INITIAL_CITY_LAYOUT.buildings;
              return isDifferent(prev, next) ? next : prev;
            });

            setDecorations((prev) => {
              const next = newLayout.decorations || INITIAL_CITY_LAYOUT.decorations;
              return isDifferent(prev, next) ? next : prev;
            });

            setCityLevel((prev) => {
              const next = newLayout.cityLevel ?? 0;
              return prev !== next ? next : prev;
            });

            setCameraSettings((prev) => {
              const next = newLayout.cameraSettings || INITIAL_CITY_LAYOUT.cameraSettings || { zoom: 1, offset: { x: 0, y: 0 } };
              return isDifferent(prev, next) ? next : prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Fetch memory metadata (review counts, total points) for buildings
  const fetchMetadata = useCallback(async () => {
    if (!user || buildings.length === 0) return;

    try {
      // Fetch all cards for the user from the 'cards' table
      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select('id, palace_id, due')
        .eq('user_id', user.id);

      if (cardsError) throw cardsError;

      const now = new Date().toISOString();
      const counts: Record<string, { due: number; total: number }> = {};

      (cardsData || []).forEach((card: any) => {
        const palaceId = card.palace_id;
        if (!palaceId) return;

        if (!counts[palaceId]) {
          counts[palaceId] = { due: 0, total: 0 };
        }

        counts[palaceId].total += 1;
        if (card.due && card.due <= now) {
          counts[palaceId].due += 1;
        }
      });

      // Update buildings with metadata
      setBuildings((prev) =>
        prev.map((b) => ({
          ...b,
          reviewCount: counts[b.id]?.due || 0,
          totalMemoryPoints: counts[b.id]?.total || 0,
        }))
      );
    } catch (err) {
      console.error("Error fetching memory metadata:", err);
    }
  }, [user, buildings.length]);

  // Refresh metadata when buildings or user changes
  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

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

  // Remove a decoration
  const removeDecoration = useCallback((id: string) => {
    setDecorations((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // Save layout to database
  const saveLayout = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);

      // Get current user_room_data
      const { data: existingData } = await supabase
        .from("user_room_data")
        .select("id, custom_catalog")
        .eq("user_id", user.id)
        .single();

      const existingCityLayout = (existingData?.custom_catalog as any)?.cityLayout;

      // Merge buildings: preserve customImageUrl/customAssetId from DB if local doesn't have them
      const mergedBuildings = buildings.map(building => {
        const existingBuilding = existingCityLayout?.buildings?.find(
          (b: any) => b.id === building.id
        );

        // If local state doesn't have customImageUrl but DB does, preserve DB version
        if (existingBuilding?.customImageUrl && !building.customImageUrl) {
          return {
            ...building,
            customImageUrl: existingBuilding.customImageUrl,
            customAssetId: existingBuilding.customAssetId,
          };
        }
        return building;
      });

      // Merge decorations: same logic
      const mergedDecorations = decorations.map(decoration => {
        const existingDecoration = existingCityLayout?.decorations?.find(
          (d: any) => d.id === decoration.id
        );

        if (existingDecoration?.customImageUrl && !decoration.customImageUrl) {
          return {
            ...decoration,
            customImageUrl: existingDecoration.customImageUrl,
            customAssetId: existingDecoration.customAssetId,
          };
        }
        return decoration;
      });

      const cityLayoutData = {
        buildings: mergedBuildings,
        decorations: mergedDecorations,
        cityLevel,
        cameraSettings,
        updatedAt: new Date().toISOString(),
      };

      const updatedCatalog = {
        ...(existingData?.custom_catalog as object || {}),
        cityLayout: cityLayoutData,
      };

      if (existingData) {
        await supabase
          .from("user_room_data")
          .update({ custom_catalog: updatedCatalog as any })
          .eq("id", existingData.id);
      } else {
        await supabase
          .from("user_room_data")
          .insert({
            user_id: user.id,
            custom_catalog: updatedCatalog as any,
          });
      }
    } catch (err) {
      console.error("Error saving city layout:", err);
      setError("Failed to save city layout");
    }
  }, [user, buildings, decorations, cityLevel]);

  return {
    buildings,
    decorations,
    cityLevel,
    cameraSettings,
    isLoading,
    error,
    addBuilding,
    updateBuilding,
    removeBuilding,
    addDecoration,
    removeDecoration,
    setCityLevel,
    setCameraSettings,
    saveLayout,
    refreshMetadata: fetchMetadata,
  };
}
