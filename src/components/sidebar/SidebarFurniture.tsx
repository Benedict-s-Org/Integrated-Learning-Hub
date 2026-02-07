import React from "react";
import {
  Sofa,
  Square,
  Grid,
  Trash2,
  Check,
  X,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CustomWall {
  id: string;
  name: string;
  lightImage: string;
  darkImage: string;
  price?: number;
}

interface CustomFloor {
  id: string;
  name: string;
  image: string;
  price?: number;
}

interface FurnitureItem {
  id: string;
  name: string;
  icon?: any;
  cost?: number;
  desc?: string;
  spriteImages?: (string | null)[];
}

interface SidebarFurnitureProps {
  isOpen: boolean;
  inventory: string[];
  fullCatalog: FurnitureItem[];
  customWalls: CustomWall[];
  customFloors: CustomFloor[];
  activeWallId: string | null;
  activeFloorId: string | null;
  onSelectWall: (id: string) => void;
  onSelectFloor: (id: string) => void;
  onDragStart: (item: FurnitureItem) => void;
  isRemoveMode: boolean;
  toggleRemoveMode: () => void;
  confirmRemove: () => void;
  cancelRemove: () => void;
  hasSelection: boolean;
  currentPhase: string;
}

export const SidebarFurniture: React.FC<SidebarFurnitureProps> = ({
  isOpen,
  inventory,
  fullCatalog,
  customWalls,
  customFloors,
  activeWallId,
  activeFloorId,
  onSelectWall,
  onSelectFloor,
  onDragStart,
  isRemoveMode,
  toggleRemoveMode,
  confirmRemove,
  cancelRemove,
  hasSelection,
  currentPhase,
}) => {
  const [subTab, setSubTab] = React.useState<"furniture" | "wall" | "floor" | null>(null);
  const [previewWallId, setPreviewWallId] = React.useState<string | null>(null);
  const [previewFloorId, setPreviewFloorId] = React.useState<string | null>(null);

  const previewWall = customWalls?.find((w) => w.id === previewWallId);
  const previewFloor = customFloors?.find((f) => f.id === previewFloorId);

  const handleApplyWall = () => {
    if (previewWallId) {
      onSelectWall(previewWallId);
      setPreviewWallId(null);
    }
  };

  const handleApplyFloor = () => {
    if (previewFloorId) {
      onSelectFloor(previewFloorId);
      setPreviewFloorId(null);
    }
  };

  const handleCancelPreview = () => {
    setPreviewWallId(null);
    setPreviewFloorId(null);
  };

  if (!isOpen) return null;

  // Show furniture sub-tab
  if (subTab === null) {
    return (
      <div className="flex-1 flex flex-col min-h-0" data-component-name="SidebarFurniture" data-source-file="src/components/sidebar/SidebarFurniture.tsx">
        {/* Sub-tab selector */}
        <div className="p-2 border-b border-gray-100 flex gap-1">
          <button
            onClick={() => setSubTab("furniture")}
            className="flex-1 p-2 rounded-lg flex flex-col items-center gap-1 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-all"
          >
            <Sofa size={18} />
            <span className="text-[10px] font-bold">家具</span>
          </button>
          <button
            onClick={() => setSubTab("wall")}
            className="flex-1 p-2 rounded-lg flex flex-col items-center gap-1 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-all"
          >
            <Square size={18} />
            <span className="text-[10px] font-bold">牆壁</span>
          </button>
          <button
            onClick={() => setSubTab("floor")}
            className="flex-1 p-2 rounded-lg flex flex-col items-center gap-1 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-all"
          >
            <Grid size={18} />
            <span className="text-[10px] font-bold">地板</span>
          </button>
        </div>

        {/* Default furniture list */}
        <div className="flex-1 p-4 space-y-2 overflow-y-auto">
          {fullCatalog
            .filter((f) => inventory.includes(f.id))
            .map((item) => {
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => onDragStart(item)}
                  className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl cursor-grab hover:border-indigo-300 hover:shadow-sm transition-all active:scale-95"
                >
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                    {item.icon && typeof item.icon === "function" ? (
                      <item.icon size={18} className="text-slate-600" />
                    ) : item.spriteImages?.[0] ? (
                      <img src={item.spriteImages[0]} alt={item.name} className="w-full h-full object-contain" />
                    ) : (
                      <Sofa size={18} className="text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-slate-800">{item.name}</div>
                    <div className="text-xs text-slate-400">{item.desc || ""}</div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Remove mode controls */}
        <div className="p-4 border-t border-gray-100 space-y-2">
          {isRemoveMode && hasSelection && (
            <div className="flex gap-2 mb-2">
              <Button variant="primary" className="flex-1" onClick={confirmRemove} icon={Check}>
                確認移除
              </Button>
              <Button variant="ghost" className="flex-1" onClick={cancelRemove} icon={X}>
                取消
              </Button>
            </div>
          )}
          <Button
            variant={isRemoveMode ? "primary" : "secondary"}
            className="w-full"
            onClick={toggleRemoveMode}
            disabled={currentPhase !== "intro"}
          >
            <Trash2 size={16} /> {isRemoveMode ? "退出拆除模式" : "移除傢俱"}
          </Button>
        </div>
      </div>
    );
  }

  // Wall sub-tab
  if (subTab === "wall") {
    return (
      <div className="flex-1 flex flex-col min-h-0" data-component-name="SidebarFurniture-Wall" data-source-file="src/components/sidebar/SidebarFurniture.tsx">
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
          <button
            onClick={() => {
              setSubTab(null);
              handleCancelPreview();
            }}
            className="p-1 hover:bg-gray-100 rounded text-gray-400"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="font-bold text-sm text-gray-700">我的牆壁</span>
        </div>
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {(!customWalls || customWalls.length === 0) && (
            <div className="text-center text-gray-400 py-4">尚無牆壁樣式</div>
          )}
          {customWalls?.map((wall) => {
            const isActive = activeWallId === wall.id;
            const isPreviewing = previewWallId === wall.id;
            return (
              <div
                key={wall.id}
                onClick={() => setPreviewWallId(wall.id)}
                className={`bg-white border-2 rounded-xl p-3 cursor-pointer transition-all ${isPreviewing
                  ? "border-indigo-500 bg-indigo-50"
                  : isActive
                    ? "border-green-500 bg-green-50"
                    : "border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50"
                  }`}
              >
                <div className="flex gap-2 mb-2">
                  <div className="flex-1 aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img src={wall.lightImage} alt="亮面" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img src={wall.darkImage} alt="暗面" className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-gray-800">{wall.name}</div>
                  {isActive && (
                    <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                      <Check size={12} /> 使用中
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Preview Panel */}
        {previewWall && (
          <div className="border-t border-gray-200 bg-slate-50 p-4 space-y-3">
            <div className="text-xs text-slate-500 font-bold uppercase">預覽: {previewWall.name}</div>
            <div className="flex gap-2">
              <div className="flex-1 text-center">
                <div className="aspect-video rounded-lg overflow-hidden bg-white border border-gray-200 mb-1">
                  <img src={previewWall.lightImage} alt="亮面預覽" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] text-gray-400">亮面</span>
              </div>
              <div className="flex-1 text-center">
                <div className="aspect-video rounded-lg overflow-hidden bg-white border border-gray-200 mb-1">
                  <img src={previewWall.darkImage} alt="暗面預覽" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] text-gray-400">暗面</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={handleApplyWall} icon={Check}>
                應用
              </Button>
              <Button variant="secondary" className="flex-1" onClick={handleCancelPreview} icon={X}>
                取消
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Floor sub-tab
  if (subTab === "floor") {
    return (
      <div className="flex-1 flex flex-col min-h-0" data-component-name="SidebarFurniture-Floor" data-source-file="src/components/sidebar/SidebarFurniture.tsx">
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
          <button
            onClick={() => {
              setSubTab(null);
              handleCancelPreview();
            }}
            className="p-1 hover:bg-gray-100 rounded text-gray-400"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="font-bold text-sm text-gray-700">我的地板</span>
        </div>
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {(!customFloors || customFloors.length === 0) && (
            <div className="text-center text-gray-400 py-4">尚無地板樣式</div>
          )}
          {customFloors?.map((floor) => {
            const isActive = activeFloorId === floor.id;
            const isPreviewing = previewFloorId === floor.id;
            return (
              <div
                key={floor.id}
                onClick={() => setPreviewFloorId(floor.id)}
                className={`bg-white border-2 rounded-xl p-3 cursor-pointer transition-all ${isPreviewing
                  ? "border-indigo-500 bg-indigo-50"
                  : isActive
                    ? "border-green-500 bg-green-50"
                    : "border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50"
                  }`}
              >
                <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 mb-2">
                  <img src={floor.image} alt={floor.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-gray-800">{floor.name}</div>
                  {isActive && (
                    <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                      <Check size={12} /> 使用中
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Preview Panel */}
        {previewFloor && (
          <div className="border-t border-gray-200 bg-slate-50 p-4 space-y-3">
            <div className="text-xs text-slate-500 font-bold uppercase">預覽: {previewFloor.name}</div>
            <div className="aspect-video rounded-lg overflow-hidden bg-white border border-gray-200">
              <img src={previewFloor.image} alt="地板預覽" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={handleApplyFloor} icon={Check}>
                應用
              </Button>
              <Button variant="secondary" className="flex-1" onClick={handleCancelPreview} icon={X}>
                取消
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Furniture sub-tab (same as default)
  return (
    <div className="flex-1 flex flex-col min-h-0" data-component-name="SidebarFurniture-MyFurniture" data-source-file="src/components/sidebar/SidebarFurniture.tsx">
      <div className="p-3 border-b border-gray-100 flex items-center gap-2">
        <button
          onClick={() => setSubTab(null)}
          className="p-1 hover:bg-gray-100 rounded text-gray-400"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="font-bold text-sm text-gray-700">我的家具</span>
      </div>
      <div className="flex-1 p-4 space-y-2 overflow-y-auto">
        {fullCatalog
          .filter((f) => inventory.includes(f.id))
          .map((item) => {
            return (
              <div
                key={item.id}
                draggable
                onDragStart={() => onDragStart(item)}
                className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl cursor-grab hover:border-indigo-300 hover:shadow-sm transition-all active:scale-95"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                  {item.icon && typeof item.icon === "function" ? (
                    <item.icon size={18} className="text-slate-600" />
                  ) : item.spriteImages?.[0] ? (
                    <img src={item.spriteImages[0]} alt={item.name} className="w-full h-full object-contain" />
                  ) : (
                    <Sofa size={18} className="text-slate-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-slate-800">{item.name}</div>
                  <div className="text-xs text-slate-400">{item.desc || ""}</div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Remove mode controls */}
      <div className="p-4 border-t border-gray-100 space-y-2">
        {isRemoveMode && hasSelection && (
          <div className="flex gap-2 mb-2">
            <Button variant="primary" className="flex-1" onClick={confirmRemove} icon={Check}>
              確認移除
            </Button>
            <Button variant="ghost" className="flex-1" onClick={cancelRemove} icon={X}>
              取消
            </Button>
          </div>
        )}
        <Button
          variant={isRemoveMode ? "primary" : "secondary"}
          className="w-full"
          onClick={toggleRemoveMode}
          disabled={currentPhase !== "intro"}
        >
          <Trash2 size={16} /> {isRemoveMode ? "退出拆除模式" : "移除傢俱"}
        </Button>
      </div>
    </div>
  );
};
