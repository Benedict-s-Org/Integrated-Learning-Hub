import React, { useState } from "react";
import { X, Coins, Lock, Check, Building2, Home, ShoppingBag, GraduationCap, Trees, Landmark, Sparkles } from "lucide-react";
import type { BuildingCatalogItem, BuildingType } from "@/types/city";
import { BUILDING_CATALOG, CITY_LEVELS } from "@/constants/cityLevels";
import { CARTOON_PALETTE } from "@/constants/cityStyleGuide";

interface BuildingShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  coins: number;
  cityLevel: number;
  ownedBuildingIds: string[];
  onPurchase: (item: BuildingCatalogItem) => void;
  onUpgradeCity: () => void;
}

const TYPE_ICONS: Record<BuildingType, React.ElementType> = {
  house: Home,
  shop: ShoppingBag,
  school: GraduationCap,
  park: Trees,
  landmark: Landmark,
};

const TYPE_LABELS: Record<BuildingType, string> = {
  house: "住宅",
  shop: "商店",
  school: "學校",
  park: "公園",
  landmark: "地標",
};

export function BuildingShopModal({
  isOpen,
  onClose,
  coins,
  cityLevel,
  ownedBuildingIds,
  onPurchase,
  onUpgradeCity,
}: BuildingShopModalProps) {
  const [selectedType, setSelectedType] = useState<BuildingType | "all">("all");

  if (!isOpen) return null;

  const currentLevel = CITY_LEVELS[cityLevel] || CITY_LEVELS[0];
  const nextLevel = CITY_LEVELS[cityLevel + 1];
  const canUpgrade = nextLevel && coins >= nextLevel.unlockCost;

  const filteredCatalog = BUILDING_CATALOG.filter(
    (item) => selectedType === "all" || item.type === selectedType
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div 
        className="border-4 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${CARTOON_PALETTE.sky.middle} 0%, white 100%)`,
          borderColor: CARTOON_PALETTE.roofs[3],
        }}
      >
        {/* Header - Cute cartoon style */}
        <div 
          className="p-6 border-b-4 flex items-center justify-between"
          style={{
            background: `linear-gradient(135deg, ${CARTOON_PALETTE.accents[0]}40 0%, ${CARTOON_PALETTE.accents[3]}30 100%)`,
            borderColor: CARTOON_PALETTE.roofs[3],
          }}
        >
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: CARTOON_PALETTE.decorations.trunk }}>
              <Building2 style={{ color: CARTOON_PALETTE.roofs[0] }} /> 
              建築商店
              <Sparkles size={20} style={{ color: CARTOON_PALETTE.accents[0] }} className="animate-sparkle" />
            </h2>
            <p className="text-sm mt-1" style={{ color: CARTOON_PALETTE.decorations.trunk + 'cc' }}>
              購買新建築來擴展你的城市 ✨
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center gap-2 px-4 py-2 rounded-full font-bold shadow-md"
              style={{
                background: `linear-gradient(135deg, ${CARTOON_PALETTE.accents[0]} 0%, ${CARTOON_PALETTE.accents[3]} 100%)`,
                color: 'white',
              }}
            >
              <Coins size={18} />
              <span>{coins}</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full transition-all hover:scale-110"
              style={{ 
                backgroundColor: CARTOON_PALETTE.roofs[1] + '40',
                color: CARTOON_PALETTE.decorations.trunk,
              }}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* City Level Banner - Warm cartoon style */}
        <div 
          className="px-6 py-4 border-b-2"
          style={{
            backgroundColor: CARTOON_PALETTE.ground.pathLight,
            borderColor: CARTOON_PALETTE.ground.path,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm" style={{ color: CARTOON_PALETTE.decorations.trunk + 'aa' }}>目前城市等級</div>
              <div className="text-lg font-bold" style={{ color: CARTOON_PALETTE.decorations.trunk }}>
                ⭐ Lv.{cityLevel} {currentLevel.name}
              </div>
            </div>
            {nextLevel && (
              <button
                onClick={onUpgradeCity}
                disabled={!canUpgrade}
                className="px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all hover:scale-105 shadow-md"
                style={{
                  background: canUpgrade 
                    ? `linear-gradient(135deg, ${CARTOON_PALETTE.roofs[2]} 0%, ${CARTOON_PALETTE.decorations.treeFoliage} 100%)`
                    : CARTOON_PALETTE.ground.path,
                  color: canUpgrade ? 'white' : CARTOON_PALETTE.decorations.trunk + '80',
                  cursor: canUpgrade ? 'pointer' : 'not-allowed',
                }}
              >
                升級至 {nextLevel.name}
                <span className="flex items-center gap-1">
                  <Coins size={14} /> {nextLevel.unlockCost}
                </span>
              </button>
            )}
          </div>
          <div className="flex gap-2 mt-2 text-xs flex-wrap">
            {currentLevel.features.map((feature, i) => (
              <span 
                key={i} 
                className="px-2 py-1 rounded-full"
                style={{
                  backgroundColor: CARTOON_PALETTE.walls[i % CARTOON_PALETTE.walls.length],
                  color: CARTOON_PALETTE.decorations.trunk,
                }}
              >
                {feature}
              </span>
            ))}
          </div>
        </div>

        {/* Type Filter - Cute pill buttons */}
        <div 
          className="px-6 py-3 border-b-2 flex gap-2 overflow-x-auto"
          style={{ 
            backgroundColor: 'white',
            borderColor: CARTOON_PALETTE.ground.pathLight,
          }}
        >
          <button
            onClick={() => setSelectedType("all")}
            className="px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap hover:scale-105"
            style={{
              background: selectedType === "all" 
                ? `linear-gradient(135deg, ${CARTOON_PALETTE.roofs[0]} 0%, ${CARTOON_PALETTE.accents[1]} 100%)`
                : CARTOON_PALETTE.walls[0],
              color: selectedType === "all" ? 'white' : CARTOON_PALETTE.decorations.trunk,
              boxShadow: selectedType === "all" ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            ✨ 全部
          </button>
          {(Object.keys(TYPE_LABELS) as BuildingType[]).map((type, index) => {
            const Icon = TYPE_ICONS[type];
            const isSelected = selectedType === type;
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className="px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap hover:scale-105"
                style={{
                  background: isSelected 
                    ? `linear-gradient(135deg, ${CARTOON_PALETTE.roofs[index % CARTOON_PALETTE.roofs.length]} 0%, ${CARTOON_PALETTE.accents[index % CARTOON_PALETTE.accents.length]} 100%)`
                    : CARTOON_PALETTE.walls[index % CARTOON_PALETTE.walls.length],
                  color: isSelected ? 'white' : CARTOON_PALETTE.decorations.trunk,
                  boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                <Icon size={14} />
                {TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>

        {/* Building Grid - Cute card style */}
        <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: CARTOON_PALETTE.sky.bottom + '30' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map((item, index) => {
              const isOwned = ownedBuildingIds.includes(item.id);
              const isLocked = item.requiredCityLevel > cityLevel;
              const canAfford = coins >= item.cost;
              const Icon = TYPE_ICONS[item.type];

              return (
                <div
                  key={item.id}
                  className="relative rounded-2xl p-4 transition-all hover:scale-[1.02]"
                  style={{
                    backgroundColor: isOwned 
                      ? CARTOON_PALETTE.decorations.treeHighlight + '40'
                      : 'white',
                    border: `3px solid ${isOwned 
                      ? CARTOON_PALETTE.decorations.treeFoliage 
                      : isLocked 
                        ? CARTOON_PALETTE.ground.path
                        : CARTOON_PALETTE.roofs[index % CARTOON_PALETTE.roofs.length] + '80'}`,
                    opacity: isLocked ? 0.7 : 1,
                    boxShadow: '0 4px 12px rgba(139, 115, 145, 0.15)',
                  }}
                >
                  {/* Locked Badge */}
                  {isLocked && (
                    <div 
                      className="absolute top-2 right-2 text-xs px-2 py-1 rounded-full flex items-center gap-1 font-bold"
                      style={{
                        backgroundColor: CARTOON_PALETTE.roofs[1] + '40',
                        color: CARTOON_PALETTE.decorations.trunk,
                      }}
                    >
                      <Lock size={12} />
                      Lv.{item.requiredCityLevel}
                    </div>
                  )}

                  {/* Building Preview - Cute gradient */}
                  <div
                    className="w-full h-24 rounded-xl mb-3 flex items-center justify-center shadow-inner"
                    style={{
                      background: `linear-gradient(135deg, ${item.defaultStyle.wallColor} 0%, ${item.defaultStyle.roofColor} 100%)`,
                    }}
                  >
                    <div 
                      className="p-3 rounded-full"
                      style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
                    >
                      <Icon size={32} style={{ color: item.defaultStyle.roofColor }} />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: CARTOON_PALETTE.walls[index % CARTOON_PALETTE.walls.length],
                          color: CARTOON_PALETTE.decorations.trunk,
                        }}
                      >
                        {TYPE_LABELS[item.type]}
                      </span>
                      <span className="text-xs" style={{ color: CARTOON_PALETTE.decorations.trunk + '99' }}>
                        {item.size.width}x{item.size.depth}
                      </span>
                    </div>
                    <h3 className="font-bold" style={{ color: CARTOON_PALETTE.decorations.trunk }}>{item.name}</h3>
                    <p className="text-xs line-clamp-2" style={{ color: CARTOON_PALETTE.decorations.trunk + 'aa' }}>
                      {item.description}
                    </p>
                  </div>

                  {/* Action */}
                  <div>
                    {isOwned ? (
                      <div 
                        className="text-sm font-bold flex items-center gap-1"
                        style={{ color: CARTOON_PALETTE.decorations.treeFoliage }}
                      >
                        <Check size={16} /> 已擁有 ✓
                      </div>
                    ) : isLocked ? (
                      <div className="text-sm" style={{ color: CARTOON_PALETTE.decorations.trunk + '80' }}>
                        🔒 需要城市等級 {item.requiredCityLevel}
                      </div>
                    ) : (
                      <button
                        onClick={() => onPurchase(item)}
                        disabled={!canAfford}
                        className="w-full py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105"
                        style={{
                          background: canAfford
                            ? `linear-gradient(135deg, ${CARTOON_PALETTE.accents[0]} 0%, ${CARTOON_PALETTE.accents[3]} 100%)`
                            : CARTOON_PALETTE.ground.path,
                          color: canAfford ? 'white' : CARTOON_PALETTE.decorations.trunk + '80',
                          cursor: canAfford ? 'pointer' : 'not-allowed',
                          boxShadow: canAfford ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                        }}
                      >
                        <Coins size={16} />
                        {item.cost}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
