import { useState } from "react";
import type { PublicFacility } from "@/types/region";
import { Edit2, Sparkles, Image as ImageIcon, Star } from "lucide-react";
import { AssetImageUploader } from "./AssetImageUploader";
import { TransformControls } from "./TransformControls";

interface FacilityStyleEditorProps {
    facility: PublicFacility;
    onUpdate: (id: string, updates: Partial<PublicFacility>) => void;
}

export function FacilityStyleEditor({ facility, onUpdate }: FacilityStyleEditorProps) {
    const [activeTab, setActiveTab] = useState<"basic" | "image">("basic");

    return (
        <div className="space-y-6">
            {/* Tab Switcher */}
            <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/50">
                <button
                    onClick={() => setActiveTab("basic")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "basic"
                            ? "bg-slate-700 text-white shadow-lg"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                >
                    <Edit2 size={14} />
                    基本資訊
                </button>
                <button
                    onClick={() => setActiveTab("image")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "image"
                            ? "bg-emerald-600 text-white shadow-lg"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                >
                    <ImageIcon size={14} />
                    自定義圖片
                </button>
            </div>

            {activeTab === "basic" ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                    {/* Name */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">設施名稱</label>
                        <input
                            type="text"
                            value={facility.name}
                            onChange={(e) => onUpdate(facility.id, { name: e.target.value })}
                            className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:border-emerald-500 outline-none transition-all font-bold"
                            placeholder="輸入設施名稱..."
                        />
                    </div>

                    {/* Level */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">設施等級</label>
                            <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                                <Star size={12} fill="currentColor" />
                                LV.{facility.level}
                            </span>
                        </div>
                        <input
                            type="range"
                            min={1}
                            max={10}
                            value={facility.level}
                            onChange={(e) => onUpdate(facility.id, { level: parseInt(e.target.value) })}
                            className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] font-bold text-slate-600">
                            <span>1</span>
                            <span>10</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <Sparkles size={12} className="text-emerald-500" />
                            設施素材
                        </label>
                        <AssetImageUploader
                            assetType="map_element" // Facilities use map_element assets
                            currentImageUrl={facility.customImageUrl}
                            onSelect={(url, id) => onUpdate(facility.id, { customImageUrl: url, customAssetId: id })}
                            onClear={() => onUpdate(facility.id, { customImageUrl: undefined, customAssetId: undefined })}
                        />
                    </div>

                    {facility.customImageUrl && (
                        <TransformControls
                            data={facility.transform || {}}
                            onChange={(transform) => onUpdate(facility.id, {
                                transform: { ...(facility.transform || {}), ...transform }
                            })}
                            onReset={() => onUpdate(facility.id, { transform: {} })}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
