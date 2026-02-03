import React, { useState } from "react";
import {
  Brain,
  Menu,
  ChevronLeft,
  Home,
  Sofa,
  MapPin,
  History,
  ShieldCheck,
  LogOut,
  User,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SidebarMenu } from "./SidebarMenu";
import { SidebarFurniture } from "./SidebarFurniture";
import { SidebarMemory } from "./SidebarMemory";
import { SidebarHistory } from "./SidebarHistory";
import { SidebarAdmin } from "./SidebarAdmin";
import { MemoryPoint } from "@/hooks/useMemoryPoints";

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
}

interface HistoryRecord {
  id: string;
  name: string;
  timestamp: string;
  data: any[];
}

interface SidebarProps {
  isOpen: boolean;
  toggle: () => void;
  coins: number;
  onStart: () => void;
  onShop: () => void;
  onCity: () => void;
  currentPhase: string;
  isAdmin: boolean;
  inventory: string[];
  onDragStart: (item: FurnitureItem) => void;
  isRemoveMode: boolean;
  toggleRemoveMode: () => void;
  confirmRemove: () => void;
  cancelRemove: () => void;
  hasSelection: boolean;
  onOpenUploader: () => void;
  onOpenStudio: () => void;
  onOpenEditor: () => void;
  onOpenSpaceDesign: () => void;
  onOpenCityEditor: () => void;
  onOpenAssetUpload: () => void;
  globalHistory: HistoryRecord[];
  onRestoreHistory: (record: HistoryRecord) => void;
  fullCatalog: FurnitureItem[];
  customWalls: CustomWall[];
  customFloors: CustomFloor[];
  activeWallId: string | null;
  activeFloorId: string | null;
  onSelectWall: (id: string) => void;
  onSelectFloor: (id: string) => void;
  isMemoryMode: boolean;
  toggleMemoryMode: () => void;
  isStudyMode: boolean;
  toggleStudyMode: () => void;
  dueCount: number;
  memoryPoints: MemoryPoint[];
  onAddMemory: (type: string) => void;
  onEditMemory: (point: MemoryPoint) => void;
  onDeleteMemory: (id: string) => void;
  onViewMemory: (point: MemoryPoint) => void;
  getTargetName: (type: string, id: string) => string;
  onExit?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  toggle,
  coins,
  onStart,
  onShop,
  onCity,
  currentPhase,
  isAdmin,
  inventory,
  onDragStart,
  isRemoveMode,
  toggleRemoveMode,
  confirmRemove,
  cancelRemove,
  hasSelection,
  onOpenUploader,
  onOpenStudio,
  onOpenEditor,
  onOpenSpaceDesign,
  onOpenCityEditor,
  onOpenAssetUpload,
  globalHistory,
  onRestoreHistory,
  fullCatalog,
  customWalls,
  customFloors,
  activeWallId,
  activeFloorId,
  onSelectWall,
  onSelectFloor,
  isMemoryMode,
  toggleMemoryMode,
  isStudyMode,
  toggleStudyMode,
  dueCount,
  memoryPoints,
  onAddMemory,
  onEditMemory,
  onDeleteMemory,
  onViewMemory,
  getTargetName,
  onExit,
}) => {
  const { signOut, profile, user, toggleViewMode, isUserView } = useAuth();
  const [tab, setTab] = useState<"menu" | "furniture" | "memory" | "history" | "admin">("menu");

  return (
    <div
      className={`relative h-full bg-white border-r border-gray-200 shadow-xl z-30 transition-all duration-300 flex flex-col ${isOpen ? "w-64" : "w-20"
        }`}
      data-component-name="Sidebar"
      data-source-file="src/components/sidebar/Sidebar.tsx"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        {isOpen ? (
          <div className="flex items-center gap-2 font-bold text-indigo-900">
            <div className="bg-indigo-600 text-white p-1 rounded-md">
              <Brain size={16} />
            </div>
            <span>Memory Palace</span>
          </div>
        ) : (
          <div className="mx-auto bg-indigo-600 text-white p-2 rounded-lg">
            <Brain size={20} />
          </div>
        )}
        <button
          onClick={toggle}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          {isOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className={`flex ${isOpen ? "p-2 gap-1" : "flex-col p-2 gap-2"}`}>
        {[
          { id: "menu" as const, icon: Home, label: "主頁" },
          { id: "furniture" as const, icon: Sofa, label: "物品" },
          { id: "memory" as const, icon: MapPin, label: "記憶" },
          { id: "history" as const, icon: History, label: "歷史" },
          ...(isAdmin ? [{ id: "admin" as const, icon: ShieldCheck, label: "管理" }] : []),
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center justify-center gap-2 p-2 rounded-lg transition-all ${isOpen ? "flex-1" : "w-full"
              } ${tab === t.id
                ? "bg-indigo-100 text-indigo-600"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              }`}
            data-component-name={`SidebarTab-${t.id}`}
            data-source-file="src/components/sidebar/Sidebar.tsx"
          >
            <t.icon size={18} />
            {isOpen && <span className="text-xs font-bold">{t.label}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {tab === "menu" && isOpen && (
          <SidebarMenu
            coins={coins}
            isAdmin={isAdmin}
            dueCount={dueCount}
            onStart={onStart}
            onShop={onShop}
            onCity={onCity}
            currentPhase={currentPhase}
          />
        )}

        {tab === "furniture" && (
          <SidebarFurniture
            isOpen={isOpen}
            inventory={inventory}
            fullCatalog={fullCatalog}
            customWalls={customWalls}
            customFloors={customFloors}
            activeWallId={activeWallId}
            activeFloorId={activeFloorId}
            onSelectWall={onSelectWall}
            onSelectFloor={onSelectFloor}
            onDragStart={onDragStart}
            isRemoveMode={isRemoveMode}
            toggleRemoveMode={toggleRemoveMode}
            confirmRemove={confirmRemove}
            cancelRemove={cancelRemove}
            hasSelection={hasSelection}
            currentPhase={currentPhase}
          />
        )}

        {tab === "memory" && (
          <SidebarMemory
            isOpen={isOpen}
            isMemoryMode={isMemoryMode}
            toggleMemoryMode={toggleMemoryMode}
            memoryPoints={memoryPoints}
            onAddMemory={onAddMemory}
            onEditMemory={onEditMemory}
            onDeleteMemory={onDeleteMemory}
            onViewMemory={onViewMemory}
            getTargetName={getTargetName}
          />
        )}

        {tab === "history" && (
          <SidebarHistory
            isOpen={isOpen}
            globalHistory={globalHistory}
            onRestoreHistory={onRestoreHistory}
          />
        )}

        {tab === "admin" && isAdmin && (
          <SidebarAdmin
            isOpen={isOpen}
            onOpenStudio={onOpenStudio}
            onOpenUploader={onOpenUploader}
            onOpenEditor={onOpenEditor}
            onOpenSpaceDesign={onOpenSpaceDesign}
            onOpenCityEditor={onOpenCityEditor}
            onOpenAssetUpload={onOpenAssetUpload}
          />
        )}
      </div>

      {/* Footer - User Info */}
      {isOpen && (
        <div className="border-t border-gray-100 p-4 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <User size={18} className="text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-slate-800 truncate">
                {profile?.display_name || profile?.username || "使用者"}
              </div>
              <div className="text-xs text-slate-400 truncate">
                {isAdmin ? "管理員" : "學習者"}
              </div>
            </div>
          </div>

          {onExit && (
            <button
              onClick={onExit}
              className="w-full flex items-center justify-center gap-2 py-2 mb-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            >
              <LogOut size={16} className="rotate-180" />
              返回中心
            </button>
          )}

          {user?.role === 'admin' && (
            <button
              onClick={toggleViewMode}
              className={`w-full flex items-center justify-center gap-2 py-2 mb-2 text-sm rounded-lg transition-all ${isUserView
                ? "text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200"
                : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent"
                }`}
              title={isUserView ? "Switch to Admin" : "Switch to User"}
            >
              <div className={`transition-transform duration-300 ${isUserView ? 'rotate-12' : ''}`}>
                {isUserView ? <ShieldCheck size={16} className="text-purple-600" /> : <User size={16} />}
              </div>
              {isOpen && <span>{isUserView ? "Switch to Admin" : "Switch to User"}</span>}
            </button>
          )}

          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut size={16} />
            登出
          </button>
        </div>
      )}
    </div>
  );
};
