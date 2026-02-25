import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapEditorShell } from "@/components/map-editor/MapEditorShell";
import { EditorTab } from "@/components/map-editor/types";
import {
    Building2,
    Trees,
    Settings,
    FileJson,
    Image,
    Map,
    Users,
    RotateCcw,
    Trash2,
    Coins,
    ChevronDown,
    ChevronUp,
    Palette
} from "lucide-react";

// City imports
import { useAdminCityLayout } from "@/hooks/useAdminCityLayout";
import { AdminCityMap } from "@/components/city/AdminCityMap";
import { CityTemplateManager } from "@/components/admin/CityTemplateManager";
import { BuildingStyleEditor } from "./BuildingStyleEditor";
import { FacilityStyleEditor } from "./FacilityStyleEditor";
import { SYSTEM_DEFAULT_USER_ID } from "@/constants/adminDefaults";
import { BUILDING_CATALOG } from "@/constants/cityLevels";
import type { CityDecoration } from "@/types/city";

// District imports
import { useAdminRegionLayout } from "@/hooks/useAdminRegionLayout";
import { AssetUploader } from "./AssetUploader";
import { AdminRegionMap } from "@/components/region/AdminRegionMap";
import { DEFAULT_FACILITY_CONFIGS } from "@/constants/regionConfig";
import type { Region, FacilityType } from "@/types/region";
import { FACILITY_DISPLAY_INFO } from "@/types/region";

interface UnifiedMapEditorProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: "city" | "district";
}

type EditorMode = "city" | "district";

interface UserOption {
    id: string;
    display_name: string | null;
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

const CITY_TABS: EditorTab[] = [
    { id: "buildings", label: "建築", icon: Building2 },
    { id: "decorations", label: "裝飾", icon: Trees },
    { id: "settings", label: "設定", icon: Settings },
    { id: "templates", label: "模板", icon: FileJson },
    { id: "style", label: "風格", icon: Image },
];

const DISTRICT_TABS: EditorTab[] = [
    { id: "facilities", label: "設施", icon: Building2 },
    { id: "assets", label: "地圖", icon: Image },
    { id: "settings", label: "設定", icon: Settings },
    { id: "regions", label: "地區", icon: Map },
];

export const UnifiedMapEditor: React.FC<UnifiedMapEditorProps> = ({
    isOpen,
    onClose,
    initialMode = "city"
}) => {
    // Mode state
    const [mode, setMode] = useState<EditorMode>(initialMode);
    const [activeTab, setActiveTab] = useState(mode === "city" ? "buildings" : "facilities");

    // Common selection state
    const [users, setUsers] = useState<UserOption[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(SYSTEM_DEFAULT_USER_ID);
    const [regions, setRegions] = useState<Region[]>([]);
    const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

    // --- City Editor State ---
    const cityEditor = useAdminCityLayout();
    const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
    const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(null);
    const [showBuildingList, setShowBuildingList] = useState(true);
    const [showDecorationList, setShowDecorationList] = useState(true);

    // --- District Editor State ---
    const districtEditor = useAdminRegionLayout();
    const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
    const [facilitySearch, setFacilitySearch] = useState("");
    const [selectedFacilityTab, setSelectedFacilityTab] = useState<FacilityType | "all">("all");

    // Fetch users for city mode
    useEffect(() => {
        if (!isOpen || mode !== "city") return;

        const fetchUsers = async () => {
            try {
                const { data, error } = await supabase
                    .from("user_profiles")
                    .select("id, display_name")
                    .order("created_at", { ascending: false });

                if (error) {
                    console.error("Error fetching users:", error);
                    return;
                }

                const userOptions = (data || []).map((u) => ({
                    id: u.id,
                    display_name: u.display_name,
                }));
                setUsers(userOptions);
            } catch (err) {
                console.error("Error in fetchUsers:", err);
            }
        };

        fetchUsers();
    }, [isOpen, mode]);

    // Fetch regions for district mode
    useEffect(() => {
        if (!isOpen || mode !== "district") return;

        const fetchRegions = async () => {
            try {
                const { data, error } = await supabase
                    .from("regions")
                    .select("*")
                    .order("created_at", { ascending: false });

                if (error) {
                    console.error("Error fetching regions:", error);
                    return;
                }

                const regionData = (data || []).map(r => ({
                    id: r.id,
                    name: r.name,
                    gridSize: r.grid_size,
                    theme: r.theme as any,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at
                }));

                setRegions(regionData);

                if (regionData.length > 0 && !selectedRegionId) {
                    setSelectedRegionId(regionData[0].id);
                }
            } catch (err) {
                console.error("Error in fetchRegions:", err);
            }
        };

        fetchRegions();
    }, [isOpen, mode]);

    // Load city data when selected user changes
    useEffect(() => {
        if (mode === "city" && selectedUserId) {
            cityEditor.loadUserLayout(selectedUserId);
        }
    }, [selectedUserId, mode, cityEditor.loadUserLayout]);

    // Load region data when selected region changes
    useEffect(() => {
        if (mode === "district" && selectedRegionId) {
            districtEditor.loadRegion(selectedRegionId);
        }
    }, [selectedRegionId, mode, districtEditor.loadRegion]);

    // Handle mode switch
    const handleModeSwitch = (newMode: EditorMode) => {
        setMode(newMode);
        setActiveTab(newMode === "city" ? "buildings" : "facilities");
    };

    // Helper variables for Shell
    const tabs = mode === "city" ? CITY_TABS : DISTRICT_TABS;

    const handleSave = async () => {
        setSaveStatus("saving");
        try {
            let success = false;
            if (mode === "city" && selectedUserId) {
                success = await cityEditor.saveLayout(selectedUserId);
            } else if (mode === "district" && selectedRegionId) {
                success = await districtEditor.saveRegion(selectedRegionId);
            }

            if (success) {
                setSaveStatus("saved");
                setTimeout(() => setSaveStatus("idle"), 2000);
            } else {
                setSaveStatus("error");
            }
        } catch (err) {
            console.error("Save failed", err);
            setSaveStatus("error");
        }
    };

    // Handle Reset
    const handleReset = () => {
        if (!window.confirm("確定要重置所有更改嗎？")) return;
        if (mode === "city") {
            cityEditor.resetToDefault();
        } else if (selectedRegionId) {
            districtEditor.resetToDefault(selectedRegionId);
        }
    };

    // Header Actions JSX
    const headerActions = (
        <div className="flex items-center gap-4">
            <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700/50 shadow-inner">
                <button
                    onClick={() => handleModeSwitch("city")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === "city"
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                        }`}
                >
                    城市編輯
                </button>
                <button
                    onClick={() => handleModeSwitch("district")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === "district"
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                        }`}
                >
                    地區編輯
                </button>
            </div>

            {mode === "city" ? (
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    <select
                        value={selectedUserId || ""}
                        onChange={(e) => setSelectedUserId(e.target.value || null)}
                        className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm min-w-[200px] text-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    >
                        <option value="">選擇用戶...</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.display_name || u.id}</option>
                        ))}
                    </select>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <Map className="w-4 h-4 text-slate-400" />
                    <select
                        value={selectedRegionId || ""}
                        onChange={(e) => setSelectedRegionId(e.target.value || null)}
                        className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm min-w-[200px] text-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    >
                        <option value="">選擇地區...</option>
                        {regions.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );

