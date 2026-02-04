import React, { useState, useEffect } from "react";
import { Grid, Upload, DollarSign, Trash2, Loader2, Palette, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { uploadImageToSupabase } from "@/utils/storageUpload";
import { CustomFloor } from "@/types/room";

interface FloorTabProps {
  customFloors: CustomFloor[];
  onUpdateFloor: (floor: CustomFloor) => void;
  onDeleteFloor: (id: string) => void;
  onClose: () => void;
}

export const FloorTab: React.FC<FloorTabProps> = ({
  customFloors,
  onUpdateFloor,
  onDeleteFloor,
  onClose,
}) => {
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [floorName, setFloorName] = useState("");
  const [floorPrice, setFloorPrice] = useState(0);
  const [floorImage, setFloorImage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Variant state
  const [variants, setVariants] = useState<NonNullable<CustomFloor["colorVariants"]>>([]);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [defaultImage, setDefaultImage] = useState("");
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantColor, setNewVariantColor] = useState("#000000");

  // Load floor data when selected
  useEffect(() => {
    if (!selectedFloorId) return;
    const floor = customFloors?.find((f) => f.id === selectedFloorId);
    if (floor) {
      setFloorName(floor.name || "");
      setFloorPrice(floor.price || 0);
      setFloorImage(floor.image || "");
      setDefaultImage(floor.image || "");
      setVariants(floor.colorVariants || []);
      setActiveVariantId(null);
    }
  }, [selectedFloorId, customFloors]);

  const handleFloorImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const url = await uploadImageToSupabase(file, 'floors');
    setIsUploading(false);

    if (url) {
      setFloorImage(url);
    }
  };

  const handleSave = () => {
    if (!selectedFloorId || !floorName) {
      alert("請選擇地板並輸入名稱");
      return;
    }

    // Identify current images
    let finalDefault = defaultImage;
    let finalVariants = [...variants];

    if (activeVariantId === null) {
      finalDefault = floorImage;
    } else {
      finalVariants = finalVariants.map(v =>
        v.id === activeVariantId ? { ...v, image: floorImage } : v
      );
    }

    const updatedFloor: CustomFloor = {
      id: selectedFloorId,
      name: floorName,
      price: parseInt(String(floorPrice)) || 0,
      image: finalDefault,
      colorVariants: finalVariants,
    };
    onUpdateFloor(updatedFloor);
    onClose();
  };

  const handleAddVariant = () => {
    if (!newVariantName) return;
    const newVariant = {
      id: `variant_${Date.now()}`,
      name: newVariantName,
      color: newVariantColor,
      image: floorImage,
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
      setDefaultImage(floorImage);
    } else {
      setVariants(prev => prev.map(v => v.id === activeVariantId ? { ...v, image: floorImage } : v));
    }

    // Load new
    if (newId === null) {
      if (activeVariantId === null) {
        // no-op
      } else {
        setFloorImage(defaultImage);
      }
    } else {
      const v = variants.find(i => i.id === newId);
      setFloorImage(v?.image || "");
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
            <Grid size={16} /> 選擇地板
          </h3>
          <select
            value={selectedFloorId}
            onChange={(e) => setSelectedFloorId(e.target.value)}
            className="w-full border rounded p-2 text-sm"
          >
            <option value="">-- 請選擇要編輯的地板 --</option>
            {customFloors?.map((floor) => (
              <option key={floor.id} value={floor.id}>
                {floor.name}
              </option>
            ))}
          </select>
        </div>

        {selectedFloorId && (
          <>
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
                <Grid size={16} /> 地板貼圖
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-xl aspect-video flex flex-col items-center justify-center relative bg-gray-50 hover:bg-white transition-colors max-w-md mx-auto">
                {floorImage ? (
                  <img src={floorImage} alt="地板" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <div className="text-gray-400 flex flex-col items-center">
                    <Upload size={32} className="mb-2" />
                    <span className="text-sm">上傳地板貼圖</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleFloorImageUpload}
                  disabled={isUploading}
                />
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
                    placeholder="例如: 深色地板"
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
                  <label className="text-xs font-bold text-slate-500 block mb-1">地板名稱</label>
                  <input
                    type="text"
                    value={floorName}
                    onChange={(e) => setFloorName(e.target.value)}
                    placeholder="給地板取個名字..."
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
                <div className="w-1/3">
                  <label className="text-xs font-bold text-slate-500 block mb-1">定價</label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      value={floorPrice}
                      onChange={(e) => setFloorPrice(parseInt(e.target.value) || 0)}
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
                    if (confirm(`確定要刪除「${floorName}」嗎？此操作無法復原。`)) {
                      onDeleteFloor(selectedFloorId);
                      setSelectedFloorId("");
                      onClose();
                    }
                  }}
                >
                  <Trash2 size={16} className="mr-1" /> 刪除地板
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={onClose}>
                    取消
                  </Button>
                  <Button variant="primary" onClick={handleSave} icon={Grid} disabled={isUploading}>
                    儲存變更
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {!selectedFloorId && customFloors?.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Grid size={48} className="mx-auto mb-4 opacity-50" />
            <p>尚無上傳的地板樣式</p>
            <p className="text-sm mt-2">請先在上傳管理中心上傳地板</p>
          </div>
        )}
      </div>
    </div>
  );
};
