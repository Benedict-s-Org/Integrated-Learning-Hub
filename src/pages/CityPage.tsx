import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CityMap, BuildingShopModal } from "@/components/city";
import { useCityLayout } from "@/hooks/useCityLayout";
import { useRoomData } from "@/hooks/useRoomData";
import { Loader2, Map } from "lucide-react";
import type { Building, BuildingCatalogItem } from "@/types/city";
import { DEFAULT_BUILDING_STYLES, CITY_LEVELS } from "@/constants/cityLevels";

export function CityPage() {
  const navigate = useNavigate();
  const [showShop, setShowShop] = useState(false);
  
  const {
    buildings,
    decorations,
    cityLevel,
    isLoading,
    error,
    addBuilding,
    setCityLevel,
    saveLayout,
  } = useCityLayout();

  // Get coins from room data
  const { coins, setCoins } = useRoomData();

  // Auto-save on changes
  useEffect(() => {
    const autoSave = setTimeout(() => {
      if (!isLoading) {
        saveLayout();
      }
    }, 2000);
    return () => clearTimeout(autoSave);
  }, [buildings, decorations, cityLevel, isLoading, saveLayout]);

  // Handle building purchase
  const handlePurchaseBuilding = useCallback((item: BuildingCatalogItem) => {
    if (coins < item.cost) {
      alert("金幣不足！");
      return;
    }

    // Deduct coins
    setCoins(coins - item.cost);

    // Find an empty position for the new building
    const gridSize = CITY_LEVELS[cityLevel]?.cityGridSize || 16;
    let newPos = { x: 2, y: 2 };
    
    // Simple placement - find first empty spot
    for (let y = 2; y < gridSize - item.size.depth; y += 4) {
      for (let x = 2; x < gridSize - item.size.width; x += 4) {
        const occupied = buildings.some(
          (b) =>
            x < b.position.x + b.size.width &&
            x + item.size.width > b.position.x &&
            y < b.position.y + b.size.depth &&
            y + item.size.depth > b.position.y
        );
        if (!occupied) {
          newPos = { x, y };
          break;
        }
      }
    }

    // Create new building
    const newBuilding: Omit<Building, "id"> = {
      name: item.name,
      type: item.type,
      position: newPos,
      size: item.size,
      exteriorStyle: item.defaultStyle,
      isUnlocked: true,
    };

    addBuilding(newBuilding);
    setShowShop(false);
  }, [coins, setCoins, buildings, cityLevel, addBuilding]);

  // Handle city upgrade
  const handleUpgradeCity = useCallback(() => {
    const nextLevel = CITY_LEVELS[cityLevel + 1];
    if (!nextLevel) return;
    
    if (coins < nextLevel.unlockCost) {
      alert("金幣不足！");
      return;
    }

    setCoins(coins - nextLevel.unlockCost);
    setCityLevel(cityLevel + 1);
  }, [coins, setCoins, cityLevel, setCityLevel]);

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-b from-sky-300 to-sky-100">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground">載入城市中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-b from-sky-300 to-sky-100">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-destructive font-medium">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            回到房間
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <CityMap
        buildings={buildings}
        decorations={decorations}
        cityLevel={cityLevel}
        coins={coins}
        onOpenShop={() => setShowShop(true)}
      />

      {/* Navigate to Region button */}
      <button
        onClick={() => navigate('/region')}
        className="absolute top-4 right-4 flex items-center gap-2 bg-card/90 backdrop-blur-sm text-foreground rounded-lg px-4 py-2 shadow-lg border hover:bg-accent transition-colors z-10"
      >
        <Map className="w-5 h-5 text-primary" />
        <span className="font-medium">大地區</span>
      </button>

      <BuildingShopModal
        isOpen={showShop}
        onClose={() => setShowShop(false)}
        coins={coins}
        cityLevel={cityLevel}
        ownedBuildingIds={buildings.map((b) => b.id)}
        onPurchase={handlePurchaseBuilding}
        onUpgradeCity={handleUpgradeCity}
      />
    </div>
  );
}
