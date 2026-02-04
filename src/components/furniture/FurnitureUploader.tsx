import React, { useState, useEffect } from "react";
import {
  Upload,
  RotateCcw,
  Settings,
  Wand2,
  Loader2,
  DollarSign,
  History,
  Package,
  Image as ImageIcon,
  Palette,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FurnitureItem, CustomFurniture, FurnitureColorVariant } from "@/types/furniture";
import { BackgroundRemovalEditor } from "@/components/common/BackgroundRemovalEditor";
import {
  uploadImageToSupabase,
  flipImageHorizontally,
  dataUrlToFile
} from "@/utils/storageUpload";

interface FurnitureUploaderProps {
  onClose: () => void;
  onSave: (furniture: FurnitureItem) => void;
}

interface HistoryItem {
  id: string | number;
  name: string;
  images: (string | null)[];
  filter: string;
}

export const FurnitureUploader: React.FC<FurnitureUploaderProps> = ({ onClose, onSave }) => {
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null]);
  const [conditionImages, setConditionImages] = useState<string[]>(["", "", "", ""]);
  const [dims, setDims] = useState({ ns: 1, ew: 1 });
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [refPrice, setRefPrice] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [correctionPrompt, setCorrectionPrompt] = useState("");
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([
    { id: "init", name: "#1 初始空白", images: [null, null, null, null], filter: "" },
  ]);
  // Track which directions are manually uploaded (index: 0=South, 1=West, 2=North, 3=East)
  const [manuallyUploaded, setManuallyUploaded] = useState<boolean[]>([false, false, false, false]);
  // Background removal state
  const [showBgRemoval, setShowBgRemoval] = useState(false);
  const [bgRemovalImageIndex, setBgRemovalImageIndex] = useState<number | null>(null);
  // Upload loading state
  const [isUploading, setIsUploading] = useState(false);

  // Color Variant State
  const [variants, setVariants] = useState<FurnitureColorVariant[]>([]);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null); // null = default
  const [defaultImages, setDefaultImages] = useState<(string | null)[]>([null, null, null, null]);
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantColor, setNewVariantColor] = useState("#000000");

  const conditionLabels = ["正面(全新)", "正面有塵(閒置)", "正面封存(閒置久)", "正面破損(過久)"];

  const handleBgRemoval = (index: number) => {
    setBgRemovalImageIndex(index);
    setShowBgRemoval(true);
  };

  const handleBgRemovalApply = async (processedDataUrl: string) => {
    if (bgRemovalImageIndex === null) return;

    setIsUploading(true);
    setShowBgRemoval(false);

    try {
      // Convert data URL to File and upload to Storage
      const file = dataUrlToFile(processedDataUrl, `furniture_bg_removed_${Date.now()}.png`);
      const url = await uploadImageToSupabase(file, 'furniture-sprites');

      if (url) {
        const newImages = [...images];
        newImages[bgRemovalImageIndex] = url;
        setImages(newImages);
        addHistory(`#${history.length + 1} 去背處理`, newImages, "");
      }
    } catch (err) {
      console.error('Background removal upload failed:', err);
    } finally {
      setIsUploading(false);
      setBgRemovalImageIndex(null);
    }
  };

  const handleImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const url = await uploadImageToSupabase(file, 'furniture-sprites');

    if (url) {
      const newImages = [...images];
      const newManuallyUploaded = [...manuallyUploaded];

      newImages[index] = url;
      newManuallyUploaded[index] = true;

      // Auto-flip logic:
      // South (0) -> West (1): if West not manually uploaded, auto-flip South
      // North (2) -> East (3): if East not manually uploaded, auto-flip North
      if (index === 0 && !newManuallyUploaded[1]) {
        try {
          const flippedDataUrl = await flipImageHorizontally(url);
          // Upload the flipped image to Storage
          const flippedFile = dataUrlToFile(flippedDataUrl, `furniture_flipped_${Date.now()}.png`);
          const flippedUrl = await uploadImageToSupabase(flippedFile, 'furniture-sprites');
          if (flippedUrl) {
            newImages[1] = flippedUrl;
          }
        } catch (err) {
          console.error('Failed to auto-flip image for West:', err);
        }
      } else if (index === 2 && !newManuallyUploaded[3]) {
        try {
          const flippedDataUrl = await flipImageHorizontally(url);
          // Upload the flipped image to Storage
          const flippedFile = dataUrlToFile(flippedDataUrl, `furniture_flipped_${Date.now()}.png`);
          const flippedUrl = await uploadImageToSupabase(flippedFile, 'furniture-sprites');
          if (flippedUrl) {
            newImages[3] = flippedUrl;
          }
        } catch (err) {
          console.error('Failed to auto-flip image for East:', err);
        }
      }

      setImages(newImages);
      setManuallyUploaded(newManuallyUploaded);
      addHistory(`#${history.length + 1} 上傳圖片`, newImages, "");
    }

    setIsUploading(false);
  };

  const handleConditionImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const url = await uploadImageToSupabase(file, 'condition-images');
    setIsUploading(false);

    if (url) {
      const newConditionImages = [...conditionImages];
      newConditionImages[index] = url;
      setConditionImages(newConditionImages);
    }
  };

  const addHistory = (label: string, imgs: (string | null)[], filter: string) => {
    setHistory((prev) => [...prev, { id: Date.now(), name: label, images: imgs, filter }]);
  };

  const restoreVersion = (version: HistoryItem) => {
    setImages(version.images);
  };

  useEffect(() => {
    if (!name) return;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const autoPrice = (Math.abs(hash) % 50) * 10 + 50;
    setRefPrice(autoPrice);
    if (price === 0) setPrice(autoPrice);
  }, [name, price]);

  const handleAICorrection = () => {
    if (!correctionPrompt) return;
    setIsAIProcessing(true);
    setAiMessage("AI 正在分析圖片結構...");
    const randomFilters = [
      "contrast(1.2) brightness(1.1)",
      "sepia(0.3) contrast(1.1)",
      "saturate(1.5) hue-rotate(10deg)",
      "grayscale(0.2) brightness(1.2)",
    ];
    const newFilter = randomFilters[Math.floor(Math.random() * randomFilters.length)];
    setTimeout(() => {
      setIsAIProcessing(false);
      setAiMessage("修正完成！(已儲存至版本歷史)");
      addHistory(`#${history.length + 1} AI: ${correctionPrompt}`, images, newFilter);
      setCorrectionPrompt("");
      setTimeout(() => setAiMessage(""), 3000);
    }, 1500);
  };

  const handleSave = () => {
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

    if (!name || !finalDefaultImages[0]) {
      alert("請至少輸入名稱並上傳第一張圖片（南方）");
      return;
    }
    const finalImagesNormalized = finalDefaultImages.map((img) => img || finalDefaultImages[0]) as string[];
    const newFurniture: CustomFurniture = {
      id: `custom_${Date.now()}`,
      name,
      icon: ImageIcon,
      cost: parseInt(String(price)) || refPrice,
      desc: "管理員上傳的自定義家具",
      type: "sprite",
      size: [parseInt(String(dims.ew)) || 1, parseInt(String(dims.ns)) || 1],
      spriteImages: finalImagesNormalized,
      conditionImages: conditionImages,
      colorVariants: finalVariants,
    };
    onSave(newFurniture);
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
      switchVariant(null);
    }
    setVariants(variants.filter(v => v.id !== id));
  };

  const switchVariant = (targetId: string | null) => {
    if (activeVariantId === targetId) return;

    // Save current images
    if (activeVariantId === null) {
      setDefaultImages(images);
    } else {
      setVariants(prev => prev.map(v => v.id === activeVariantId ? { ...v, images: images } : v));
    }

    // Load target images
    if (targetId === null) {
      // We need to use the LATEST defaultImages which might have just been updated if we were on default
      // But if we were on default, activeVariantId was null, so we just updated defaultImages.
      // Wait, setState is async. 
      // Better strategy: Calculate next images directly.
      if (activeVariantId === null) {
        // Already on default, switching to default (handled by guard clause)
      } else {
        // Switching FROM variant TO default
        setImages(defaultImages);
      }
    } else {
      const targetVariant = variants.find(v => v.id === targetId);
      if (targetVariant) {
        setImages(targetVariant.images);
      }
    }

    setActiveVariantId(targetId);
  };

  // Override setImages to sync with current view immediately if needed? 
  // No, we use local 'images' state for UI, and sync on switch/save.
  // But we need to initialize defaultImages with the initial state of images (which is nulls).
  // useEffect(..., []) handles basic init.

  // Helper to safely switch (wrapping the async state logic)
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
      // If we are switching TO default, we want the stored defaultImages. 
      // CAUTION: If we are currently default (activeVariantId===null), 'defaultImages' state may be stale compared to 'images' state?
      // Actually, if activeVariantId === null, we are just saving 'images' to 'defaultImages'.
      // But since we are switching FROM something else (checked by guard), defaultImages should be safe.
      // Wait, if I edit default, verify 'defaultImages' isn't updated? Correct.
      // So if I switch FROM variant TO default, 'defaultImages' holds the preserved default images.
      nextImages = defaultImages;
    } else {
      const v = variants.find(i => i.id === newId);
      nextImages = v ? v.images : [null, null, null, null];
    }

    setImages(nextImages);
    setActiveVariantId(newId);
  };

  return (
    <div className="h-full flex gap-4 p-2 overflow-hidden">
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
        <div className="flex gap-4 h-[350px]">
          <div className="w-1/2 grid grid-cols-2 gap-2">
            {["南方 (正面)", "西方 (左側)", "北方 (背面)", "東方 (右側)"].map((label, idx) => {
              // Check if this direction uses auto-flip
              const isAutoFlipped = (idx === 1 && images[1] && !manuallyUploaded[1]) ||
                (idx === 3 && images[3] && !manuallyUploaded[3]);

              return (
                <div
                  key={idx}
                  className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center relative hover:bg-white transition-colors group
                    ${isAutoFlipped ? 'border-emerald-300 bg-emerald-50' : 'border-gray-300 bg-gray-50'}`}
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
                    disabled={isUploading}
                  />
                  {images[idx] && (
                    <>
                      <div className={`absolute top-1 right-1 text-white text-[10px] px-1 rounded ${isAutoFlipped ? 'bg-emerald-500' : 'bg-black/50'}`}>
                        {isAutoFlipped ? '自動翻轉' : label}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleBgRemoval(idx); }}
                        className="absolute bottom-1 right-1 bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                        title="去除白色背景"
                        disabled={isUploading}
                      >
                        <Wand2 size={10} /> 去背
                      </button>
                    </>
                  )}
                  {isAutoFlipped && !images[idx] && (
                    <div className="absolute bottom-1 left-1 right-1 text-[9px] text-emerald-600 text-center">
                      點擊可自訂
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="w-1/2 bg-slate-100 rounded-xl border border-slate-200 relative flex flex-col items-center justify-center overflow-hidden">
            <div
              className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "20px 20px" }}
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
                  disabled={isUploading}
                />
                {conditionImages[idx] && (
                  <div className="absolute top-1 right-1 bg-black/50 text-white text-[8px] px-1 rounded">{label}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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

          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <Wand2 size={16} /> AI 修正 (模擬)
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="例如: 去背, 調亮, 風格化..."
                value={correctionPrompt}
                onChange={(e) => setCorrectionPrompt(e.target.value)}
                className="flex-1 border rounded p-2 text-xs"
              />
              <Button
                variant="primary"
                className="px-3 py-1 text-xs"
                onClick={handleAICorrection}
                disabled={isAIProcessing}
              >
                {isAIProcessing ? <Loader2 className="animate-spin" size={14} /> : "修正"}
              </Button>
            </div>
            {aiMessage && <div className="text-xs text-emerald-600 font-bold">{aiMessage}</div>}
          </div>
        </div>

        {/* Color Variant Management */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Palette size={16} /> 顏色款式 (可選)
          </h3>

          <div className="flex flex-wrap gap-2 mb-4">
            {/* Default Variant Button */}
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
              <label className="text-xs font-bold text-slate-500 block mb-1">定價 (參考: ${refPrice})</label>
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
          <div className="pt-2 border-t border-gray-100 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button variant="primary" onClick={handleSave} icon={Package} disabled={isUploading}>
              上架家具
            </Button>
          </div>
        </div>
      </div>

      <div className="w-48 bg-slate-50 border-l p-4 flex flex-col gap-2 overflow-y-auto shrink-0">
        <h4 className="font-bold text-xs text-slate-500 uppercase flex items-center gap-1">
          <History size={12} /> 版本歷史
        </h4>
        {history.map((h) => (
          <div
            key={h.id}
            onClick={() => restoreVersion(h)}
            className="p-3 bg-white border rounded-xl cursor-pointer hover:border-indigo-400 text-xs shadow-sm active:scale-95 transition-all group"
          >
            <div className="font-bold text-indigo-600 mb-1">{h.name}</div>
            <div className="grid grid-cols-2 gap-0.5 opacity-50 group-hover:opacity-100">
              {h.images.slice(0, 4).map((img, idx) => (
                <div key={idx} className="w-full h-8 bg-slate-100 rounded overflow-hidden">
                  {img && <img src={img} className="w-full h-full object-cover" style={{ filter: h.filter }} />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Background Removal Editor */}
      {bgRemovalImageIndex !== null && images[bgRemovalImageIndex] && (
        <BackgroundRemovalEditor
          imageUrl={images[bgRemovalImageIndex]}
          isOpen={showBgRemoval}
          onClose={() => {
            setShowBgRemoval(false);
            setBgRemovalImageIndex(null);
          }}
          onApply={handleBgRemovalApply}
        />
      )}
    </div>
  );
};
