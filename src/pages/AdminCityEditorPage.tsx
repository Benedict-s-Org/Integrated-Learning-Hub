import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCityLayout } from "@/hooks/useAdminCityLayout";
import { AdminCityMap } from "@/components/city/AdminCityMap";
import { BuildingStyleEditor } from "@/components/admin/BuildingStyleEditor";
import { CityTemplateManager, CityTemplate } from "@/components/admin/CityTemplateManager";
import { BUILDING_CATALOG, CITY_LEVELS } from "@/constants/cityLevels";
import type { Building, CityDecoration } from "@/types/city";
import {
  Users,
  Save,
  RotateCcw,
  Trash2,
  Building2,
  Trees,
  Coins,
  MapPin,
  ChevronDown,
  ChevronUp,
  Palette,
  Move,
  FileJson,
} from "lucide-react";

interface UserOption {
  id: string;
  display_name: string | null;
}

// Decoration types available for placement
const DECORATION_TYPES: CityDecoration["type"][] = [
  "tree", "bench", "lamp", "fountain", "sign", "vehicle",
  "flower", "bush", "mushroom", "birdhouse", "rock", "butterfly"
];

const DECORATION_LABELS: Record<CityDecoration["type"], string> = {
  tree: "樹木",
  bench: "長椅",
  lamp: "路燈",
  fountain: "噴泉",
  sign: "路牌",
  vehicle: "車輛",
  flower: "花朵",
  bush: "灌木",
  mushroom: "蘑菇",
  birdhouse: "鳥屋",
  rock: "石頭",
  butterfly: "蝴蝶",
};

