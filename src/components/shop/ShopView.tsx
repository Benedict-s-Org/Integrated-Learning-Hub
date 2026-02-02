import React, { useState } from "react";
import { Package, Square, Grid, Layout, Check } from "lucide-react";
import { HOUSE_LEVELS } from "@/constants/houseLevels";
import { FurnitureItem } from "@/types/furniture";
import { CustomWall, CustomFloor } from "@/types/room";

interface Blueprint {
  id: string;
  name: string;
  description?: string;
  price: number;
  preview?: string;
  placements?: any[];
}

interface ShopViewProps {
  coins: number;
  inventory: string[];
  houseLevel: number;
  onBuy: (item: FurnitureItem) => void;
  onUpgrade: () => void;
  onClose: () => void;
  isAdmin: boolean;
  customWalls: CustomWall[];
  customFloors: CustomFloor[];
  activeWallId: string | null;
  activeFloorId: string | null;
  onSelectWall: (id: string) => void;
  onSelectFloor: (id: string) => void;
  fullCatalog: FurnitureItem[];
  publishedBlueprints: Blueprint[];
  ownedBlueprints: string[];
  onBuyBlueprint: (blueprint: Blueprint) => void;
  onApplyBlueprint: (blueprint: Blueprint) => void;
}

export const ShopView: React.FC<ShopViewProps> = ({
  coins,
  inventory,
  houseLevel,
  onBuy,
  onUpgrade,
  onClose,
  isAdmin,
  customWalls,
  customFloors,
  activeWallId,
  activeFloorId,
  onSelectWall,
  onSelectFloor,
  fullCatalog,
  publishedBlueprints,
  ownedBlueprints,
  onBuyBlueprint,
  onApplyBlueprint,
}) => {
  const currentHouse = HOUSE_LEVELS[houseLevel];
  const nextHouse = HOUSE_LEVELS[houseLevel + 1];
  const [shopTab, setShopTab] = useState<"furniture" | "wall" | "floor" | "blueprint">("furniture");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Sidebar - Category Selection */}
        <div className="w-48 bg-slate-900 border-r border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-sm font-bold text-slate-400 uppercase">商品類別</h3>
          </div>
          <div className="flex-1 p-2 space-y-1">
            <button
              onClick={() => setShopTab("furniture")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                shopTab === "furniture"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Package size={20} />
              <span className="font-medium">購買家具</span>
            </button>
            <button
              onClick={() => setShopTab("wall")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                shopTab === "wall" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Square size={20} />
              <span className="font-medium">購買牆壁</span>
            </button>
            <button
              onClick={() => setShopTab("floor")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                shopTab === "floor" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Grid size={20} />
              <span className="font-medium">購買地板</span>
            </button>
            <button
              onClick={() => setShopTab("blueprint")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                shopTab === "blueprint"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Layout size={20} />
              <span className="font-medium">房間藍圖</span>
              {publishedBlueprints.length > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {publishedBlueprints.length}
                </span>
              )}
            </button>
          </div>
          <div className="p-4 border-t border-slate-700">
            <div className="text-xs text-slate-500">
              已上傳: {fullCatalog.length} 家具 / {customWalls.length} 牆壁 / {customFloors.length} 地板
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              🏪{" "}
              {shopTab === "furniture"
                ? "家具商店"
                : shopTab === "wall"
                  ? "牆壁商店"
                  : shopTab === "floor"
                    ? "地板商店"
                    : "房間藍圖"}
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-yellow-400 font-bold text-lg">💰 {isAdmin ? "♾️" : coins}</span>
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-2xl">
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {shopTab === "furniture" && (
              <>
                {/* House Upgrade Section */}
                {nextHouse && (
                  <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-xl p-5 border border-indigo-500/30">
                    <h3 className="text-lg font-semibold text-indigo-300 mb-3">🏠 升級房屋</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">
                          {currentHouse.name} → {nextHouse.name}
                        </p>
                        <p className="text-slate-400 text-sm">
                          容量: {currentHouse.capacity} → {nextHouse.capacity} 個位置
                        </p>
                      </div>
                      <button
                        onClick={onUpgrade}
                        disabled={!isAdmin && coins < nextHouse.cost}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                      >
                        升級 💰{nextHouse.cost}
                      </button>
                    </div>
                  </div>
                )}

                {/* Furniture Grid */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-300 mb-4">🪑 家具</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {fullCatalog.map((item) => {
                      const owned = inventory.includes(item.id);
                      const canAfford = isAdmin || coins >= item.cost;
                      const IconComponent = item.icon;

                      return (
                        <div
                          key={item.id}
                          className={`bg-slate-700/50 rounded-xl p-4 border transition-all ${
                            owned
                              ? "border-green-500/50 bg-green-900/20"
                              : canAfford
                                ? "border-slate-600 hover:border-indigo-500/50 hover:bg-slate-700"
                                : "border-slate-600 opacity-60"
                          }`}
                        >
                          <div className="mb-2">
                            {IconComponent && typeof IconComponent === "function" ? (
                              <IconComponent className="w-10 h-10 text-indigo-400" />
                            ) : item.spriteImages?.[0] ? (
                              <img src={item.spriteImages[0]} alt={item.name} className="w-10 h-10 object-contain" />
                            ) : (
                              <Package className="w-10 h-10 text-indigo-400" />
                            )}
                          </div>
                          <h4 className="text-white font-medium text-sm">{item.name}</h4>
                          <p className="text-slate-400 text-xs mt-1 line-clamp-2">{item.desc}</p>
                          <div className="mt-3">
                            {owned ? (
                              <span className="text-green-400 text-sm font-medium">✓ 已擁有</span>
                            ) : (
                              <button
                                onClick={() => onBuy(item)}
                                disabled={!canAfford}
                                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                💰 {item.cost}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {shopTab === "wall" && (
              <div>
                <h3 className="text-lg font-semibold text-slate-300 mb-4">🧱 牆壁樣式</h3>
                {customWalls.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Square size={48} className="mx-auto mb-4 opacity-50" />
                    <p>尚無上傳的牆壁樣式</p>
                    <p className="text-sm mt-2">請前往管理員頁面上傳牆壁</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {customWalls.map((wall) => {
                      const isActive = activeWallId === wall.id;
                      return (
                        <div
                          key={wall.id}
                          className={`bg-slate-700/50 rounded-xl p-4 border transition-all ${
                            isActive
                              ? "border-green-500 bg-green-900/20"
                              : "border-slate-600 hover:border-indigo-500/50 hover:bg-slate-700"
                          }`}
                        >
                          <div className="mb-3 flex gap-2">
                            <div className="flex-1 aspect-square rounded-lg overflow-hidden bg-slate-600">
                              <img src={wall.lightImage} alt="亮面" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 aspect-square rounded-lg overflow-hidden bg-slate-600">
                              <img src={wall.darkImage} alt="暗面" className="w-full h-full object-cover" />
                            </div>
                          </div>
                          <h4 className="text-white font-medium text-sm">{wall.name}</h4>
                          <p className="text-slate-400 text-xs mt-1">💰 {wall.price}</p>
                          <div className="mt-3">
                            {isActive ? (
                              <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                                <Check size={14} /> 使用中
                              </span>
                            ) : (
                              <button
                                onClick={() => onSelectWall(wall.id)}
                                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                選用
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {shopTab === "floor" && (
              <div>
                <h3 className="text-lg font-semibold text-slate-300 mb-4">🪵 地板樣式</h3>
                {customFloors.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Grid size={48} className="mx-auto mb-4 opacity-50" />
                    <p>尚無上傳的地板樣式</p>
                    <p className="text-sm mt-2">請前往管理員頁面上傳地板</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {customFloors.map((floor) => {
                      const isActive = activeFloorId === floor.id;
                      return (
                        <div
                          key={floor.id}
                          className={`bg-slate-700/50 rounded-xl p-4 border transition-all ${
                            isActive
                              ? "border-green-500 bg-green-900/20"
                              : "border-slate-600 hover:border-indigo-500/50 hover:bg-slate-700"
                          }`}
                        >
                          <div className="mb-3 aspect-square rounded-lg overflow-hidden bg-slate-600">
                            <img src={floor.image} alt={floor.name} className="w-full h-full object-cover" />
                          </div>
                          <h4 className="text-white font-medium text-sm">{floor.name}</h4>
                          <p className="text-slate-400 text-xs mt-1">💰 {floor.price}</p>
                          <div className="mt-3">
                            {isActive ? (
                              <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                                <Check size={14} /> 使用中
                              </span>
                            ) : (
                              <button
                                onClick={() => onSelectFloor(floor.id)}
                                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                選用
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {shopTab === "blueprint" && (
              <div>
                <h3 className="text-lg font-semibold text-slate-300 mb-4">🏠 房間藍圖</h3>
                {publishedBlueprints.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Layout size={48} className="mx-auto mb-4 opacity-50" />
                    <p>尚無可用的房間藍圖</p>
                    <p className="text-sm mt-2">管理員可在空間設計中心發布藍圖</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {publishedBlueprints.map((blueprint) => {
                      const owned = ownedBlueprints.includes(blueprint.id);
                      const canAfford = isAdmin || coins >= blueprint.price;

                      return (
                        <div
                          key={blueprint.id}
                          className={`bg-slate-700/50 rounded-xl p-4 border transition-all ${
                            owned
                              ? "border-green-500/50 bg-green-900/20"
                              : canAfford
                                ? "border-slate-600 hover:border-indigo-500/50 hover:bg-slate-700"
                                : "border-slate-600 opacity-60"
                          }`}
                        >
                          <div className="mb-3 aspect-video rounded-lg overflow-hidden bg-slate-600">
                            {blueprint.preview ? (
                              <img src={blueprint.preview} alt={blueprint.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Layout size={32} className="text-slate-500" />
                              </div>
                            )}
                          </div>
                          <h4 className="text-white font-medium text-sm">{blueprint.name}</h4>
                          <p className="text-slate-400 text-xs mt-1 line-clamp-2">
                            {blueprint.description || `包含 ${blueprint.placements?.length || 0} 個家具`}
                          </p>
                          <div className="mt-3">
                            {owned ? (
                              <button
                                onClick={() => onApplyBlueprint(blueprint)}
                                className="w-full py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                套用藍圖
                              </button>
                            ) : (
                              <button
                                onClick={() => onBuyBlueprint(blueprint)}
                                disabled={!canAfford}
                                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                💰 {blueprint.price}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
