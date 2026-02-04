import React, { useState, useEffect } from "react";
import { Square, Sun, Box, Upload, DollarSign, Trash2, Loader2, Palette, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { uploadImageToSupabase } from "@/utils/storageUpload";
import { CustomWall } from "@/types/room";

interface WallTabProps {
  customWalls: CustomWall[];
  onUpdateWall: (wall: CustomWall) => void;
  onDeleteWall: (id: string) => void;
  onClose: () => void;
}

export const WallTab: React.FC<WallTabProps> = ({
  customWalls,
  onUpdateWall,
  onDeleteWall,
  onClose,
}) => {
  const [selectedWallId, setSelectedWallId] = useState("");
  const [wallName, setWallName] = useState("");
  const [wallPrice, setWallPrice] = useState(0);
  const [wallLightImage, setWallLightImage] = useState("");
  const [wallDarkImage, setWallDarkImage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Variant state
  const [variants, setVariants] = useState<NonNullable<CustomWall["colorVariants"]>>([]);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [defaultImages, setDefaultImages] = useState<{ light: string, dark: string }>({ light: "", dark: "" });
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantColor, setNewVariantColor] = useState("#000000");

  // Load wall data when selected
  useEffect(() => {
    if (!selectedWallId) return;
    const wall = customWalls?.find((w) => w.id === selectedWallId);
    if (wall) {
      setWallName(wall.name || "");
      setWallPrice(wall.price || 0);
      setWallLightImage(wall.lightImage || "");
      setWallDarkImage(wall.darkImage || "");
      setDefaultImages({ light: wall.lightImage || "", dark: wall.darkImage || "" });
      setVariants(wall.colorVariants || []);
      setActiveVariantId(null);
    }
  }, [selectedWallId, customWalls]);

  const handleWallImageUpload = async (type: "light" | "dark", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const url = await uploadImageToSupabase(file, 'walls');
    setIsUploading(false);

    if (url) {
      if (type === "light") setWallLightImage(url);
      else setWallDarkImage(url);
    }
  };

  const handleSave = () => {
    if (!selectedWallId || !wallName) {
      alert("請選擇牆壁並輸入名稱");
      return;
    }

    // Identify current images
    let finalDefault = defaultImages;
    let finalVariants = [...variants];

    if (activeVariantId === null) {
      finalDefault = { light: wallLightImage, dark: wallDarkImage };
    } else {
      finalVariants = finalVariants.map(v =>
        v.id === activeVariantId ? { ...v, lightImage: wallLightImage, darkImage: wallDarkImage } : v
      );
    }

    const updatedWall: CustomWall = {
      id: selectedWallId,
      name: wallName,
      price: parseInt(String(wallPrice)) || 0,
      lightImage: finalDefault.light,
      darkImage: finalDefault.dark,
      colorVariants: finalVariants,
    };
    onUpdateWall(updatedWall);
    onClose();
  };

  const handleAddVariant = () => {
    if (!newVariantName) return;
    const newVariant = {
      id: `variant_${Date.now()}`,
      name: newVariantName,
      color: newVariantColor,
      lightImage: wallLightImage, // Clone current as base? or empty? Let's clone current to make it easier
      darkImage: wallDarkImage,
    };
    setVariants([...variants, newVariant]);
    setNewVariantName("");
    setNewVariantColor("#000000");
  };

  const handleDeleteVariant = (id: string) => {
    if (activeVariantId === id) handleVariantSwitch(null);
    setVariants(variants.filter(v => v.id !== id));
  };

  const handleVariantSwitch = (newId: string | null) => {
    if (activeVariantId === newId) return;

    // Save current
    if (activeVariantId === null) {
      setDefaultImages({ light: wallLightImage, dark: wallDarkImage });
    } else {
      setVariants(prev => prev.map(v => v.id === activeVariantId ? { ...v, lightImage: wallLightImage, darkImage: wallDarkImage } : v));
    }

    // Load new
    if (newId === null) {
      // Switching to default. Using current captured defaultImages? 
      // Same logic as furniture, if switching from Default, we use current state (via setter delay logic correction).
      // If activeVariantId was null, we just set defaultImages to current. 
      // But we can't read it yet. But we know it's `wallLightImage`.
      // If activeVariantId was NOT null, we read from defaultImages state (which should be correct).
      if (activeVariantId === null) {
        // Already default (guarded), effectively no-op or re-render
      } else {
        setWallLightImage(defaultImages.light);
        setWallDarkImage(defaultImages.dark);
      }
    } else {
      const v = variants.find(i => i.id === newId);
      if (v) {
        setWallLightImage(v.lightImage);
        setWallDarkImage(v.darkImage);
      } else {
        setWallLightImage("");
        setWallDarkImage("");
      }
    }
    setActiveVariantId(newId);
  };

  return (
    <div className="flex-1 flex gap-4 p-2 overflow-hidden relative">
      {/* Upload loading overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-black/30 z-50 flex items-center justify-center rounded-xl">
          <div className="bg-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3">
            <Loader2 className="animate-spin text-indigo-600" size={24} />
            <span className="text-slate-700 font-medium">上傳中...</span>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
            <Square size={16} /> 選擇牆壁
          </h3>
          <select
            value={selectedWallId}
            onChange={(e) => setSelectedWallId(e.target.value)}
            className="w-full border rounded p-2 text-sm"
          >
            <option value="">-- 請選擇要編輯的牆壁 --</option>
            {customWalls?.map((wall) => (
              <option key={wall.id} value={wall.id}>
                {wall.name}
              </option>
            ))}
          </select>
        </div>

        {selectedWallId && (
          <>
            <div className="flex gap-4">
              <div className="flex-1 bg-white p-4 rounded-xl border border-gray-200">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
                  <Sun size={16} /> 亮面貼圖
                </h3>
                <div className="border-2 border-dashed border-gray-300 rounded-xl aspect-video flex flex-col items-center justify-center relative bg-gray-50 hover:bg-white transition-colors">
                  {wallLightImage ? (
                    <img src={wallLightImage} alt="亮面" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <div className="text-gray-400 flex flex-col items-center">
                      <Upload size={32} className="mb-2" />
                      <span className="text-sm">上傳亮面貼圖</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => handleWallImageUpload("light", e)}
                    disabled={isUploading}
                  />
                </div>
              </div>
              <div className="flex-1 bg-white p-4 rounded-xl border border-gray-200">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
                  <Box size={16} /> 暗面貼圖
                </h3>
                <div className="border-2 border-dashed border-gray-300 rounded-xl aspect-video flex flex-col items-center justify-center relative bg-gray-50 hover:bg-white transition-colors">
                  {wallDarkImage ? (
                    <img src={wallDarkImage} alt="暗面" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <div className="text-gray-400 flex flex-col items-center">
                      <Upload size={32} className="mb-2" />
                      <span className="text-sm">上傳暗面貼圖</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => handleWallImageUpload("dark", e)}
                    disabled={isUploading}
                  />
                </div>
              </div>
            </div>

            {/* Color Variant Management */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Palette size={16} /> 顏色款式 (可選)
              </h3>

              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => handleVariantSwitch(null)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border
                    ${activeVariantId === null
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}
                >
                  <div className="w-3 h-3 rounded-full bg-slate-400 border border-white shadow-sm" />
                  預設款式
                </button>

                {variants.map(v => (
                  <button
                    key={v.id}
                    onClick={() => handleVariantSwitch(v.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border group relative
                      ${activeVariantId === v.id
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}
                  >
                    <div
                      className="w-3 h-3 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: v.color }}
                    />
                    {v.name}
                    <div
                      onClick={(e) => { e.stopPropagation(); handleDeleteVariant(v.id); }}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                    >
                      <Trash2 size={10} />
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-2 items-end bg-slate-50 p-3 rounded-lg">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">新款式名稱</label>
                  <input
                    type="text"
                    placeholder="例如: 深色牆紙"
                    value={newVariantName}
                    onChange={(e) => setNewVariantName(e.target.value)}
                    className="w-full border rounded p-1.5 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">代表色</label>
                  <input
                    type="color"
                    value={newVariantColor}
                    onChange={(e) => setNewVariantColor(e.target.value)}
                    className="h-8 w-12 cursor-pointer p-0 border-0 rounded overflow-hidden"
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={handleAddVariant}
                  disabled={!newVariantName}
                  className="h-8 text-xs"
                >
                  <Plus size={14} className="mr-1" /> 新增
                </Button>
              </div>

              <div className="text-[10px] text-slate-400">
                * 目前正在編輯: <span className="font-bold text-indigo-600">{activeVariantId ? variants.find(v => v.id === activeVariantId)?.name : "預設款式"}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 block mb-1">牆壁名稱</label>
                  <input
                    type="text"
                    value={wallName}
                    onChange={(e) => setWallName(e.target.value)}
                    placeholder="給牆壁取個名字..."
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
                <div className="w-1/3">
                  <label className="text-xs font-bold text-slate-500 block mb-1">定價</label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      value={wallPrice}
                      onChange={(e) => setWallPrice(parseInt(e.target.value) || 0)}
                      className="w-full border rounded p-2 pl-6 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100 flex justify-between">
                <Button
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    if (confirm(`確定要刪除「${wallName}」嗎？此操作無法復原。`)) {
                      onDeleteWall(selectedWallId);
                      setSelectedWallId("");
                      onClose();
                    }
                  }}
                >
                  <Trash2 size={16} className="mr-1" /> 刪除牆壁
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={onClose}>
                    取消
                  </Button>
                  <Button variant="primary" onClick={handleSave} icon={Square} disabled={isUploading}>
                    儲存變更
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {!selectedWallId && customWalls?.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Square size={48} className="mx-auto mb-4 opacity-50" />
            <p>尚無上傳的牆壁樣式</p>
            <p className="text-sm mt-2">請先在上傳管理中心上傳牆壁</p>
          </div>
        )}
      </div>
    </div>
  );
};