export default function AdminCityEditorPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Panel state
  const [activePanel, setActivePanel] = useState<"buildings" | "decorations" | "settings" | "templates">("buildings");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(null);
  const [showBuildingList, setShowBuildingList] = useState(true);
  const [showDecorationList, setShowDecorationList] = useState(true);

  const {
    buildings,
    decorations,
    cityLevel,
    coins,
    isLoading,
    error,
    loadUserLayout,
    setCityLevel,
    setCoins,
    addBuilding,
    updateBuilding,
    removeBuilding,
    addDecoration,
    updateDecoration,
    removeDecoration,
    saveLayout,
    resetToDefault,
    setBuildings,
    setDecorations,
  } = useAdminCityLayout();

  // Load users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const { data: profiles, error } = await supabase
          .from("user_profiles")
          .select("id, display_name")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching users:", error);
          return;
        }

        setUsers(profiles || []);
      } catch (err) {
        console.error("Error in fetchUsers:", err);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  // Load user layout when selected
  useEffect(() => {
    if (selectedUserId) {
      loadUserLayout(selectedUserId);
      setSelectedBuildingId(null);
    }
  }, [selectedUserId, loadUserLayout]);

  const handleSave = async () => {
    if (!selectedUserId) return;

    setSaveStatus("saving");
    const success = await saveLayout(selectedUserId);
    setSaveStatus(success ? "saved" : "error");

    if (success) {
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  };

  const handleReset = () => {
    if (window.confirm("確定要重置城市為預設狀態嗎？此操作無法復原。")) {
      resetToDefault();
    }
  };

  const handleBuildingClick = (building: Building) => {
    setSelectedBuildingId(building.id);
    setSelectedDecorationId(null);
    setActivePanel("buildings");
  };

  const handleDecorationClick = (decoration: CityDecoration) => {
    setSelectedDecorationId(decoration.id);
    setSelectedBuildingId(null);
    setActivePanel("decorations");
  };

  const handleDecorationDrag = (id: string, newPosition: { x: number; y: number }) => {
    updateDecoration(id, { position: newPosition });
  };

  const handleBuildingDrag = (id: string, newPosition: { x: number; y: number }) => {
    const building = buildings.find(b => b.id === id);
    if (building) {
      updateBuilding(id, { position: newPosition });
    }
  };

  const handleAddBuilding = (catalogItem: typeof BUILDING_CATALOG[0]) => {
    // Check city level requirement
    if (catalogItem.requiredCityLevel > cityLevel) {
      alert(`需要城市等級 ${catalogItem.requiredCityLevel} 才能添加此建築`);
      return;
    }

    // Check max buildings
    const currentLevel = CITY_LEVELS.find(l => l.level === cityLevel);
    if (currentLevel && buildings.length >= currentLevel.maxBuildings) {
      alert(`已達到最大建築數量 (${currentLevel.maxBuildings})`);
      return;
    }

    // Find available position
    const gridSize = currentLevel?.cityGridSize || 8;
    let position = { x: Math.floor(gridSize / 2), y: Math.floor(gridSize / 2) };

    // Simple collision check - find first available spot
    let attempts = 0;
    while (attempts < 100) {
      const collision = buildings.some(b =>
        Math.abs(b.position.x - position.x) < catalogItem.size.width &&
        Math.abs(b.position.y - position.y) < catalogItem.size.depth
      );
      if (!collision) break;
      position = {
        x: Math.floor(Math.random() * (gridSize - catalogItem.size.width)),
        y: Math.floor(Math.random() * (gridSize - catalogItem.size.depth)),
      };
      attempts++;
    }

    addBuilding({
      name: catalogItem.name,
      type: catalogItem.type,
      position,
      size: catalogItem.size,
      exteriorStyle: catalogItem.defaultStyle,
      isUnlocked: true,
    });
  };

  const handleAddDecoration = (type: CityDecoration["type"]) => {
    const currentLevel = CITY_LEVELS.find(l => l.level === cityLevel);
    const gridSize = currentLevel?.cityGridSize || 8;

    // Random position within grid
    const position = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
    };

    addDecoration({
      type,
      position,
    });
  };

  // Handle applying a template
  const handleApplyTemplate = (template: CityTemplate) => {
    setBuildings(template.buildings);
    setDecorations(template.decorations);
    setCityLevel(template.cityLevel);
    setSelectedBuildingId(null);
    setSelectedDecorationId(null);
  };

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">城市編輯器</h1>
          </div>

          {/* User Selector */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <select
                value={selectedUserId || ""}
                onChange={(e) => setSelectedUserId(e.target.value || null)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm min-w-[200px]"
                disabled={isLoadingUsers}
              >
                <option value="">選擇用戶...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name || user.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>

            {selectedUserId && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg text-sm transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  重置
                </button>
                <button
                  onClick={handleSave}
                  disabled={saveStatus === "saving"}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${saveStatus === "saved"
                      ? "bg-green-600 text-white"
                      : saveStatus === "error"
                        ? "bg-red-600 text-white"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                >
                  <Save className="w-4 h-4" />
                  {saveStatus === "saving" ? "儲存中..." : saveStatus === "saved" ? "已儲存" : "儲存"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-65px)]">
        {/* Left Sidebar - Controls */}
        <aside className="w-80 border-r border-slate-700/50 bg-slate-900/50 overflow-y-auto">
          {selectedUserId ? (
            <>
              {/* Panel Tabs */}
              <div className="flex border-b border-slate-700/50">
                <button
                  onClick={() => setActivePanel("buildings")}
                  className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${activePanel === "buildings"
                      ? "bg-slate-800 text-white border-b-2 border-emerald-500"
                      : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Building2 className="w-4 h-4 inline mr-1" />
                  建築
                </button>
                <button
                  onClick={() => setActivePanel("decorations")}
                  className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${activePanel === "decorations"
                      ? "bg-slate-800 text-white border-b-2 border-emerald-500"
                      : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Trees className="w-4 h-4 inline mr-1" />
                  裝飾
                </button>
                <button
                  onClick={() => setActivePanel("settings")}
                  className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${activePanel === "settings"
                      ? "bg-slate-800 text-white border-b-2 border-emerald-500"
                      : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Coins className="w-4 h-4 inline mr-1" />
                  設定
                </button>
                <button
                  onClick={() => setActivePanel("templates")}
                  className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${activePanel === "templates"
                      ? "bg-slate-800 text-white border-b-2 border-emerald-500"
                      : "text-slate-400 hover:text-white"
                    }`}
                >
                  <FileJson className="w-4 h-4 inline mr-1" />
                  模板
                </button>
              </div>

              {/* Panel Content */}
              <div className="p-4">
                {activePanel === "buildings" && (
                  <div className="space-y-4">
                    {/* Add Building Section */}
                    <div>
                      <h3 className="text-sm font-medium text-slate-300 mb-2">添加建築</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {BUILDING_CATALOG.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleAddBuilding(item)}
                            disabled={item.requiredCityLevel > cityLevel}
                            className={`p-2 rounded-lg text-xs text-left transition-colors ${item.requiredCityLevel > cityLevel
                                ? "bg-slate-800/50 text-slate-500 cursor-not-allowed"
                                : "bg-slate-800 hover:bg-slate-700 text-white"
                              }`}
                          >
                            <div className="font-medium">{item.name}</div>
                            <div className="text-slate-400 mt-1">
                              Lv.{item.requiredCityLevel} | ${item.cost}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Current Buildings */}
                    <div>
                      <button
                        onClick={() => setShowBuildingList(!showBuildingList)}
                        className="flex items-center justify-between w-full text-sm font-medium text-slate-300 mb-2"
                      >
                        <span>現有建築 ({buildings.length})</span>
                        {showBuildingList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {showBuildingList && (
                        <div className="space-y-2">
                          {buildings.map((building) => (
                            <div
                              key={building.id}
                              className={`p-3 rounded-lg transition-colors cursor-pointer ${selectedBuildingId === building.id
                                  ? "bg-emerald-600/20 border border-emerald-500/50"
                                  : "bg-slate-800 hover:bg-slate-700"
                                }`}
                              onClick={() => setSelectedBuildingId(building.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-sm">{building.name}</div>
                                  <div className="text-xs text-slate-400">
                                    <MapPin className="w-3 h-3 inline mr-1" />
                                    ({building.position.x}, {building.position.y})
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`確定要刪除 "${building.name}" 嗎？`)) {
                                      removeBuilding(building.id);
                                      if (selectedBuildingId === building.id) {
                                        setSelectedBuildingId(null);
                                      }
                                    }
                                  }}
                                  className="p-1.5 hover:bg-red-600/20 rounded text-red-400 hover:text-red-300"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected Building Editor */}
                    {selectedBuilding && (
                      <div className="border-t border-slate-700 pt-4">
                        <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                          <Palette className="w-4 h-4" />
                          編輯建築: {selectedBuilding.name}
                        </h3>
                        <div className="space-y-3">
                          {/* Basic Info */}
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">名稱</label>
                            <input
                              type="text"
                              value={selectedBuilding.name}
                              onChange={(e) => updateBuilding(selectedBuilding.id, { name: e.target.value })}
                              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">X 位置</label>
                              <input
                                type="number"
                                value={selectedBuilding.position.x}
                                onChange={(e) => updateBuilding(selectedBuilding.id, {
                                  position: { ...selectedBuilding.position, x: parseInt(e.target.value) || 0 }
                                })}
                                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Y 位置</label>
                              <input
                                type="number"
                                value={selectedBuilding.position.y}
                                onChange={(e) => updateBuilding(selectedBuilding.id, {
                                  position: { ...selectedBuilding.position, y: parseInt(e.target.value) || 0 }
                                })}
                                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="unlocked"
                              checked={selectedBuilding.isUnlocked}
                              onChange={(e) => updateBuilding(selectedBuilding.id, { isUnlocked: e.target.checked })}
                              className="rounded"
                            />
                            <label htmlFor="unlocked" className="text-sm text-slate-300">已解鎖</label>
                          </div>

                          {/* Style Editor */}
                          <div className="border-t border-slate-700 pt-4 mt-4">
                            <h4 className="text-xs font-medium text-emerald-400 mb-3">外觀自訂</h4>
                            <BuildingStyleEditor
                              building={selectedBuilding}
                              onUpdate={updateBuilding}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activePanel === "decorations" && (
                  <div className="space-y-4">
                    {/* Add Decoration Section */}
                    <div>
                      <h3 className="text-sm font-medium text-slate-300 mb-2">添加裝飾</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {DECORATION_TYPES.map((type) => (
                          <button
                            key={type}
                            onClick={() => handleAddDecoration(type)}
                            className="p-2 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                          >
                            {DECORATION_LABELS[type]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Current Decorations */}
                    <div>
                      <button
                        onClick={() => setShowDecorationList(!showDecorationList)}
                        className="flex items-center justify-between w-full text-sm font-medium text-slate-300 mb-2"
                      >
                        <span>現有裝飾 ({decorations.length})</span>
                        {showDecorationList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {showDecorationList && (
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {decorations.map((decoration) => (
                            <div
                              key={decoration.id}
                              className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${selectedDecorationId === decoration.id
                                  ? "bg-emerald-600/20 border border-emerald-500/50"
                                  : "bg-slate-800 hover:bg-slate-700"
                                }`}
                              onClick={() => setSelectedDecorationId(decoration.id)}
                            >
                              <div className="text-xs">
                                <span className="font-medium">{DECORATION_LABELS[decoration.type]}</span>
                                <span className="text-slate-400 ml-2">
                                  ({decoration.position.x}, {decoration.position.y})
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeDecoration(decoration.id);
                                  if (selectedDecorationId === decoration.id) {
                                    setSelectedDecorationId(null);
                                  }
                                }}
                                className="p-1 hover:bg-red-600/20 rounded text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected Decoration Editor */}
                    {selectedDecorationId && decorations.find(d => d.id === selectedDecorationId) && (
                      <div className="border-t border-slate-700 pt-4">
                        <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                          <Move className="w-4 h-4" />
                          編輯裝飾: {DECORATION_LABELS[decorations.find(d => d.id === selectedDecorationId)!.type]}
                        </h3>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">X 位置</label>
                              <input
                                type="number"
                                value={decorations.find(d => d.id === selectedDecorationId)?.position.x ?? 0}
                                onChange={(e) => updateDecoration(selectedDecorationId, {
                                  position: {
                                    ...decorations.find(d => d.id === selectedDecorationId)!.position,
                                    x: parseInt(e.target.value) || 0
                                  }
                                })}
                                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Y 位置</label>
                              <input
                                type="number"
                                value={decorations.find(d => d.id === selectedDecorationId)?.position.y ?? 0}
                                onChange={(e) => updateDecoration(selectedDecorationId, {
                                  position: {
                                    ...decorations.find(d => d.id === selectedDecorationId)!.position,
                                    y: parseInt(e.target.value) || 0
                                  }
                                })}
                                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">變體 (可選)</label>
                            <input
                              type="text"
                              value={decorations.find(d => d.id === selectedDecorationId)?.variant ?? ""}
                              onChange={(e) => updateDecoration(selectedDecorationId, {
                                variant: e.target.value || undefined
                              })}
                              placeholder="例如: red, small..."
                              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm"
                            />
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            💡 直接在地圖上拖動裝飾可快速調整位置
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activePanel === "settings" && (
                  <div className="space-y-4">
                    {/* City Level */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">城市等級</label>
                      <select
                        value={cityLevel}
                        onChange={(e) => setCityLevel(parseInt(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm"
                      >
                        {CITY_LEVELS.map((level) => (
                          <option key={level.level} value={level.level}>
                            Lv.{level.level} - {level.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-400 mt-1">
                        最大建築: {CITY_LEVELS.find(l => l.level === cityLevel)?.maxBuildings || 0}
                      </p>
                    </div>

                    {/* Coins */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">金幣</label>
                      <input
                        type="number"
                        value={coins}
                        onChange={(e) => setCoins(parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm"
                        min={0}
                      />
                    </div>

                    {/* Stats */}
                    <div className="border-t border-slate-700 pt-4">
                      <h3 className="text-sm font-medium text-slate-300 mb-2">統計</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">建築數量</span>
                          <span>{buildings.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">裝飾數量</span>
                          <span>{decorations.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activePanel === "templates" && (
                  <CityTemplateManager
                    buildings={buildings}
                    decorations={decorations}
                    cityLevel={cityLevel}
                    onApplyTemplate={handleApplyTemplate}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>請選擇一個用戶來編輯其城市</p>
            </div>
          )}
        </aside>

        {/* Main View - City Map */}
        <main className="flex-1 relative overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-red-400 text-center">
                <p className="mb-2">載入失敗</p>
                <p className="text-sm text-slate-400">{error}</p>
              </div>
            </div>
          ) : selectedUserId ? (
            <AdminCityMap
              buildings={buildings}
              decorations={decorations}
              cityLevel={cityLevel}
              coins={coins}
              selectedBuildingId={selectedBuildingId}
              selectedDecorationId={selectedDecorationId}
              onBuildingClick={handleBuildingClick}
              onDecorationClick={handleDecorationClick}
              onDecorationDrag={handleDecorationDrag}
              onBuildingDrag={handleBuildingDrag}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <MapPin className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">選擇用戶以查看城市</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
