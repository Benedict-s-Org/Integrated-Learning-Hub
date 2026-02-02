import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCityLayout } from "@/hooks/useAdminCityLayout";
import { AdminCityMap } from "@/components/city/AdminCityMap";
import { CityTemplateManager, CityTemplate } from "@/components/admin/CityTemplateManager";
import { CityTransformPanel } from "@/components/admin/CityTransformPanel";
import { BUILDING_CATALOG, CITY_LEVELS } from "@/constants/cityLevels";
import type { Building, CityDecoration, CityStyleAsset, CityAssetType, CityTransformData } from "@/types/city";
import { BackgroundRemovalEditor } from "@/components/common/BackgroundRemovalEditor";
import { dataUrlToFile } from "@/utils/imageProcessing";
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
  FileJson,
  X,
  Upload,
  Image,
  Loader2,
  Wand2,
  Sliders,
} from "lucide-react";

interface UserOption {
  id: string;
  display_name: string | null;
}

interface CityEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

const ASSET_TYPE_LABELS: Record<CityAssetType, string> = {
  building: "建築",
  decoration: "裝飾",
  ground: "地面",
  road: "道路",
};

export const CityEditorModal: React.FC<CityEditorModalProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  
  const [activePanel, setActivePanel] = useState<"buildings" | "decorations" | "settings" | "templates" | "style">("buildings");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(null);
  const [showBuildingList, setShowBuildingList] = useState(true);
  const [showDecorationList, setShowDecorationList] = useState(true);

  // Style panel state
  const [styleAssets, setStyleAssets] = useState<CityStyleAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [uploadAssetType, setUploadAssetType] = useState<CityAssetType>("building");
  const [uploadAssetName, setUploadAssetName] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showBgRemoval, setShowBgRemoval] = useState(false);

  // Transform panel state
  const [showTransformPanel, setShowTransformPanel] = useState(false);
  const [transformTarget, setTransformTarget] = useState<{ type: 'building' | 'decoration'; id: string } | null>(null);

  // Default city settings state
  const [defaultCityLevel, setDefaultCityLevel] = useState(0);
  const [defaultCityCoins, setDefaultCityCoins] = useState(0);
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);

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

  // Fetch users on open
  useEffect(() => {
    if (!isOpen) return;
    
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
  }, [isOpen]);

  // Fetch style assets and default settings
  const fetchStyleAssets = useCallback(async () => {
    setIsLoadingAssets(true);
    try {
      const { data, error } = await supabase
        .from("city_style_assets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching style assets:", error);
        return;
      }

      // Cast the data to CityStyleAsset[]
      setStyleAssets((data || []) as unknown as CityStyleAsset[]);
    } catch (err) {
      console.error("Error in fetchStyleAssets:", err);
    } finally {
      setIsLoadingAssets(false);
    }
  }, []);

  const fetchDefaultSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("default_user_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["initial_city_level", "initial_city_coins"]);

      if (error) {
        console.error("Error fetching default settings:", error);
        return;
      }

      const settings = (data || []).reduce((acc, s) => ({
        ...acc,
        [s.setting_key]: s.setting_value
      }), {} as Record<string, { value?: number }>);

      setDefaultCityLevel(settings.initial_city_level?.value ?? 0);
      setDefaultCityCoins(settings.initial_city_coins?.value ?? 0);
    } catch (err) {
      console.error("Error in fetchDefaultSettings:", err);
    }
  }, []);

  useEffect(() => {
    if (isOpen && (activePanel === "style" || activePanel === "buildings" || activePanel === "decorations")) {
      fetchStyleAssets();
    }
    if (isOpen && activePanel === "style") {
      fetchDefaultSettings();
    }
  }, [isOpen, activePanel, fetchStyleAssets, fetchDefaultSettings]);

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
    if (catalogItem.requiredCityLevel > cityLevel) {
      alert(`需要城市等級 ${catalogItem.requiredCityLevel} 才能添加此建築`);
      return;
    }

    const currentLevel = CITY_LEVELS.find(l => l.level === cityLevel);
    if (currentLevel && buildings.length >= currentLevel.maxBuildings) {
      alert(`已達到最大建築數量 (${currentLevel.maxBuildings})`);
      return;
    }

    const gridSize = currentLevel?.cityGridSize || 16;
    let position = { x: Math.floor(gridSize / 2), y: Math.floor(gridSize / 2) };
    
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
    const gridSize = currentLevel?.cityGridSize || 16;
    
    const position = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
    };

    addDecoration({
      type,
      position,
    });
  };

  const handleApplyTemplate = (template: CityTemplate) => {
    setBuildings(template.buildings);
    setDecorations(template.decorations);
    setCityLevel(template.cityLevel);
    setSelectedBuildingId(null);
    setSelectedDecorationId(null);
  };

  // Asset upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(png|svg\+xml)$/)) {
      alert("僅支援 PNG 或 SVG 圖片");
      return;
    }

    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAssetUpload = async () => {
    if (!uploadFile || !uploadAssetName.trim()) {
      alert("請選擇圖片並輸入名稱");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${uploadAssetType}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("city-assets")
        .upload(fileName, uploadFile);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        alert("上傳失敗：" + uploadError.message);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("city-assets")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from("city_style_assets")
        .insert({
          asset_type: uploadAssetType,
          name: uploadAssetName.trim(),
          image_url: publicUrl,
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        alert("儲存資料失敗：" + insertError.message);
        return;
      }

      // Reset form and refresh assets
      setUploadFile(null);
      setUploadPreview(null);
      setUploadAssetName("");
      fetchStyleAssets();
    } catch (err) {
      console.error("Error in handleAssetUpload:", err);
      alert("上傳過程發生錯誤");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAsset = async (asset: CityStyleAsset) => {
    if (!window.confirm(`確定要刪除 "${asset.name}" 嗎？`)) return;

    try {
      // Extract file path from URL
      const urlParts = asset.image_url.split("/city-assets/");
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from("city-assets").remove([filePath]);
      }

      const { error } = await supabase
        .from("city_style_assets")
        .delete()
        .eq("id", asset.id);

      if (error) {
        console.error("Delete error:", error);
        alert("刪除失敗：" + error.message);
        return;
      }

      fetchStyleAssets();
    } catch (err) {
      console.error("Error in handleDeleteAsset:", err);
      alert("刪除過程發生錯誤");
    }
  };

  const handleSaveDefaultSettings = async () => {
    setIsSavingDefaults(true);
    try {
      const updates = [
        { setting_key: "initial_city_level", setting_value: { value: defaultCityLevel } },
        { setting_key: "initial_city_coins", setting_value: { value: defaultCityCoins } },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from("default_user_settings")
          .upsert(update, { onConflict: "setting_key" });

        if (error) {
          console.error("Error saving default:", error);
          alert("儲存失敗：" + error.message);
          return;
        }
      }

      alert("預設設定已儲存");
    } catch (err) {
      console.error("Error in handleSaveDefaultSettings:", err);
      alert("儲存過程發生錯誤");
    } finally {
      setIsSavingDefaults(false);
    }
  };

  const handleSaveCurrentAsDefault = async (type: "buildings" | "decorations") => {
    try {
      const settingKey = type === "buildings" ? "default_city_buildings" : "default_city_decorations";
      const items = type === "buildings" ? buildings : decorations;

      const { error } = await supabase
        .from("default_user_settings")
        .upsert({
          setting_key: settingKey,
          setting_value: { items },
        }, { onConflict: "setting_key" });

      if (error) {
        console.error("Error saving default:", error);
        alert("儲存失敗：" + error.message);
        return;
      }

      alert(`已將當前${type === "buildings" ? "建築" : "裝飾"}配置設為預設`);
    } catch (err) {
      console.error("Error in handleSaveCurrentAsDefault:", err);
      alert("儲存過程發生錯誤");
    }
  };

  const handleBgRemovalApply = (processedDataUrl: string) => {
    setUploadPreview(processedDataUrl);
    const processedFile = dataUrlToFile(
      processedDataUrl,
      uploadFile?.name.replace(/\.[^.]+$/, '.png') || 'processed.png'
    );
    setUploadFile(processedFile);
    setShowBgRemoval(false);
  };

  // Handle transform panel apply
  const handleTransformApply = (newTransform: CityTransformData) => {
    if (!transformTarget) return;
    
    if (transformTarget.type === 'building') {
      updateBuilding(transformTarget.id, { transform: newTransform });
    } else {
      updateDecoration(transformTarget.id, { transform: newTransform });
    }
    
    setShowTransformPanel(false);
    setTransformTarget(null);
  };

  // Open transform panel for building
  const openBuildingTransform = (building: Building) => {
    setTransformTarget({ type: 'building', id: building.id });
    setShowTransformPanel(true);
  };

  // Open transform panel for decoration
  const openDecorationTransform = (decoration: CityDecoration) => {
    setTransformTarget({ type: 'decoration', id: decoration.id });
    setShowTransformPanel(true);
  };

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
  const selectedDecoration = decorations.find(d => d.id === selectedDecorationId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-[95vw] h-[90vh] max-w-[1600px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-slate-700/50 bg-slate-900/80 px-4 py-3 flex items-center justify-between shrink-0">
          <h1 className="text-xl font-bold text-white">城市編輯器</h1>

          <div className="flex items-center gap-4">
            {/* User Selector */}
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <select
                value={selectedUserId || ""}
                onChange={(e) => setSelectedUserId(e.target.value || null)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm min-w-[200px] text-white"
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                    saveStatus === "saved"
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

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <aside className="w-72 border-r border-slate-700/50 bg-slate-900/50 overflow-y-auto shrink-0">
            {selectedUserId ? (
              <>
                {/* Panel Tabs */}
                <div className="flex border-b border-slate-700/50">
                  <button
                    onClick={() => setActivePanel("buildings")}
                    className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${
                      activePanel === "buildings"
                        ? "bg-slate-800 text-white border-b-2 border-emerald-500"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Building2 className="w-4 h-4 inline mr-1" />
                    建築
                  </button>
                  <button
                    onClick={() => setActivePanel("decorations")}
                    className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${
                      activePanel === "decorations"
                        ? "bg-slate-800 text-white border-b-2 border-emerald-500"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Trees className="w-4 h-4 inline mr-1" />
                    裝飾
                  </button>
                  <button
                    onClick={() => setActivePanel("settings")}
                    className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${
                      activePanel === "settings"
                        ? "bg-slate-800 text-white border-b-2 border-emerald-500"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Coins className="w-4 h-4 inline mr-1" />
                    設定
                  </button>
                  <button
                    onClick={() => setActivePanel("templates")}
                    className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${
                      activePanel === "templates"
                        ? "bg-slate-800 text-white border-b-2 border-emerald-500"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <FileJson className="w-4 h-4 inline mr-1" />
                    模板
                  </button>
                  <button
                    onClick={() => setActivePanel("style")}
                    className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${
                      activePanel === "style"
                        ? "bg-slate-800 text-white border-b-2 border-emerald-500"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Image className="w-4 h-4 inline mr-1" />
                    風格
                  </button>
                </div>

                {/* Panel Content */}
                <div className="p-4">
                  {activePanel === "buildings" && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium text-slate-300 mb-2">添加建築</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {BUILDING_CATALOG.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => handleAddBuilding(item)}
                              disabled={item.requiredCityLevel > cityLevel}
                              className={`p-2 rounded-lg text-xs text-left transition-colors ${
                                item.requiredCityLevel > cityLevel
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
                                className={`p-3 rounded-lg transition-colors cursor-pointer ${
                                  selectedBuildingId === building.id
                                    ? "bg-emerald-600/20 border border-emerald-500/50"
                                    : "bg-slate-800 hover:bg-slate-700"
                                }`}
                                onClick={() => setSelectedBuildingId(building.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium text-sm text-white">{building.name}</div>
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

                      {selectedBuilding && (
                        <div className="border-t border-slate-700 pt-4">
                          <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                            <Palette className="w-4 h-4" />
                            編輯建築: {selectedBuilding.name}
                          </h3>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">名稱</label>
                              <input
                                type="text"
                                value={selectedBuilding.name}
                                onChange={(e) => updateBuilding(selectedBuilding.id, { name: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
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
                                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
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
                                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                                />
                              </div>
                            </div>

                            {/* Style Selector for Buildings */}
                            <div className="border-t border-slate-700 pt-3">
                              <label className="block text-xs text-slate-400 mb-2">外觀風格</label>
                              
                              {selectedBuilding.customImageUrl ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 p-2 bg-slate-700 rounded-lg">
                                    <img 
                                      src={selectedBuilding.customImageUrl} 
                                      alt="Custom" 
                                      className="w-10 h-10 object-contain"
                                    />
                                    <span className="text-xs text-slate-300 flex-1">使用自定義圖片</span>
                                  </div>
                                  <button
                                    onClick={() => updateBuilding(selectedBuilding.id, { 
                                      customImageUrl: undefined, 
                                      customAssetId: undefined 
                                    })}
                                    className="w-full px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded text-xs transition-colors"
                                  >
                                    恢復預設風格
                                  </button>
                                  {/* Fine-tune button */}
                                  <button
                                    onClick={() => openBuildingTransform(selectedBuilding)}
                                    className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg text-sm transition-colors"
                                  >
                                    <Sliders className="w-4 h-4" />
                                    精細調整
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="text-xs text-slate-500 mb-1">選擇已上傳的建築圖片：</div>
                                  <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
                                    {styleAssets
                                      .filter(a => a.asset_type === 'building')
                                      .map((asset) => (
                                        <button
                                          key={asset.id}
                                          onClick={() => updateBuilding(selectedBuilding.id, {
                                            customImageUrl: asset.image_url,
                                            customAssetId: asset.id,
                                          })}
                                          className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors group"
                                        >
                                          <img 
                                            src={asset.image_url} 
                                            alt={asset.name}
                                            className="w-full h-8 object-contain"
                                          />
                                          <div className="text-[10px] text-slate-400 truncate mt-0.5 group-hover:text-white">
                                            {asset.name}
                                          </div>
                                        </button>
                                      ))}
                                  </div>
                                  {styleAssets.filter(a => a.asset_type === 'building').length === 0 && (
                                    <div className="text-xs text-slate-500 text-center py-2">
                                      尚無建築圖片，請在「風格」分頁上傳
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activePanel === "decorations" && (
                    <div className="space-y-4">
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

                      <div>
                        <button
                          onClick={() => setShowDecorationList(!showDecorationList)}
                          className="flex items-center justify-between w-full text-sm font-medium text-slate-300 mb-2"
                        >
                          <span>現有裝飾 ({decorations.length})</span>
                          {showDecorationList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {showDecorationList && (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {decorations.map((decoration) => (
                              <div
                                key={decoration.id}
                                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                  selectedDecorationId === decoration.id
                                    ? "bg-emerald-600/20 border border-emerald-500/50"
                                    : "bg-slate-800 hover:bg-slate-700"
                                }`}
                                onClick={() => setSelectedDecorationId(decoration.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="text-sm text-white">{DECORATION_LABELS[decoration.type]}</div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeDecoration(decoration.id);
                                      if (selectedDecorationId === decoration.id) {
                                        setSelectedDecorationId(null);
                                      }
                                    }}
                                    className="p-1 hover:bg-red-600/20 rounded text-red-400"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Decoration Edit Panel with Style Selector */}
                      {selectedDecoration && (
                        <div className="border-t border-slate-700 pt-4">
                          <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                            <Palette className="w-4 h-4" />
                            編輯裝飾: {DECORATION_LABELS[selectedDecoration.type]}
                          </h3>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">X 位置</label>
                                <input
                                  type="number"
                                  value={selectedDecoration.position.x}
                                  onChange={(e) => updateDecoration(selectedDecoration.id, {
                                    position: { ...selectedDecoration.position, x: parseInt(e.target.value) || 0 }
                                  })}
                                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">Y 位置</label>
                                <input
                                  type="number"
                                  value={selectedDecoration.position.y}
                                  onChange={(e) => updateDecoration(selectedDecoration.id, {
                                    position: { ...selectedDecoration.position, y: parseInt(e.target.value) || 0 }
                                  })}
                                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                                />
                              </div>
                            </div>

                            {/* Style Selector for Decorations */}
                            <div className="border-t border-slate-700 pt-3">
                              <label className="block text-xs text-slate-400 mb-2">外觀風格</label>
                              
                              {selectedDecoration.customImageUrl ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 p-2 bg-slate-700 rounded-lg">
                                    <img 
                                      src={selectedDecoration.customImageUrl} 
                                      alt="Custom" 
                                      className="w-10 h-10 object-contain"
                                    />
                                    <span className="text-xs text-slate-300 flex-1">使用自定義圖片</span>
                                  </div>
                                  <button
                                    onClick={() => updateDecoration(selectedDecoration.id, { 
                                      customImageUrl: undefined, 
                                      customAssetId: undefined 
                                    })}
                                    className="w-full px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded text-xs transition-colors"
                                  >
                                    恢復預設風格
                                  </button>
                                  {/* Fine-tune button */}
                                  <button
                                    onClick={() => openDecorationTransform(selectedDecoration)}
                                    className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg text-sm transition-colors"
                                  >
                                    <Sliders className="w-4 h-4" />
                                    精細調整
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="text-xs text-slate-500 mb-1">選擇已上傳的裝飾圖片：</div>
                                  <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
                                    {styleAssets
                                      .filter(a => a.asset_type === 'decoration')
                                      .map((asset) => (
                                        <button
                                          key={asset.id}
                                          onClick={() => updateDecoration(selectedDecoration.id, {
                                            customImageUrl: asset.image_url,
                                            customAssetId: asset.id,
                                          })}
                                          className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors group"
                                        >
                                          <img 
                                            src={asset.image_url} 
                                            alt={asset.name}
                                            className="w-full h-8 object-contain"
                                          />
                                          <div className="text-[10px] text-slate-400 truncate mt-0.5 group-hover:text-white">
                                            {asset.name}
                                          </div>
                                        </button>
                                      ))}
                                  </div>
                                  {styleAssets.filter(a => a.asset_type === 'decoration').length === 0 && (
                                    <div className="text-xs text-slate-500 text-center py-2">
                                      尚無裝飾圖片，請在「風格」分頁上傳
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activePanel === "settings" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">城市等級</label>
                        <select
                          value={cityLevel}
                          onChange={(e) => setCityLevel(parseInt(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                        >
                          {CITY_LEVELS.map((level) => (
                            <option key={level.level} value={level.level}>
                              Lv.{level.level} - {level.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">金幣</label>
                        <input
                          type="number"
                          value={coins}
                          onChange={(e) => setCoins(parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                        />
                      </div>
                    </div>
                  )}

                  {activePanel === "templates" && (
                    <CityTemplateManager
                      currentBuildings={buildings}
                      currentDecorations={decorations}
                      currentCityLevel={cityLevel}
                      onApplyTemplate={handleApplyTemplate}
                    />
                  )}

                  {activePanel === "style" && (
                    <div className="space-y-6">
                      {/* Default User City Configuration */}
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                        <h3 className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          預設使用者城市配置
                        </h3>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">初始城市等級</label>
                            <select
                              value={defaultCityLevel}
                              onChange={(e) => setDefaultCityLevel(parseInt(e.target.value))}
                              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                            >
                              {CITY_LEVELS.map((level) => (
                                <option key={level.level} value={level.level}>
                                  Lv.{level.level} - {level.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs text-slate-400 mb-1">初始城市金幣</label>
                            <input
                              type="number"
                              value={defaultCityCoins}
                              onChange={(e) => setDefaultCityCoins(parseInt(e.target.value) || 0)}
                              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                              min={0}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <button
                              onClick={() => handleSaveCurrentAsDefault("buildings")}
                              disabled={!selectedUserId}
                              className="px-2 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition-colors disabled:opacity-50"
                            >
                              使用當前建築
                            </button>
                            <button
                              onClick={() => handleSaveCurrentAsDefault("decorations")}
                              disabled={!selectedUserId}
                              className="px-2 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition-colors disabled:opacity-50"
                            >
                              使用當前裝飾
                            </button>
                          </div>

                          <button
                            onClick={handleSaveDefaultSettings}
                            disabled={isSavingDefaults}
                            className="w-full mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                          >
                            {isSavingDefaults ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            儲存預設設定
                          </button>
                        </div>
                      </div>

                      {/* Asset Upload Section */}
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                        <h3 className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-2">
                          <Upload className="w-4 h-4" />
                          城市元素圖片上傳
                        </h3>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">資源類型</label>
                            <div className="flex flex-wrap gap-2">
                              {(Object.keys(ASSET_TYPE_LABELS) as CityAssetType[]).map((type) => (
                                <button
                                  key={type}
                                  onClick={() => setUploadAssetType(type)}
                                  className={`px-3 py-1.5 rounded text-xs transition-colors ${
                                    uploadAssetType === type
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                  }`}
                                >
                                  {ASSET_TYPE_LABELS[type]}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs text-slate-400 mb-1">名稱</label>
                            <input
                              type="text"
                              value={uploadAssetName}
                              onChange={(e) => setUploadAssetName(e.target.value)}
                              placeholder="輸入資源名稱..."
                              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder:text-slate-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-slate-400 mb-1">圖片 (PNG/SVG)</label>
                            <label className="block w-full p-4 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-slate-500 transition-colors">
                              <input
                                type="file"
                                accept=".png,.svg,image/png,image/svg+xml"
                                onChange={handleFileSelect}
                                className="hidden"
                              />
                              {uploadPreview ? (
                                <div className="flex items-center gap-3">
                                  <img
                                    src={uploadPreview}
                                    alt="Preview"
                                    className="w-16 h-16 object-contain bg-slate-900 rounded"
                                  />
                                  <span className="text-sm text-slate-300">{uploadFile?.name}</span>
                                </div>
                              ) : (
                                <div className="text-center text-slate-400 text-sm">
                                  <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                  點擊或拖放上傳
                                </div>
                              )}
                            </label>

                            {/* Background Removal Button */}
                            {uploadPreview && uploadFile?.type === "image/png" && (
                              <button
                                type="button"
                                onClick={() => setShowBgRemoval(true)}
                                className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg text-sm transition-colors w-fit"
                              >
                                <Wand2 className="w-4 h-4" />
                                去背
                              </button>
                            )}
                          </div>

                          <button
                            onClick={handleAssetUpload}
                            disabled={isUploading || !uploadFile || !uploadAssetName.trim()}
                            className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            上傳並新增
                          </button>
                        </div>
                      </div>

                      {/* Uploaded Assets List */}
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                        <h3 className="text-sm font-medium text-slate-200 mb-3">
                          已上傳資源 ({styleAssets.length})
                        </h3>
                        
                        {isLoadingAssets ? (
                          <div className="text-center py-4 text-slate-400">
                            <Loader2 className="w-6 h-6 mx-auto animate-spin" />
                          </div>
                        ) : styleAssets.length === 0 ? (
                          <div className="text-center py-4 text-slate-400 text-sm">
                            尚無已上傳的資源
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                            {styleAssets.map((asset) => (
                              <div
                                key={asset.id}
                                className="relative group bg-slate-700 rounded-lg p-2 text-center"
                              >
                                <img
                                  src={asset.image_url}
                                  alt={asset.name}
                                  className="w-full h-12 object-contain mb-1"
                                />
                                <div className="text-xs text-slate-300 truncate">{asset.name}</div>
                                <div className="text-xs text-slate-500">{ASSET_TYPE_LABELS[asset.asset_type as CityAssetType]}</div>
                                <button
                                  onClick={() => handleDeleteAsset(asset)}
                                  className="absolute top-1 right-1 p-1 bg-red-600/80 hover:bg-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-3 h-3 text-white" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-4 text-center text-slate-400">
                請先選擇用戶
              </div>
            )}
          </aside>

          {/* Map Area */}
          <main className="flex-1 overflow-hidden bg-slate-950/50">
            {selectedUserId ? (
              isLoading ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                  載入中...
                </div>
              ) : error ? (
                <div className="h-full flex items-center justify-center text-red-400">
                  {error}
                </div>
              ) : (
                <AdminCityMap
                  buildings={buildings}
                  decorations={decorations}
                  cityLevel={cityLevel}
                  selectedBuildingId={selectedBuildingId}
                  selectedDecorationId={selectedDecorationId}
                  onBuildingClick={handleBuildingClick}
                  onDecorationClick={handleDecorationClick}
                  onBuildingDrag={handleBuildingDrag}
                  onDecorationDrag={handleDecorationDrag}
                />
              )
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                選擇用戶以編輯城市
              </div>
            )}
          </main>
        </div>

        {/* Background Removal Editor Modal */}
        {showBgRemoval && uploadPreview && (
          <BackgroundRemovalEditor
            imageUrl={uploadPreview}
            isOpen={showBgRemoval}
            onClose={() => setShowBgRemoval(false)}
            onApply={handleBgRemovalApply}
          />
        )}

        {/* City Transform Panel Modal */}
        {showTransformPanel && transformTarget && (
          <CityTransformPanel
            isOpen={showTransformPanel}
            onClose={() => {
              setShowTransformPanel(false);
              setTransformTarget(null);
            }}
            initialTransform={
              transformTarget.type === 'building'
                ? buildings.find(b => b.id === transformTarget.id)?.transform
                : decorations.find(d => d.id === transformTarget.id)?.transform
            }
            itemName={
              transformTarget.type === 'building'
                ? buildings.find(b => b.id === transformTarget.id)?.name || '建築物'
                : DECORATION_LABELS[decorations.find(d => d.id === transformTarget.id)?.type || 'tree']
            }
            customImageUrl={
              transformTarget.type === 'building'
                ? buildings.find(b => b.id === transformTarget.id)?.customImageUrl
                : decorations.find(d => d.id === transformTarget.id)?.customImageUrl
            }
            onApply={handleTransformApply}
          />
        )}
      </div>
    </div>
  );
};
