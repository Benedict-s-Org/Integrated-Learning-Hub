import React, { useState } from "react";
import { Package, Square, Grid, Layout, Check, Filter } from "lucide-react";
import { HOUSE_LEVELS } from "@/constants/houseLevels";
import { FurnitureItem } from "@/types/furniture";
import { CustomWall, CustomFloor } from "@/types/room";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

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
  onApplySystemStyle?: (style: any) => void;
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
  onApplySystemStyle,
}) => {
  const currentHouse = HOUSE_LEVELS[houseLevel];
  const nextHouse = HOUSE_LEVELS[houseLevel + 1];
  const [shopTab, setShopTab] = useState<"furniture" | "wall" | "floor" | "blueprint">("furniture");
  const [systemStyles, setSystemStyles] = useState<any[]>([]);
  const [colorFilter, setColorFilter] = useState("all");

  useEffect(() => {
    const fetchSystemStyles = async () => {
      const { data, error } = await (supabase.from('shop_system_styles' as any) as any).select('*');
      if (!error && data) {
        setSystemStyles(data);
      }
    };
    fetchSystemStyles();
  }, []);

  const systemWalls = systemStyles.filter(s => s.type === 'wall');
  const systemFloors = systemStyles.filter(s => s.type === 'floor');
  const colorCategories = Array.from(new Set(systemStyles.map(s => s.category))).sort();

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-background rounded-[2rem] shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex border-4 border-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Sidebar - Category Selection */}
        <div className="w-56 bg-secondary/50 border-r border-primary/10 flex flex-col">
          <div className="p-6 border-b border-primary/10">
            <h3 className="text-xs font-bold text-primary/60 uppercase tracking-widest text-center">商品類別</h3>
          </div>
          <div className="flex-1 p-3 space-y-2">
            <button
              onClick={() => setShopTab("furniture")}
              className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl text-left transition-all ${shopTab === "furniture"
                ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
                : "text-primary/70 hover:bg-white hover:text-primary"
                }`}
            >
              <Package size={20} />
              <span className="font-bold">購買家具</span>
            </button>
            <button
              onClick={() => setShopTab("wall")}
              className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl text-left transition-all ${shopTab === "wall"
                ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
                : "text-primary/70 hover:bg-white hover:text-primary"
                }`}
            >
              <Square size={20} />
              <span className="font-bold">購買牆壁</span>
            </button>
            <button
              onClick={() => setShopTab("floor")}
              className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl text-left transition-all ${shopTab === "floor"
                ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
                : "text-primary/70 hover:bg-white hover:text-primary"
                }`}
            >
              <Grid size={20} />
              <span className="font-bold">購買地板</span>
            </button>
            <button
              onClick={() => setShopTab("blueprint")}
              className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl text-left transition-all ${shopTab === "blueprint"
                ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
                : "text-primary/70 hover:bg-white hover:text-primary"
                }`}
            >
              <Layout size={20} />
              <span className="font-bold">房間藍圖</span>
              {publishedBlueprints.length > 0 && (
                <span className="ml-auto bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {publishedBlueprints.length}
                </span>
              )}
            </button>
          </div>
          <div className="p-6 border-t border-primary/10 bg-white/30 text-center">
            <div className="text-[10px] text-primary/50 font-medium">
              庫存: {fullCatalog.length} 家具 / {customWalls.length} 牆 / {customFloors.length} 地
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-white/40">
          {/* Header */}
          <div className="flex items-center justify-between p-8 border-b border-primary/10">
            <h2 className="text-3xl font-extrabold text-primary flex items-center gap-3">
              {shopTab === "furniture"
                ? "🪑 家具商店"
                : shopTab === "wall"
                  ? "🧱 牆壁樣式"
                  : shopTab === "floor"
                    ? "🪵 地板樣式"
                    : "🏠 房間藍圖"}
            </h2>
            <div className="flex items-center gap-6">
              <div className="bg-amber-100 px-4 py-2 rounded-full border border-amber-200">
                <span className="text-amber-600 font-black text-xl flex items-center gap-2">
                  <span className="text-lg">💰</span>
                  {isAdmin ? "♾️" : coins.toLocaleString()}
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all transform hover:rotate-90"
              >
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
                  <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-[1.5rem] p-6 border-2 border-primary/20 shadow-inner">
                    <h3 className="text-xl font-black text-primary mb-4 flex items-center gap-2">🏠 升級房屋</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-primary/80 font-bold">
                          {currentHouse.name} → {nextHouse.name}
                        </p>
                        <p className="text-primary/50 text-xs font-medium">
                          容量: {currentHouse.maxItems} → {nextHouse.maxItems} 個位置
                        </p>
                      </div>
                      <button
                        onClick={onUpgrade}
                        disabled={!isAdmin && coins < nextHouse.cost}
                        className="px-8 py-3 bg-primary hover:opacity-90 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-2xl transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
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
                      const cost = item.cost ?? item.price ?? 0;
                      const canAfford = isAdmin || coins >= cost;
                      const IconComponent = item.icon;
                      const customItem = item as any;

                      return (
                        <div
                          key={item.id}
                          className={`bg-slate-700/50 rounded-xl p-4 border transition-all ${owned
                            ? "border-green-500/50 bg-green-900/20"
                            : canAfford
                              ? "border-slate-600 hover:border-indigo-500/50 hover:bg-slate-700"
                              : "border-slate-600 opacity-60"
                            }`}
                        >
                          <div className="mb-2">
                            {IconComponent && typeof IconComponent === "function" ? (
                              <IconComponent className="w-10 h-10 text-primary" />
                            ) : customItem.spriteImages?.[0] ? (
                              <img src={customItem.spriteImages[0]} alt={item.name} className="w-10 h-10 object-contain" />
                            ) : (
                              <Package className="w-10 h-10 text-primary" />
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
                                className="w-full py-2 bg-primary hover:opacity-90 disabled:bg-primary/20 disabled:text-primary/40 disabled:cursor-not-allowed text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-primary/20 hover:scale-[1.05] active:scale-[0.95]"
                              >
                                💰 {cost}
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
              <div className="space-y-8">
                {/* System Wall Colors */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-primary flex items-center gap-2">🎨 牆面顏色</h3>
                    <div className="flex items-center gap-2">
                      <Filter size={16} className="text-primary/40" />
                      <select
                        value={colorFilter}
                        onChange={(e) => setColorFilter(e.target.value)}
                        className="bg-white/50 border border-primary/10 rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="all">所有顏色</option>
                        {colorCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {systemWalls
                      .filter(s => colorFilter === 'all' || s.category === colorFilter)
                      .map(style => {
                        const owned = inventory.includes(style.id);
                        const isActive = activeWallId === style.id;
                        const canAfford = isAdmin || coins >= style.price;

                        return (
                          <div
                            key={style.id}
                            className={`group bg-white/60 p-3 rounded-2xl border-2 transition-all hover:shadow-xl ${isActive ? "border-primary bg-primary/5" : "border-transparent"
                              }`}
                          >
                            <div
                              className="aspect-square rounded-xl shadow-inner border border-primary/10 mb-3"
                              style={{ backgroundColor: style.color_hex }}
                            />
                            <div className="font-bold text-sm text-primary mb-1">{style.name}</div>
                            <div className="text-[10px] text-primary/40 mb-3">{style.category}</div>

                            {isActive ? (
                              <div className="w-full py-2 bg-primary/10 text-primary text-xs font-bold rounded-xl flex items-center justify-center gap-1">
                                <Check size={14} /> 使用中
                              </div>
                            ) : owned ? (
                              <button
                                onClick={() => onApplySystemStyle?.(style)}
                                className="w-full py-2 bg-secondary hover:bg-white text-primary text-xs font-bold rounded-xl transition-all border border-transparent hover:border-primary/10"
                              >
                                套用
                              </button>
                            ) : (
                              <button
                                onClick={() => onBuy({ id: style.id, name: style.name, cost: style.price } as any)}
                                disabled={!canAfford}
                                className="w-full py-2 bg-primary hover:opacity-90 disabled:bg-primary/20 text-white text-xs font-bold rounded-xl transition-all"
                              >
                                💰 {style.price}
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="h-px bg-primary/10" />

                {/* Custom Wall Textures */}
                <div>
                  <h3 className="text-lg font-bold text-primary mb-4">🧱 牆面材質</h3>
                  {customWalls.length === 0 ? (
                    <div className="bg-white/30 rounded-2xl p-8 text-center border-2 border-dashed border-primary/10">
                      <p className="text-primary/40 font-medium italic">尚未上傳任何材質</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {customWalls.map((wall) => {
                        const isActive = activeWallId === wall.id;
                        return (
                          <div
                            key={wall.id}
                            className={`bg-white/60 p-3 rounded-2xl border-2 transition-all ${isActive ? "border-primary bg-primary/5" : "border-transparent"
                              }`}
                          >
                            <div className="flex gap-1 mb-3">
                              <div className="flex-1 aspect-square rounded-lg overflow-hidden border border-primary/5">
                                <img src={wall.lightImage} alt="亮面" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 aspect-square rounded-lg overflow-hidden border border-primary/5">
                                <img src={wall.darkImage} alt="暗面" className="w-full h-full object-cover" />
                              </div>
                            </div>
                            <div className="font-bold text-sm text-primary">{wall.name}</div>
                            <div className="mt-3">
                              {isActive ? (
                                <div className="w-full py-2 bg-primary/10 text-primary text-xs font-bold rounded-xl flex items-center justify-center gap-1">
                                  <Check size={14} /> 使用中
                                </div>
                              ) : (
                                <button
                                  onClick={() => onSelectWall(wall.id)}
                                  className="w-full py-2 bg-secondary hover:bg-white text-primary text-xs font-bold rounded-xl transition-all"
                                >
                                  套用
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {shopTab === "floor" && (
              <div className="space-y-8">
                {/* System Floor Colors */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-primary flex items-center gap-2">🎨 地面顏色</h3>
                    <div className="flex items-center gap-2">
                      <Filter size={16} className="text-primary/40" />
                      <select
                        value={colorFilter}
                        onChange={(e) => setColorFilter(e.target.value)}
                        className="bg-white/50 border border-primary/10 rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="all">所有顏色</option>
                        {colorCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {systemFloors
                      .filter(s => colorFilter === 'all' || s.category === colorFilter)
                      .map(style => {
                        const owned = inventory.includes(style.id);
                        const isActive = activeFloorId === style.id;
                        const canAfford = isAdmin || coins >= style.price;

                        return (
                          <div
                            key={style.id}
                            className={`group bg-white/60 p-3 rounded-2xl border-2 transition-all hover:shadow-xl ${isActive ? "border-primary bg-primary/5" : "border-transparent"
                              }`}
                          >
                            <div
                              className="aspect-square rounded-xl shadow-inner border border-primary/10 mb-3"
                              style={{ backgroundColor: style.color_hex }}
                            />
                            <div className="font-bold text-sm text-primary mb-1">{style.name}</div>
                            <div className="text-[10px] text-primary/40 mb-3">{style.category}</div>

                            {isActive ? (
                              <div className="w-full py-2 bg-primary/10 text-primary text-xs font-bold rounded-xl flex items-center justify-center gap-1">
                                <Check size={14} /> 使用中
                              </div>
                            ) : owned ? (
                              <button
                                onClick={() => onApplySystemStyle?.(style)}
                                className="w-full py-2 bg-secondary hover:bg-white text-primary text-xs font-bold rounded-xl transition-all border border-transparent hover:border-primary/10"
                              >
                                套用
                              </button>
                            ) : (
                              <button
                                onClick={() => onBuy({ id: style.id, name: style.name, cost: style.price } as any)}
                                disabled={!canAfford}
                                className="w-full py-2 bg-primary hover:opacity-90 disabled:bg-primary/20 text-white text-xs font-bold rounded-xl transition-all"
                              >
                                💰 {style.price}
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="h-px bg-primary/10" />

                {/* Custom Floor Textures */}
                <div>
                  <h3 className="text-lg font-bold text-primary mb-4">🪵 地面材質</h3>
                  {customFloors.length === 0 ? (
                    <div className="bg-white/30 rounded-2xl p-8 text-center border-2 border-dashed border-primary/10">
                      <p className="text-primary/40 font-medium italic">尚未上傳任何材質</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {customFloors.map((floor) => {
                        const isActive = activeFloorId === floor.id;
                        return (
                          <div
                            key={floor.id}
                            className={`bg-white/60 p-3 rounded-2xl border-2 transition-all ${isActive ? "border-primary bg-primary/5" : "border-transparent"
                              }`}
                          >
                            <div className="aspect-square rounded-lg overflow-hidden border border-primary/5 mb-3">
                              <img src={floor.image} alt={floor.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="font-bold text-sm text-primary">{floor.name}</div>
                            <div className="mt-3">
                              {isActive ? (
                                <div className="w-full py-2 bg-primary/10 text-primary text-xs font-bold rounded-xl flex items-center justify-center gap-1">
                                  <Check size={14} /> 使用中
                                </div>
                              ) : (
                                <button
                                  onClick={() => onSelectFloor(floor.id)}
                                  className="w-full py-2 bg-secondary hover:bg-white text-primary text-xs font-bold rounded-xl transition-all"
                                >
                                  套用
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                          className={`bg-slate-700/50 rounded-xl p-4 border transition-all ${owned
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
