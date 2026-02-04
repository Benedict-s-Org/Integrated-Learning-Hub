import React, { useState, useEffect } from "react";
import {
  Package,
  Image as ImageIcon,
  Palette,
  Plus,
  Trash2,
  Sliders,
  Move,
  Settings,
  Upload,
  RotateCcw,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FurnitureItem, CustomFurniture, FurnitureColorVariant } from "@/types/furniture";

interface FurnitureTabProps {
  customCatalog: FurnitureItem[];
  onUpdate: (item: FurnitureItem) => void;
  onDelete: (id: string) => void;
  onEnterTransformMode: (id: string) => void;
  onClose: () => void;
}

export const FurnitureTab: React.FC<FurnitureTabProps> = ({
  customCatalog,
  onUpdate,
  onDelete,
  onEnterTransformMode,
  onClose,
}) => {
  const [selectedId, setSelectedId] = useState("");
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null]);
  const [conditionImages, setConditionImages] = useState<string[]>(["", "", "", ""]);
  const [dims, setDims] = useState({ ns: 1, ew: 1 });
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [rotation, setRotation] = useState(0);
  const conditionLabels = ["正面(全新)", "正面有塵(閒置)", "正面封存(閒置久)", "正面破損(過久)"];

  // Variant state
  const [variants, setVariants] = useState<FurnitureColorVariant[]>([]);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [defaultImages, setDefaultImages] = useState<(string | null)[]>([null, null, null, null]);
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantColor, setNewVariantColor] = useState("#000000");

  // Load furniture data when selected
  useEffect(() => {
    if (!selectedId) return;
    const item = customCatalog.find((f) => f.id === selectedId) as CustomFurniture;
    if (item) {
      setName(item.name || "");
      setPrice(item.cost || 0);
      setDims({ ns: item.size?.[1] || 1, ew: item.size?.[0] || 1 });
      const imgs = item.spriteImages || [null, null, null, null];
      setImages(imgs);
      setDefaultImages(imgs);
      setConditionImages(item.conditionImages || ["", "", "", ""]);
      setVariants(item.colorVariants || []);
      setActiveVariantId(null);
    }
  }, [selectedId, customCatalog]);

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newImages = [...images];
        newImages[index] = ev.target?.result as string;
        setImages(newImages);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConditionImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newConditionImages = [...conditionImages];
        newConditionImages[index] = ev.target?.result as string;
        setConditionImages(newConditionImages);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const item = customCatalog.find((f) => f.id === selectedId) as CustomFurniture;
    if (!selectedId || !name) {
      alert("請選擇家具並輸入名稱");
      return;
    }

    // Ensure we save the current viewing images to the correct place before final save
    let finalDefaultImages = defaultImages;
    let finalVariants = [...variants];

    if (activeVariantId === null) {
      finalDefaultImages = images;
    } else {
      finalVariants = finalVariants.map(v =>
        v.id === activeVariantId ? { ...v, images: images } : v
      );
    }

    const finalImagesNormalized = finalDefaultImages.map((img) => img || finalDefaultImages[0]);
    const updatedFurniture: CustomFurniture = {
      id: selectedId,
      name,
      icon: item?.icon || ImageIcon,
      cost: parseInt(String(price)) || 0,
      size: [parseInt(String(dims.ew)) || 1, parseInt(String(dims.ns)) || 1],
      spriteImages: finalImagesNormalized,
      conditionImages: conditionImages,
      spriteOffsetY: item?.spriteOffsetY ?? 20,
      spriteOffsetX: item?.spriteOffsetX ?? 0,
      spriteScale: item?.spriteScale ?? 1,
      spriteScaleX: item?.spriteScaleX ?? 100,
      spriteScaleY: item?.spriteScaleY ?? 100,
      spriteSkewX: item?.spriteSkewX ?? 0,
      spriteSkewY: item?.spriteSkewY ?? 0,
      colorVariants: finalVariants,
    };
    onUpdate(updatedFurniture);
    onClose();
  };

  const handleAddVariant = () => {
    if (!newVariantName) return;
    const newVariant: FurnitureColorVariant = {
      id: `variant_${Date.now()}`,
      name: newVariantName,
      color: newVariantColor,
      images: [null, null, null, null],
    };
    setVariants([...variants, newVariant]);
    setNewVariantName("");
    setNewVariantColor("#000000");
  };

  const handleDeleteVariant = (id: string) => {
    if (activeVariantId === id) {
      handleVariantSwitch(null);
    }
    setVariants(variants.filter(v => v.id !== id));
  };

  const handleVariantSwitch = (newId: string | null) => {
    if (activeVariantId === newId) return;

    // 1. Capture current 'images' into the storage
    if (activeVariantId === null) {
      setDefaultImages(images);
    } else {
      setVariants(prev => prev.map(v => v.id === activeVariantId ? { ...v, images: images } : v));
    }

    // 2. Determine new images
    let nextImages: (string | null)[];
    if (newId === null) {
      // Switching TO default
      nextImages = defaultImages;
      // Note: If we just modified default (activeVariantId=null), defaultImages holds the old value until step 1 runs.
      // But setState is async.
      // Wait, in `handleVariantSwitch` step 1 uses `images` (current state) to update `defaultImages` via setState.
      // But step 2 tries to read `defaultImages`. `defaultImages` WON'T be updated yet in this render cycle!
      // FIX: Use `images` directly if we are switching FROM default.
      if (activeVariantId === null) {
        // We are switching FROM default. So defaultImages should receive `images`.
        // But we can't read the updated `defaultImages` yet.
        // We don't need to read it for `nextImages` because `nextImages` will be the variant's images.
      } else {
        // We are switching FROM variant TO default. 
        // `defaultImages` should rely on the state. IS it stale?
        // When we switched AWAY from default previously, we updated `defaultImages`.
        // So `defaultImages` should be correct.
      }
    } else {
      const v = variants.find(i => i.id === newId);
      nextImages = v ? v.images : [null, null, null, null];
    }

    // Correction for the async state issue:
    // If I am on Default, modify it, then switch to Blue.
    // Step 1: setDefaultImages(currentImages).
    // Step 2: setImages(BlueImages).
    // This is fine.

    // If I am on Blue, modify it, then switch to Default.
    // Step 1: setVariants(update Blue).
    // Step 2: setImages(defaultImages).
    // This is fine.

    setImages(nextImages);
    setActiveVariantId(newId);
  };

  return (
    <div className="flex-1 flex gap-4 p-2 overflow-hidden">
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
            <Settings size={16} /> 選擇家具
          </h3>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full border rounded p-2 text-sm"
          >
            <option value="">-- 請選擇要編輯的家具 --</option>
            {customCatalog
              .filter((f) => f.id.startsWith("custom_"))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </div>

        {selectedId && (
          <>
            <div className="flex gap-4 h-[300px]">
              <div className="w-1/2 grid grid-cols-2 gap-2">
                {["南方 (正面)", "西方 (左側)", "北方 (背面)", "東方 (右側)"].map((label, idx) => (
                  <div
                    key={idx}
                    className="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center relative bg-gray-50 hover:bg-white transition-colors group"
                  >
                    {images[idx] ? (
                      <img src={images[idx]!} alt={label} className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="text-gray-400 flex flex-col items-center">
                        <Upload size={24} className="mb-2" />
                        <span className="text-xs">{label}</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => handleImageUpload(idx, e)}
                    />
                    {images[idx] && (
                      <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1 rounded">
                        {label}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="w-1/2 bg-slate-100 rounded-xl border border-slate-200 relative flex flex-col items-center justify-center overflow-hidden">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                  }}
                />
                <div className="relative z-10 transition-all duration-300" style={{ transform: "scale(1.5)" }}>
                  {images[rotation] ? (
                    <img src={images[rotation]!} alt="Preview" className="max-w-[150px] max-h-[150px] drop-shadow-xl" />
                  ) : (
                    <div className="text-gray-400 text-xs">暫無預覽圖片</div>
                  )}
                  <div className="mt-4 bg-black/10 px-3 py-1 rounded-full text-xs font-mono text-gray-600 text-center">
                    面向: {["南", "西", "北", "東"][rotation]}
                  </div>
                </div>
                <div className="absolute bottom-4 flex gap-2">
                  <Button variant="ghost" onClick={() => setRotation((r) => (r - 1 + 4) % 4)}>
                    <RotateCcw size={16} className="scale-x-[-1]" />
                  </Button>
                  <Button variant="ghost" onClick={() => setRotation((r) => (r + 1) % 4)}>
                    <RotateCcw size={16} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <ImageIcon size={16} /> 家具狀態圖片
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {conditionLabels.map((label, idx) => (
                  <div
                    key={idx}
                    className="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center relative bg-gray-50 hover:bg-white transition-colors group h-24"
                  >
                    {conditionImages[idx] ? (
                      <img src={conditionImages[idx]} alt={label} className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="text-gray-400 flex flex-col items-center p-1">
                        <Upload size={16} className="mb-1" />
                        <span className="text-[10px] text-center leading-tight">{label}</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => handleConditionImageUpload(idx, e)}
                    />
                    {conditionImages[idx] && (
                      <div className="absolute top-1 right-1 bg-black/50 text-white text-[8px] px-1 rounded">
                        {label}
                      </div>
                    )}
                  </div>
                ))}
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
                    placeholder="例如: 深木色"
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

            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Settings size={16} /> 規格設定
              </h3>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 w-16">佔地格數</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={dims.ns}
                  onChange={(e) => setDims({ ...dims, ns: parseInt(e.target.value) || 1 })}
                  className="w-16 border rounded p-1 text-center text-sm"
                />
                <span className="text-slate-400">x</span>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={dims.ew}
                  onChange={(e) => setDims({ ...dims, ew: parseInt(e.target.value) || 1 })}
                  className="w-16 border rounded p-1 text-center text-sm"
                />
                <span className="text-xs text-slate-400 ml-2">(南北 x 東西)</span>
              </div>
            </div>

            {/* Advanced Transform Button */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-200">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <h3 className="font-bold text-indigo-700 flex items-center gap-2">
                    <Sliders size={16} /> 精細調整
                  </h3>
                  <p className="text-xs text-indigo-600 mt-1">調整位置、縮放、拉伸、傾斜等進階變形參數</p>
                </div>
                <Button
                  variant="primary"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => {
                    if (selectedId) {
                      onEnterTransformMode(selectedId);
                    }
                  }}
                >
                  <Move size={16} className="mr-1" /> 進入精細調整模式
                </Button>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 block mb-1">家具名稱</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="給家具取個名字..."
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
                <div className="w-1/3">
                  <label className="text-xs font-bold text-slate-500 block mb-1">定價</label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
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
                    if (confirm(`確定要刪除「${name}」嗎？此操作無法復原。`)) {
                      onDelete(selectedId);
                      setSelectedId("");
                      onClose();
                    }
                  }}
                >
                  <Trash2 size={16} className="mr-1" /> 刪除家具
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={onClose}>
                    取消
                  </Button>
                  <Button variant="primary" onClick={handleSave} icon={Package}>
                    儲存變更
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
