import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRegionLayout } from "@/hooks/useAdminRegionLayout";
import { AssetUploader } from "./AssetUploader";
import { AdminRegionMap } from "@/components/region/AdminRegionMap";
import { DEFAULT_FACILITY_CONFIGS } from "@/constants/regionConfig";
import type { Region, FacilityType, RegionTheme } from "@/types/region";
import type { CityStyleAsset } from "@/types/city";
import {
    Map,
    Save,
    RotateCcw,
    Trash2,
    Building2,
    Plus,
    Settings,
    X,
    ChevronDown,
    ChevronUp,
    MapPin,
    Palette,
    Layout,
    Image as ImageIcon,
} from "lucide-react";

interface DistrictEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const THEMES: RegionTheme[] = ['countryside', 'suburban', 'urban'];

export const DistrictEditorModal: React.FC<DistrictEditorModalProps> = ({ isOpen, onClose }) => {
    const [regions, setRegions] = useState<Region[]>([]);
    const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
    const [isLoadingRegions, setIsLoadingRegions] = useState(true);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [activePanel, setActivePanel] = useState<"facilities" | "settings" | "regions" | "assets">("facilities");
    const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
    const [showFacilityList, setShowFacilityList] = useState(true);
    const [mapAssets, setMapAssets] = useState<CityStyleAsset[]>([]);
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

    const {
        region,
        loading: isLoading,
        error,
        addFacility,
        updateFacility,
        removeFacility,
        updateRegion,
        saveRegion,
        loadRegion,
        resetToDefault,
        addMapElement,
        removeMapElement,
    } = useAdminRegionLayout();

    // Fetch regions on open
    useEffect(() => {
        if (!isOpen) return;

        const fetchRegions = async () => {
            setIsLoadingRegions(true);
            try {
                const { data, error } = await supabase
                    .from("regions")
                    .select("*")
                    .order("created_at", { ascending: false });

                if (error) {
                    console.error("Error fetching regions:", error);
                    return;
                }

                setRegions((data || []).map(r => ({
                    id: r.id,
                    name: r.name,
                    gridSize: r.grid_size,
                    theme: r.theme as RegionTheme,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at
                })));

                if (data && data.length > 0 && !selectedRegionId) {
                    setSelectedRegionId(data[0].id);
                }
            } catch (err) {
                console.error("Error in fetchRegions:", err);
            } finally {
                setIsLoadingRegions(false);
            }
        };

        fetchRegions();
    }, [isOpen]);

    useEffect(() => {
        if (selectedRegionId) {
            loadRegion(selectedRegionId);
        }
    }, [selectedRegionId, loadRegion]);

    const handleSave = async () => {
        if (!selectedRegionId) return;

        setSaveStatus("saving");
        const success = await saveRegion(selectedRegionId);
        setSaveStatus(success ? "saved" : "error");

        if (success) {
            setTimeout(() => setSaveStatus("idle"), 2000);
        }
    };

    // Fetch assets when panel is active
    useEffect(() => {
        if (activePanel === "assets" && isOpen) {
            const fetchAssets = async () => {
                const { data } = await supabase
                    .from("city_style_assets")
                    .select("*")
                    .eq("asset_type", "map_element")
                    .order("created_at", { ascending: false });

                if (data) {
                    setMapAssets(data as any);
                }
            };
            fetchAssets();
        }
    }, [activePanel, isOpen]);

    const handleReset = () => {
        if (selectedRegionId && window.confirm("確定要重置地區設施嗎？")) {
            resetToDefault(selectedRegionId);
        }
    };

    const handleAddFacility = (type: FacilityType) => {
        const config = DEFAULT_FACILITY_CONFIGS[type];
        addFacility({
            plotId: null,
            facilityType: type,
            name: `新${type}`,
            position: { x: 5, y: 5 },
            config: config || {}
        });
    };

    const handleFacilityDrag = (id: string, newPosition: { x: number; y: number }) => {
        updateFacility(id, { position: newPosition });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative w-[95vw] h-[90vh] max-w-[1600px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="border-b border-slate-700/50 bg-slate-900/80 px-4 py-3 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <Layout className="w-6 h-6 text-emerald-500" />
                        <h1 className="text-xl font-bold text-white">地區編輯器</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Region Selector */}
                        <div className="flex items-center gap-2">
                            <Map className="w-4 h-4 text-slate-400" />
                            <select
                                value={selectedRegionId || ""}
                                onChange={(e) => setSelectedRegionId(e.target.value || null)}
                                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm min-w-[200px] text-white"
                                disabled={isLoadingRegions}
                            >
                                <option value="">選擇地區...</option>
                                {regions.map((r) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>

                        {selectedRegionId && (
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

                        <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar */}
                    <aside className="w-72 border-r border-slate-700/50 bg-slate-900/50 overflow-y-auto shrink-0">
                        {selectedRegionId && region ? (
                            <>
                                {/* Panel Tabs */}
                                <div className="flex border-b border-slate-700/50">
                                    <button
                                        onClick={() => setActivePanel("facilities")}
                                        className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${activePanel === "facilities" ? "bg-slate-800 text-white border-b-2 border-emerald-500" : "text-slate-400 hover:text-white"
                                            }`}
                                    >
                                        <Building2 className="w-4 h-4 inline mr-1" />
                                        設施
                                    </button>
                                    <button
                                        onClick={() => setActivePanel("assets")}
                                        className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${activePanel === "assets" ? "bg-slate-800 text-white border-b-2 border-emerald-500" : "text-slate-400 hover:text-white"
                                            }`}
                                    >
                                        <ImageIcon className="w-4 h-4 inline mr-1" />
                                        地圖
                                    </button>
                                    <button
                                        onClick={() => setActivePanel("settings")}
                                        className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${activePanel === "settings" ? "bg-slate-800 text-white border-b-2 border-emerald-500" : "text-slate-400 hover:text-white"
                                            }`}
                                    >
                                        <Settings className="w-4 h-4 inline mr-1" />
                                        設定
                                    </button>
                                    <button
                                        onClick={() => setActivePanel("regions")}
                                        className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${activePanel === "regions" ? "bg-slate-800 text-white border-b-2 border-emerald-500" : "text-slate-400 hover:text-white"
                                            }`}
                                    >
                                        <Map className="w-4 h-4 inline mr-1" />
                                        地區
                                    </button>
                                </div>

                                {/* Panel Content */}
                                <div className="p-4">
                                    {activePanel === "facilities" && (
                                        <div className="space-y-4">
                                            <div>
                                                <h3 className="text-sm font-medium text-slate-300 mb-2">添加公共設施</h3>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {(Object.keys(DEFAULT_FACILITY_CONFIGS) as FacilityType[]).map((type) => (
                                                        <button
                                                            key={type}
                                                            onClick={() => handleAddFacility(type)}
                                                            className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs flex flex-col items-center gap-1 transition-colors"
                                                        >
                                                            <Plus className="w-4 h-4 text-emerald-400" />
                                                            <span className="capitalize">{type.replace('_', ' ')}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <button
                                                    onClick={() => setShowFacilityList(!showFacilityList)}
                                                    className="flex items-center justify-between w-full text-sm font-medium text-slate-300 mb-2"
                                                >
                                                    <span>現有設施 ({region.facilities.length})</span>
                                                    {showFacilityList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                                {showFacilityList && (
                                                    <div className="space-y-2">
                                                        {region.facilities.map((fac) => (
                                                            <div
                                                                key={fac.id}
                                                                className={`p-3 rounded-lg transition-colors cursor-pointer ${selectedFacilityId === fac.id ? "bg-emerald-600/20 border border-emerald-500/50" : "bg-slate-800 hover:bg-slate-700"
                                                                    }`}
                                                                onClick={() => setSelectedFacilityId(fac.id)}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <div className="font-medium text-sm text-white">{fac.name}</div>
                                                                        <div className="text-xs text-slate-400">
                                                                            <MapPin className="w-3 h-3 inline mr-1" />
                                                                            ({fac.position.x}, {fac.position.y})
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (window.confirm(`確定要刪除 "${fac.name}" 嗎？`)) {
                                                                                removeFacility(fac.id);
                                                                                if (selectedFacilityId === fac.id) setSelectedFacilityId(null);
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

                                            {selectedFacilityId && region.facilities.find(f => f.id === selectedFacilityId) && (
                                                <div className="border-t border-slate-700 pt-4">
                                                    <h3 className="text-sm font-medium text-slate-300 mb-3">編輯設施</h3>
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="block text-xs text-slate-400 mb-1">名稱</label>
                                                            <input
                                                                type="text"
                                                                value={region.facilities.find(f => f.id === selectedFacilityId)?.name || ''}
                                                                onChange={(e) => updateFacility(selectedFacilityId, { name: e.target.value })}
                                                                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-xs text-slate-400 mb-1">X 位置</label>
                                                                <input
                                                                    type="number"
                                                                    value={region.facilities.find(f => f.id === selectedFacilityId)?.position.x || 0}
                                                                    onChange={(e) => updateFacility(selectedFacilityId, { position: { ...region.facilities.find(f => f.id === selectedFacilityId)!.position, x: parseInt(e.target.value) || 0 } })}
                                                                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-slate-400 mb-1">Y 位置</label>
                                                                <input
                                                                    type="number"
                                                                    value={region.facilities.find(f => f.id === selectedFacilityId)?.position.y || 0}
                                                                    onChange={(e) => updateFacility(selectedFacilityId, { position: { ...region.facilities.find(f => f.id === selectedFacilityId)!.position, y: parseInt(e.target.value) || 0 } })}
                                                                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activePanel === "settings" && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1 font-bold uppercase tracking-tight">地區名稱</label>
                                                <input
                                                    type="text"
                                                    value={region.name}
                                                    onChange={(e) => updateRegion({ name: e.target.value })}
                                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1 font-bold uppercase tracking-tight">網格大小</label>
                                                <input
                                                    type="number"
                                                    value={region.gridSize}
                                                    onChange={(e) => updateRegion({ gridSize: parseInt(e.target.value) || 0 })}
                                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-2 font-bold uppercase tracking-tight">地區主題</label>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {THEMES.map(t => (
                                                        <button
                                                            key={t}
                                                            onClick={() => updateRegion({ theme: t })}
                                                            className={`px-3 py-2 rounded-lg text-sm text-left transition-colors flex items-center justify-between ${region.theme === t ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                                        >
                                                            <span className="capitalize">{t}</span>
                                                            <Palette className="w-4 h-4" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activePanel === "assets" && (
                                        <div className="space-y-4">
                                            <div className="bg-slate-800/50 rounded-lg p-3">
                                                <h3 className="text-xs text-slate-400 mb-2 font-bold uppercase">上傳新素材</h3>
                                                <AssetUploader
                                                    defaultCategory="map_element"
                                                    onUploadComplete={(asset) => setMapAssets(prev => [asset, ...prev])}
                                                />
                                            </div>

                                            <div>
                                                <h3 className="text-xs text-slate-400 mb-2 font-bold uppercase">地圖素材庫</h3>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {mapAssets.map(asset => (
                                                        <div
                                                            key={asset.id}
                                                            onClick={() => setSelectedAssetId(asset.id)}
                                                            className={`
                                                                relative aspect-square rounded-lg border-2 cursor-pointer overflow-hidden group
                                                                ${selectedAssetId === asset.id ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-700 hover:border-slate-500'}
                                                            `}
                                                        >
                                                            <img
                                                                src={asset.image_url}
                                                                alt={asset.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[10px] text-white truncate text-center backdrop-blur-sm">
                                                                {asset.name}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activePanel === "regions" && (
                                        <div className="space-y-2">
                                            <div className="text-xs text-slate-500 mb-2 font-bold uppercase">切換當前編輯地區</div>
                                            {regions.map(r => (
                                                <button
                                                    key={r.id}
                                                    onClick={() => setSelectedRegionId(r.id)}
                                                    className={`w-full p-3 rounded-lg text-left text-sm transition-colors ${selectedRegionId === r.id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                                >
                                                    {r.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center p-8 text-center text-slate-500 text-sm">
                                請選擇一個地區進行編輯
                            </div>
                        )}
                    </aside>

                    {/* Map Preview */}
                    <main className="flex-1 bg-slate-950 relative">
                        {isLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-white text-sm">載入區域數據中...</div>
                            </div>
                        ) : region ? (
                            <AdminRegionMap
                                region={region}
                                selectedFacilityId={selectedFacilityId}
                                onFacilityClick={(f) => setSelectedFacilityId(f.id)}
                                onFacilityDrag={handleFacilityDrag}
                                onPlotClick={(plotId) => {
                                    if (activePanel === "assets" && selectedAssetId) {
                                        const plot = region.plots.find(p => p.id === plotId);
                                        const asset = mapAssets.find(a => a.id === selectedAssetId);
                                        if (plot && asset) {
                                            addMapElement({
                                                assetId: asset.id,
                                                assetUrl: asset.image_url,
                                                x: plot.position.x,
                                                y: plot.position.y
                                            });
                                        }
                                    }
                                }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-slate-500 text-sm">無數據</div>
                            </div>
                        )}

                        {error && (
                            <div className="absolute top-4 left-4 right-4 bg-red-600/20 border border-red-500/50 p-3 rounded-lg text-red-400 text-xs flex items-center gap-2">
                                <X className="w-4 h-4 cursor-pointer" onClick={() => { }} />
                                {error}
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};
