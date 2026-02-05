import { useState } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CityAssetType } from "@/types/city";

interface AssetUploaderProps {
    onUploadComplete?: (asset: any) => void;
    defaultCategory?: CityAssetType;
}

export function AssetUploader({ onUploadComplete, defaultCategory = "map_element" }: AssetUploaderProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [name, setName] = useState("");
    const [category, setCategory] = useState<CityAssetType>(defaultCategory);

    // Preview
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
        }
    };

    const handleFileSelect = (file: File) => {
        setSelectedFile(file);
        // Auto-generate name from filename if empty
        if (!name) {
            setName(file.name.split('.')[0].replace(/[_-]/g, ' '));
        }
        // Create preview
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
    };

    const handleUpload = async () => {
        if (!selectedFile || !name) return;

        setIsUploading(true);
        try {
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${category}/${Date.now()}.${fileExt}`;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from("city-assets")
                .upload(fileName, selectedFile);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from("city-assets")
                .getPublicUrl(fileName);

            // 3. Insert into Table
            const { data: assetData, error: insertError } = await supabase
                .from("city_style_assets")
                .insert({
                    name: name,
                    asset_type: category,
                    image_url: publicUrl,
                    is_default: false
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // Cleanup
            setPreviewUrl(null);
            setSelectedFile(null);
            setName("");
            if (onUploadComplete) onUploadComplete(assetData);
            alert("Asset uploaded successfully!");

        } catch (error: any) {
            console.error("Upload failed:", error);
            alert(`Upload failed: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
            <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-400" />
                Upload New Asset
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Drop Zone */}
                <div
                    className={`relative flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-xl transition-all
            ${dragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-600 bg-slate-900/50'}
            ${previewUrl ? 'border-none p-0 overflow-hidden' : ''}
          `}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    {previewUrl ? (
                        <div className="relative w-full h-full group">
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-2" />
                            <button
                                onClick={() => {
                                    setPreviewUrl(null);
                                    setSelectedFile(null);
                                }}
                                className="absolute top-2 right-2 p-1 bg-red-500/80 text-white rounded-full hover:bg-red-600 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="text-center p-4">
                            <ImageIcon className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                            <p className="text-slate-400 text-sm mb-2">Drag & drop image here</p>
                            <p className="text-slate-600 text-xs mb-4">Supports PNG, JPG, WEBP</p>
                            <label className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm cursor-pointer transition-colors">
                                Select File
                                <input type="file" className="hidden" onChange={handleChange} accept="image/*" />
                            </label>
                        </div>
                    )}
                </div>

                {/* Form */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Asset Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Stone Path, Oak Tree"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as CityAssetType)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                        >
                            <option value="map_element">Map Element (Road, Terrain)</option>
                            <option value="building">Building (House, Shop)</option>
                            <option value="decoration">Decoration (Tree, Lamp)</option>
                            {/* Add more types if needed based on updated Types */}
                        </select>
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={handleUpload}
                            disabled={!selectedFile || !name || isUploading}
                            className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all
                ${!selectedFile || !name || isUploading
                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20 active:scale-[0.98]'
                                }
              `}
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-5 h-5" />
                                    Upload to Library
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
