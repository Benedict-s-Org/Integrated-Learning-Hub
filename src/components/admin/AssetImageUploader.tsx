import { useState, useEffect } from "react";
import { Upload, Sparkles, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CityStyleAsset, CityAssetType } from "@/types/city";
import { ImageGenerationModal } from "../Shared/ImageGenerationModal";

interface AssetImageUploaderProps {
    onSelect: (url: string, assetId?: string) => void;
    assetType: CityAssetType;
    currentImageUrl?: string;
    onClear?: () => void;
}

export function AssetImageUploader({
    onSelect,
    assetType,
    currentImageUrl,
    onClear
}: AssetImageUploaderProps) {
    const [activeTab, setActiveTab] = useState<"upload" | "library" | "ai">("library");
    const [assets, setAssets] = useState<CityStyleAsset[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Fetch library assets
    const fetchAssets = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from("city_style_assets")
                .select("*")
                .eq("asset_type", assetType)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setAssets((data as unknown as CityStyleAsset[]) || []);
        } catch (err) {
            console.error("Error fetching assets:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === "library") {
            fetchAssets();
        }
    }, [activeTab, assetType]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split(".").pop();
            const fileName = `${assetType}/${Date.now()}.${fileExt}`;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from("city-assets")
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from("city-assets")
                .getPublicUrl(fileName);

            // 3. Insert into Table (Optional, but good for library)
            const { data: assetData, error: insertError } = await supabase
                .from("city_style_assets")
                .insert({
                    name: file.name.split(".")[0],
                    asset_type: assetType,
                    image_url: publicUrl,
                    is_default: false
                })
                .select()
                .single();

            if (insertError) throw insertError;

            onSelect(publicUrl, assetData.id);
            setActiveTab("library");
            fetchAssets();
        } catch (err: any) {
            console.error("Upload failed:", err);
            alert(`Upload failed: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleAIGenerated = (url: string) => {
        // AI image is already uploaded to Supabase in ImageGenerationModal
        onSelect(url);
        setActiveTab("library");
        fetchAssets();
    };

    const filteredAssets = assets.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
                {(["library", "upload", "ai"] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeTab === tab
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                            }`}
                    >
                        {tab === "library" && <Search className="w-3 h-3" />}
                        {tab === "upload" && <Upload className="w-3 h-3" />}
                        {tab === "ai" && <Sparkles className="w-3 h-3" />}
                        {tab === "library" ? "素材庫" : tab === "upload" ? "上傳" : "AI 生成"}
                    </button>
                ))}
            </div>

            {/* Current Selection Preview */}
            {currentImageUrl && (
                <div className="relative group rounded-xl border border-emerald-500/30 overflow-hidden bg-slate-900/50 p-2">
                    <img src={currentImageUrl} alt="Current" className="w-full h-32 object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {onClear && (
                            <button
                                onClick={onClear}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-bold shadow-lg"
                            >
                                移除自訂圖片
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Tab Content */}
            <div className="min-h-[200px]">
                {activeTab === "library" && (
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-slate-500" />
                            <input
                                type="text"
                                placeholder="搜尋素材..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
                            />
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                                {filteredAssets.map((asset) => (
                                    <button
                                        key={asset.id}
                                        onClick={() => onSelect(asset.image_url, asset.id)}
                                        className={`group relative rounded-lg border aspect-square overflow-hidden transition-all ${currentImageUrl === asset.image_url
                                            ? "border-emerald-500 ring-2 ring-emerald-500/20"
                                            : "border-slate-700 hover:border-slate-500 bg-slate-900/30"
                                            }`}
                                    >
                                        <img src={asset.image_url} alt={asset.name} className="w-full h-full object-contain p-1" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20" />
                                    </button>
                                ))}
                                {filteredAssets.length === 0 && (
                                    <div className="col-span-3 py-10 text-center text-slate-500 text-xs">
                                        尚無素材
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "upload" && (
                    <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center gap-4 hover:border-emerald-500/50 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                            {isUploading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> : <Upload className="w-6 h-6 text-slate-400" />}
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-white">點擊或拖曳上傳</p>
                            <p className="text-[10px] text-slate-500 mt-1">PNG, JPG 或 WEBP (最大 5MB)</p>
                        </div>
                        <label className="cursor-pointer">
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                            <div className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-colors">
                                選擇檔案
                            </div>
                        </label>
                    </div>
                )}

                {activeTab === "ai" && (
                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 flex flex-col items-center gap-4">
                        <Sparkles className="w-12 h-12 text-emerald-500 shadow-lg shadow-emerald-500/20" />
                        <div className="text-center">
                            <p className="text-sm font-bold text-white">使用 AI 創造素材</p>
                            <p className="text-[10px] text-slate-500 mt-1">輸入描述文字即可生成獨特的建築或設施</p>
                        </div>
                        <button
                            onClick={() => setIsAIModalOpen(true)}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                        >
                            開始生成 ✨
                        </button>
                        <ImageGenerationModal
                            isOpen={isAIModalOpen}
                            onClose={() => setIsAIModalOpen(false)}
                            onImageSelected={handleAIGenerated}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