    // --- City Render Functions ---
    const renderBuildingsPanel = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-500" />
                    已放置建築 ({cityEditor.buildings.length})
                </h3>
                <button
                    onClick={() => setShowBuildingList(!showBuildingList)}
                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                >
                    {showBuildingList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
            </div>

            {showBuildingList && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {cityEditor.buildings.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">尚無建築</p>
                    ) : (
                        cityEditor.buildings.map((b) => (
                            <div
                                key={b.id}
                                className={`group p-3 rounded-lg border transition-all cursor-pointer ${selectedBuildingId === b.id
                                    ? "bg-emerald-600/20 border-emerald-500/50"
                                    : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
                                    }`}
                                onClick={() => setSelectedBuildingId(b.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                            {b.customImageUrl ? (
                                                <img src={b.customImageUrl} alt={b.name} className="w-full h-full object-contain" />
                                            ) : (
                                                <Building2 className="w-5 h-5 text-slate-500" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                                                {b.name}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                Lvl {b.level || 1} • {b.type}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            cityEditor.removeBuilding(b.id);
                                        }}
                                        className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            <div className="pt-4 border-t border-slate-700/50">
                <h3 className="text-sm font-bold text-slate-400 mb-4 px-1">新增建築</h3>
                <div className="grid grid-cols-2 gap-2">
                    {BUILDING_CATALOG.map((tpl) => (
                        <button
                            key={tpl.id}
                            onClick={() => cityEditor.addBuilding({
                                name: tpl.name,
                                type: tpl.type,
                                level: 1,
                                position: { x: 4, y: 4 },
                                size: tpl.size,
                                exteriorStyle: tpl.defaultStyle,
                                isUnlocked: true
                            })}
                            className="flex flex-col items-center gap-2 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:bg-slate-700/50 hover:border-emerald-500/30 transition-all group"
                        >
                            <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center p-1 group-hover:scale-110 transition-transform">
                                <Building2 className="w-6 h-6 text-slate-500" />
                            </div>
                            <span className="text-[10px] text-slate-300 font-medium">{tpl.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Selected Building Style Editor */}
            {selectedBuildingId && cityEditor.buildings.find(b => b.id === selectedBuildingId) && (
                <div className="pt-6 border-t border-slate-700/50 mt-6">
                    <h3 className="text-sm font-bold text-emerald-400 mb-4 px-1 flex items-center gap-2">
                        <Palette className="w-4 h-4" />
                        建築樣式自訂
                    </h3>
                    <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                        <BuildingStyleEditor
                            building={cityEditor.buildings.find(b => b.id === selectedBuildingId)!}
                            onUpdate={cityEditor.updateBuilding}
                        />
                    </div>
                </div>
            )}
        </div>
    );

    const renderDecorationsPanel = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                    <Trees className="w-4 h-4 text-emerald-500" />
                    已放置裝飾 ({cityEditor.decorations.length})
                </h3>
                <button
                    onClick={() => setShowDecorationList(!showDecorationList)}
                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                >
                    {showDecorationList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
            </div>

            {showDecorationList && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {cityEditor.decorations.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">尚無裝飾</p>
                    ) : (
                        cityEditor.decorations.map((d) => (
                            <div
                                key={d.id}
                                className={`group p-3 rounded-lg border transition-all cursor-pointer ${selectedDecorationId === d.id
                                    ? "bg-emerald-600/20 border-emerald-500/50"
                                    : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
                                    }`}
                                onClick={() => setSelectedDecorationId(d.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                            {d.customImageUrl ? (
                                                <img src={d.customImageUrl} alt={d.type} className="w-full h-full object-contain" />
                                            ) : (
                                                <Trees className="w-5 h-5 text-slate-500" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                                                {DECORATION_LABELS[d.type]}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                ID: {d.id.slice(0, 8)}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            cityEditor.removeDecoration(d.id);
                                        }}
                                        className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            <div className="pt-4 border-t border-slate-700/50">
                <h3 className="text-sm font-bold text-slate-400 mb-4 px-1">新增裝飾</h3>
                <div className="grid grid-cols-3 gap-2">
                    {DECORATION_TYPES.map((type) => (
                        <button
                            key={type}
                            onClick={() => cityEditor.addDecoration({
                                type,
                                position: { x: 4, y: 4 }
                            })}
                            className="flex flex-col items-center gap-1 p-2 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:bg-slate-700/50 hover:border-emerald-500/30 transition-all group"
                        >
                            <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Trees className="w-5 h-5 text-slate-500" />
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium truncate w-full text-center">
                                {DECORATION_LABELS[type]}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderSettingsPanel = () => (
        <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold mb-2">
                    <Settings className="w-4 h-4 text-emerald-500" />
                    城市參數設定
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">城市等級</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="0"
                                max="10"
                                value={cityEditor.cityLevel}
                                onChange={(e) => cityEditor.setCityLevel(parseInt(e.target.value))}
                                className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <span className="text-lg font-bold text-emerald-400 min-w-[1.5rem] text-center">
                                {cityEditor.cityLevel}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">城市金幣</label>
                        <div className="relative">
                            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
                            <input
                                type="number"
                                value={cityEditor.coins}
                                onChange={(e) => cityEditor.setCoins(parseInt(e.target.value) || 0)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white font-bold focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold mb-2">
                    <div className="bg-amber-500/20 p-1 rounded">
                        <RotateCcw className="w-4 h-4 text-amber-500" />
                    </div>
                    資料管理
                </div>
                <div className="grid grid-cols-1 gap-2">
                    <button
                        onClick={handleReset}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 rounded-lg text-sm font-medium border border-amber-600/20 transition-all"
                    >
                        <RotateCcw className="w-4 h-4" />
                        重置到預設佈局
                    </button>
                    <button
                        onClick={() => {
                            if (window.confirm("確定要刪除所有放置的物件嗎？")) {
                                cityEditor.setBuildings([]);
                                cityEditor.setDecorations([]);
                            }
                        }}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-sm font-medium border border-red-600/20 transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                        清空所有物件
                    </button>
                </div>
            </div>
        </div>
    );

    const renderTemplatesPanel = () => (
        <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-white font-bold mb-4">
                    <FileJson className="w-4 h-4 text-emerald-500" />
                    模板管理系統
                </div>
                <CityTemplateManager
                    onApplyTemplate={(template) => {
                        cityEditor.setBuildings(template.buildings);
                        cityEditor.setDecorations(template.decorations);
                        cityEditor.setCityLevel(template.cityLevel || 0);
                    }}
                    buildings={cityEditor.buildings}
                    decorations={cityEditor.decorations}
                    cityLevel={cityEditor.cityLevel}
                />
            </div>
        </div>
    );

    const renderStylePanel = () => (
        <div className="p-4 text-center text-slate-500">
            風格編輯器開發中...
        </div>
    );

    // --- District Render Functions ---
    const renderFacilitiesPanel = () => (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="relative">
                    <Map className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="搜尋設施..."
                        value={facilitySearch}
                        onChange={(e) => setFacilitySearch(e.target.value)}
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    />
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {(["all", "park", "school", "library"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setSelectedFacilityTab(t)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedFacilityTab === t
                                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                                : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                                }`}
                        >
                            {t === "all" ? "全部" : FACILITY_DISPLAY_INFO[t as FacilityType]?.label || t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {(Object.entries(FACILITY_DISPLAY_INFO) as [FacilityType, any][])
                    .filter(([_, info]) => selectedFacilityTab === "all" || info.type === selectedFacilityTab)
                    .filter(([_, info]) => info.label.includes(facilitySearch))
                    .map(([type, info]) => (
                        <button
                            key={type}
                            onClick={() => {
                                districtEditor.addFacility({
                                    name: info.label,
                                    facilityType: type,
                                    plotId: null,
                                    position: { x: 50, y: 50 },
                                    config: DEFAULT_FACILITY_CONFIGS[type] || {}
                                });
                            }}
                            className="flex flex-col items-center gap-2 p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:bg-slate-700/50 hover:border-emerald-500/30 transition-all group"
                        >
                            <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center p-1 group-hover:scale-110 transition-transform">
                                <span className="text-2xl">{info.icon}</span>
                            </div>
                            <span className="text-xs text-slate-300 font-medium">{info.label}</span>
                        </button>
                    ))}
            </div>

            <div className="pt-4 border-t border-slate-700/50">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">已放置設施</h3>
                <div className="space-y-2">
                    {(!districtEditor.region || districtEditor.region.facilities.length === 0) ? (
                        <p className="text-xs text-slate-500 text-center py-8">尚無放置設施</p>
                    ) : (
                        districtEditor.region.facilities.map((f) => (
                            <div
                                key={f.id}
                                className={`group p-3 rounded-lg border transition-all cursor-pointer ${selectedFacilityId === f.id
                                    ? "bg-emerald-600/20 border-emerald-500/50"
                                    : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
                                    }`}
                                onClick={() => setSelectedFacilityId(f.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center shrink-0">
                                            <Building2 className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{f.name}</div>
                                            <div className="text-[10px] text-slate-500">{f.facilityType} • Lvl {f.level}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            districtEditor.removeFacility(f.id);
                                        }}
                                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 rounded transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Selected Facility Style Editor */}
            {selectedFacilityId && districtEditor.region?.facilities.find(f => f.id === selectedFacilityId) && (
                <div className="pt-6 border-t border-slate-700/50 mt-6">
                    <h3 className="text-sm font-bold text-emerald-400 mb-4 px-1 flex items-center gap-2">
                        <Palette className="w-4 h-4" />
                        設施樣式自訂
                    </h3>
                    <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                        <FacilityStyleEditor
                            facility={districtEditor.region.facilities.find(f => f.id === selectedFacilityId)!}
                            onUpdate={districtEditor.updateFacility}
                        />
                    </div>
                </div>
            )}
        </div>
    );

    const renderDistrictSettingsPanel = () => (
        <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold mb-2">
                    <Settings className="w-4 h-4 text-emerald-500" />
                    地區核心設定
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">地區名稱</label>
                        <input
                            type="text"
                            value={districtEditor.region?.name || ""}
                            onChange={(e) => districtEditor.updateRegion({ name: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white font-bold focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">地圖尺寸</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="1000"
                                max="5000"
                                step="500"
                                value={districtEditor.region?.gridSize || 2000}
                                onChange={(e) => districtEditor.updateRegion({ gridSize: parseInt(e.target.value) })}
                                className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <span className="text-sm font-bold text-emerald-400 min-w-[3rem] text-right">
                                {districtEditor.region?.gridSize}px
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">主題風格</label>
                        <select
                            value={districtEditor.region?.theme || "modern"}
                            onChange={(e) => districtEditor.updateRegion({ theme: e.target.value as any })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm outline-none"
                        >
                            <option value="modern">現代都市</option>
                            <option value="classic">古典風格</option>
                            <option value="nature">自然生態</option>
                            <option value="cyber">科技未來</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold mb-2">
                    <div className="bg-amber-500/20 p-1 rounded">
                        <RotateCcw className="w-4 h-4 text-amber-500" />
                    </div>
                    資料管理
                </div>
                <button
                    onClick={handleReset}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 rounded-lg text-sm font-medium border border-amber-600/20 transition-all"
                >
                    <RotateCcw className="w-4 h-4" />
                    重置此地區資料
                </button>
            </div>
        </div>
    );

    // Sidebar Content Router
    const getSidebarContent = () => {
        if (mode === "city") {
            if (!selectedUserId) return <div className="p-8 text-center text-slate-500">請先選擇一個用戶進行編輯</div>;
            return (
                <div className="p-4">
                    {activeTab === "buildings" && renderBuildingsPanel()}
                    {activeTab === "decorations" && renderDecorationsPanel()}
                    {activeTab === "settings" && renderSettingsPanel()}
                    {activeTab === "templates" && renderTemplatesPanel()}
                    {activeTab === "style" && renderStylePanel()}
                </div>
            );
        } else {
            if (!selectedRegionId) return <div className="p-8 text-center text-slate-500">請先選擇一個地區進行編輯</div>;
            return (
                <div className="p-4">
                    {activeTab === "facilities" && renderFacilitiesPanel()}
                    {activeTab === "assets" && (
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-white font-bold mb-4">
                                <Image className="w-4 h-4 text-emerald-500" />
                                素材上傳系統
                            </div>
                            <AssetUploader onUploadComplete={() => { }} />
                        </div>
                    )}
                    {activeTab === "settings" && renderDistrictSettingsPanel()}
                    {activeTab === "regions" && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-400 px-1">所有地區清單</h3>
                            <div className="space-y-2">
                                {regions.map((r) => (
                                    <button
                                        key={r.id}
                                        onClick={() => setSelectedRegionId(r.id)}
                                        className={`w-full text-left p-3 rounded-lg border transition-all ${selectedRegionId === r.id
                                            ? "bg-emerald-600/20 border-emerald-500/50 text-white"
                                            : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-white"
                                            }`}
                                    >
                                        <div className="font-bold">{r.name}</div>
                                        <div className="text-[10px] opacity-60">ID: {r.id}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }
    };

    // Map content
    const mapContent = mode === "city" ? (
        selectedUserId && !cityEditor.isLoading ? (
            <AdminCityMap
                buildings={cityEditor.buildings}
                decorations={cityEditor.decorations}
                cityLevel={cityEditor.cityLevel}
                zoom={cityEditor.cameraSettings.zoom}
                cameraOffset={cityEditor.cameraSettings.offset}
                selectedBuildingId={null}
                selectedDecorationId={null}
                onBuildingClick={() => { }}
                onDecorationClick={() => { }}
                onBuildingDrag={(id, pos) => cityEditor.updateBuilding(id, { position: pos })}
                onDecorationDrag={(id, pos) => cityEditor.updateDecoration(id, { position: pos })}
                onViewStateChange={(state) => {
                    if (state.zoom !== undefined || state.cameraOffset !== undefined) {
                        cityEditor.setCameraSettings({
                            zoom: state.zoom ?? cityEditor.cameraSettings.zoom,
                            offset: state.cameraOffset ?? cityEditor.cameraSettings.offset,
                        });
                    }
                }}
            />
        ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
                {cityEditor.isLoading ? "載入中..." : "選擇用戶以編輯城市"}
            </div>
        )
    ) : (
        selectedRegionId && !districtEditor.loading && districtEditor.region ? (
            <AdminRegionMap
                region={districtEditor.region}
                selectedFacilityId={selectedFacilityId}
                onFacilityClick={(f) => setSelectedFacilityId(f.id)}
                onFacilityDrag={(id, pos) => districtEditor.updateFacility(id, { position: pos })}
                onPlotClick={() => { }}
            />
        ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
                {districtEditor.loading ? "載入中..." : "選擇地區以編輯"}
            </div>
        )
    );

    if (!isOpen) return null;

    return (
        <MapEditorShell
            title="地圖編輯器"
            isOpen={isOpen}
            onClose={onClose}
            headerActions={headerActions}
            saveStatus={saveStatus}
            onSave={handleSave}
            tabs={tabs}
            activeTabId={activeTab}
            onTabChange={setActiveTab}
            sidebarContent={getSidebarContent()}
        >
            {mapContent}
        </MapEditorShell>
    );
};
