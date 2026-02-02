import React, { useState, useEffect } from 'react';
import { 
  Upload, X, RotateCcw, Settings, DollarSign, Package, 
  Wand2, Loader2, History, Image as ImageIcon, Layers, Square, Home
} from 'lucide-react';
import { BackgroundRemovalEditor } from '@/components/common/BackgroundRemovalEditor';
import { 
  uploadImageToSupabase, 
  dataUrlToFile, 
  flipImageHorizontally, 
  flipAndDarkenImage 
} from '@/utils/storageUpload';

// Simple Button component for this module
const Button = ({ variant = 'primary', children, className = '', icon: Icon, ...props }) => {
  const base = "px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all duration-200 disabled:opacity-50";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    ghost: "text-gray-500 hover:bg-gray-100"
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
};

type UploadTab = 'furniture' | 'wall' | 'floor';

interface DecorationUploadCenterProps {
  onClose: () => void;
  onSaveFurniture: (furniture: any, modelData?: any) => void;
  onSaveWall: (wall: any) => void;
  onSaveFloor: (floor: any) => void;
}

export const DecorationUploadCenter: React.FC<DecorationUploadCenterProps> = ({ 
  onClose, 
  onSaveFurniture, 
  onSaveWall, 
  onSaveFloor 
}) => {
  const [activeTab, setActiveTab] = useState<UploadTab>('furniture');

  const tabs: { id: UploadTab; label: string; icon: typeof Package }[] = [
    { id: 'furniture', label: '上傳家具', icon: Package },
    { id: 'wall', label: '上傳牆壁', icon: Layers },
    { id: 'floor', label: '上傳地板', icon: Square },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Tab Header */}
      <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all
              ${activeTab === tab.id 
                ? 'bg-white shadow-sm text-indigo-700' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'furniture' && (
          <FurnitureUploadTab onClose={onClose} onSave={onSaveFurniture} />
        )}
        {activeTab === 'wall' && (
          <WallUploadTab onClose={onClose} onSave={onSaveWall} />
        )}
        {activeTab === 'floor' && (
          <FloorUploadTab onClose={onClose} onSave={onSaveFloor} />
        )}
      </div>
    </div>
  );
};

// ==================== ISOMETRIC ROOM PREVIEW ====================
const IsometricRoomPreview = ({ 
  furnitureImage, 
  dims, 
  spriteOffsetY 
}: { 
  furnitureImage: string | null; 
  dims: { ns: number; ew: number }; 
  spriteOffsetY: number;
}) => {
  const GRID_SIZE = 10;
  const TILE_W = 20;
  const TILE_H = 10;
  const CANVAS_WIDTH = 280;
  const CANVAS_HEIGHT = 180;
  
  // Center position
  const centerX = CANVAS_WIDTH / 2;
  const centerY = 40;
  
  // Convert grid coords to isometric screen coords
  const toIso = (gx: number, gy: number) => ({
    x: centerX + (gx - gy) * (TILE_W / 2),
    y: centerY + (gx + gy) * (TILE_H / 2)
  });
  
  // Calculate furniture position (center of room)
  const furnitureGX = Math.floor((GRID_SIZE - dims.ew) / 2);
  const furnitureGY = Math.floor((GRID_SIZE - dims.ns) / 2);
  
  // Get the bottom-center of the furniture footprint for positioning
  const footprintCenterX = furnitureGX + dims.ew / 2;
  const footprintBottomY = furnitureGY + dims.ns;
  const furniturePos = toIso(footprintCenterX, footprintBottomY);
  
  // Calculate furniture size based on grid
  const baseSize = Math.max(dims.ew, dims.ns) * TILE_W * 1.5;
  
  return (
    <div className="relative bg-gradient-to-b from-slate-100 to-slate-200 rounded-lg overflow-hidden" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
      {/* Grid pattern background */}
      <svg className="absolute inset-0" width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        {/* Draw floor tiles */}
        {Array.from({ length: GRID_SIZE }).map((_, gx) =>
          Array.from({ length: GRID_SIZE }).map((_, gy) => {
            const { x, y } = toIso(gx, gy);
            const isFootprint = 
              gx >= furnitureGX && gx < furnitureGX + dims.ew &&
              gy >= furnitureGY && gy < furnitureGY + dims.ns;
            
            return (
              <polygon
                key={`${gx}-${gy}`}
                points={`
                  ${x},${y}
                  ${x + TILE_W/2},${y + TILE_H/2}
                  ${x},${y + TILE_H}
                  ${x - TILE_W/2},${y + TILE_H/2}
                `}
                fill={isFootprint ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.5)'}
                stroke={isFootprint ? '#6366f1' : '#cbd5e1'}
                strokeWidth={isFootprint ? 1.5 : 0.5}
              />
            );
          })
        )}
        
        {/* Draw left wall (back) */}
        {Array.from({ length: GRID_SIZE }).map((_, i) => {
          const { x, y } = toIso(0, i);
          return (
            <polygon
              key={`lwall-${i}`}
              points={`
                ${x - TILE_W/2},${y + TILE_H/2}
                ${x - TILE_W/2},${y + TILE_H/2 - 30}
                ${x},${y - 30}
                ${x},${y}
              `}
              fill="rgba(148, 163, 184, 0.4)"
              stroke="#94a3b8"
              strokeWidth={0.5}
            />
          );
        })}
        
        {/* Draw right wall (back) */}
        {Array.from({ length: GRID_SIZE }).map((_, i) => {
          const { x, y } = toIso(i, 0);
          return (
            <polygon
              key={`rwall-${i}`}
              points={`
                ${x + TILE_W/2},${y + TILE_H/2}
                ${x + TILE_W/2},${y + TILE_H/2 - 30}
                ${x},${y - 30}
                ${x},${y}
              `}
              fill="rgba(100, 116, 139, 0.4)"
              stroke="#64748b"
              strokeWidth={0.5}
            />
          );
        })}
      </svg>
      
      {/* Furniture sprite */}
      {furnitureImage && (
        <img
          src={furnitureImage}
          alt="Furniture Preview"
          className="absolute drop-shadow-lg"
          style={{
            left: furniturePos.x - baseSize / 2,
            top: furniturePos.y - baseSize + spriteOffsetY * 0.3,
            width: baseSize,
            height: baseSize,
            objectFit: 'contain',
            imageRendering: 'auto'
          }}
        />
      )}
      
      {/* Info overlay */}
      <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] text-slate-500">
        <span>格數: {dims.ew}x{dims.ns}</span>
        <span>偏移: {spriteOffsetY}px</span>
      </div>
      
      {!furnitureImage && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
          請先上傳圖片
        </div>
      )}
    </div>
  );
};
const FurnitureUploadTab = ({ onClose, onSave }) => {
  const [images, setImages] = useState([null, null, null, null]);
  const [conditionImages, setConditionImages] = useState(['', '', '', '']);
  const [dims, setDims] = useState({ ns: 1, ew: 1 });
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [refPrice, setRefPrice] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [spriteOffsetY, setSpriteOffsetY] = useState(20);
  const [correctionPrompt, setCorrectionPrompt] = useState('');
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [history, setHistory] = useState([{ id: 'init', name: '#1 初始空白', images: [null, null, null, null], filter: '' }]);
  // Track which directions are manually uploaded (index: 0=South, 1=West, 2=North, 3=East)
  const [manuallyUploaded, setManuallyUploaded] = useState<boolean[]>([false, false, false, false]);
  // Background removal state
  const [showBgRemoval, setShowBgRemoval] = useState(false);
  const [bgRemovalImageIndex, setBgRemovalImageIndex] = useState<number | null>(null);
  
  const conditionLabels = ['正面(全新)', '正面有塵(閒置)', '正面封存(閒置久)', '正面破損(過久)'];
  
  const [isUploading, setIsUploading] = useState(false);
  
  const handleBgRemoval = (index: number) => {
    setBgRemovalImageIndex(index);
    setShowBgRemoval(true);
  };
  
  const handleBgRemovalApply = async (processedDataUrl: string) => {
    if (bgRemovalImageIndex === null) return;
    
    setIsUploading(true);
    setShowBgRemoval(false);
    
    try {
      // Convert data URL to File and re-upload
      const file = dataUrlToFile(processedDataUrl, `furniture_${Date.now()}.png`);
      const url = await uploadImageToSupabase(file, 'custom-furniture');
      
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
    const url = await uploadImageToSupabase(file, 'custom-furniture');
    setIsUploading(false);
    
    if (url) {
      const newImages = [...images];
      const newManuallyUploaded = [...manuallyUploaded];
      
      newImages[index] = url;
      newManuallyUploaded[index] = true;
      
      // Auto-flip logic:
      // South (0) -> West (1): if West not manually uploaded, auto-flip South
      // North (2) -> East (3): if East not manually uploaded, auto-flip North
      if (index === 0 && !newManuallyUploaded[1]) {
        // Uploading South, auto-generate West
        try {
          const flippedUrl = await flipImageHorizontally(url);
          newImages[1] = flippedUrl;
        } catch (err) {
          console.error('Failed to auto-flip image for West:', err);
        }
      } else if (index === 2 && !newManuallyUploaded[3]) {
        // Uploading North, auto-generate East
        try {
          const flippedUrl = await flipImageHorizontally(url);
          newImages[3] = flippedUrl;
        } catch (err) {
          console.error('Failed to auto-flip image for East:', err);
        }
      }
      
      setImages(newImages);
      setManuallyUploaded(newManuallyUploaded);
      addHistory(`#${history.length + 1} 上傳圖片`, newImages, "");
    }
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
  
  const addHistory = (label, imgs, filter) => {
    setHistory(prev => [...prev, { id: Date.now(), name: label, images: imgs, filter: filter }]);
  };
  
  const restoreVersion = (version) => {
    setImages(version.images);
  };
  
  useEffect(() => {
    if (!name) return;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const autoPrice = (Math.abs(hash) % 50) * 10 + 50;
    setRefPrice(autoPrice);
    if (price === 0) setPrice(autoPrice);
  }, [name]);
  
  const handleAICorrection = () => {
    if (!correctionPrompt) return;
    setIsAIProcessing(true);
    setAiMessage("AI 正在分析圖片結構...");
    const randomFilters = ["contrast(1.2) brightness(1.1)", "sepia(0.3) contrast(1.1)", "saturate(1.5) hue-rotate(10deg)", "grayscale(0.2) brightness(1.2)"];
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
    if (!name || !images[0]) {
      alert("請至少輸入名稱並上傳第一張圖片（南方）");
      return;
    }
    const finalImages = images.map(img => img || images[0]);
    const newFurniture = {
      id: `custom_${Date.now()}`,
      name,
      icon: null, // Don't store React components - use null for safe serialization
      cost: parseInt(String(price)) || refPrice,
      desc: "管理員上傳的自定義家具",
      type: 'sprite',
      size: [parseInt(String(dims.ew)) || 1, parseInt(String(dims.ns)) || 1],
      spriteImages: finalImages,
      conditionImages: conditionImages,
      spriteOffsetY: spriteOffsetY
    };
    onSave(newFurniture);
  };

  return (
    <div className="h-full flex gap-4 overflow-hidden">
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
        {/* Direction images and preview */}
        <div className="flex gap-4 h-[350px]">
          <div className="w-1/2 grid grid-cols-2 gap-2">
            {['南方 (正面)', '西方 (左側)', '北方 (背面)', '東方 (右側)'].map((label, idx) => {
              // Check if this direction uses auto-flip
              const isAutoFlipped = (idx === 1 && images[1] && !manuallyUploaded[1]) || 
                                    (idx === 3 && images[3] && !manuallyUploaded[3]);
              
              return (
                <div key={idx} className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center relative hover:bg-white transition-colors group
                  ${isAutoFlipped ? 'border-emerald-300 bg-emerald-50' : 'border-gray-300 bg-gray-50'}`}>
                  {isUploading && !images[idx] ? (
                    <div className="text-indigo-500 flex flex-col items-center">
                      <Loader2 size={24} className="mb-2 animate-spin"/>
                      <span className="text-xs">上傳中...</span>
                    </div>
                  ) : images[idx] ? (
                    <img src={images[idx]} alt={label} className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="text-gray-400 flex flex-col items-center">
                      <Upload size={24} className="mb-2"/>
                      <span className="text-xs">{label}</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleImageUpload(idx, e)} disabled={isUploading} />
                  {images[idx] && (
                    <>
                      <div className={`absolute top-1 right-1 text-white text-[10px] px-1 rounded ${isAutoFlipped ? 'bg-emerald-500' : 'bg-black/50'}`}>
                        {isAutoFlipped ? '自動翻轉' : label}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleBgRemoval(idx); }}
                        className="absolute bottom-1 right-1 bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                        title="去除白色背景"
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
            <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
            <div className="relative z-10 transition-all duration-300" style={{ transform: 'scale(1.5)' }}>
              {images[rotation] ? (
                <img src={images[rotation]} alt="Preview" className="max-w-[150px] max-h-[150px] drop-shadow-xl" />
              ) : (
                <div className="text-gray-400 text-xs">暫無預覽圖片</div>
              )}
              <div className="mt-4 bg-black/10 px-3 py-1 rounded-full text-xs font-mono text-gray-600 text-center">
                面向: {['南', '西', '北', '東'][rotation]}
              </div>
            </div>
            <div className="absolute bottom-4 flex gap-2">
              <Button variant="ghost" onClick={() => setRotation((r) => (r - 1 + 4) % 4)}><RotateCcw size={16} className="scale-x-[-1]"/></Button>
              <Button variant="ghost" onClick={() => setRotation((r) => (r + 1) % 4)}><RotateCcw size={16}/></Button>
            </div>
          </div>
        </div>

        {/* Condition images */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
          <h3 className="font-bold text-slate-700 flex items-center gap-2"><ImageIcon size={16}/> 家具狀態圖片</h3>
          <div className="grid grid-cols-4 gap-2">
            {conditionLabels.map((label, idx) => (
              <div key={idx} className="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center relative bg-gray-50 hover:bg-white transition-colors group h-24">
                {conditionImages[idx] ? (
                  <img src={conditionImages[idx]} alt={label} className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-gray-400 flex flex-col items-center p-1">
                    <Upload size={16} className="mb-1"/>
                    <span className="text-[10px] text-center leading-tight">{label}</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleConditionImageUpload(idx, e)} />
                {conditionImages[idx] && <div className="absolute top-1 right-1 bg-black/50 text-white text-[8px] px-1 rounded">{label}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Settings row with preview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><Settings size={16}/> 規格設定</h3>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 w-16">佔地格數</label>
              <input type="number" min="1" max="5" value={dims.ns} onChange={e => setDims({...dims, ns: e.target.value})} className="w-16 border rounded p-1 text-center text-sm"/>
              <span className="text-slate-400">x</span>
              <input type="number" min="1" max="5" value={dims.ew} onChange={e => setDims({...dims, ew: e.target.value})} className="w-16 border rounded p-1 text-center text-sm"/>
              <span className="text-xs text-slate-400 ml-2">(南北 x 東西)</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <label className="text-xs font-bold text-slate-500 w-16">垂直偏移</label>
              <input 
                type="range" 
                min="-50" 
                max="100" 
                value={spriteOffsetY} 
                onChange={e => setSpriteOffsetY(parseInt(e.target.value))} 
                className="flex-1"
              />
              <span className="text-xs text-slate-600 w-12 text-right">{spriteOffsetY}px</span>
            </div>
            <p className="text-[10px] text-slate-400">調整家具與地面的對齊位置，數值越大家具越往下</p>
          </div>
          
          {/* 10x10 Isometric Room Preview */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><Home size={16}/> 房間預覽 (10x10)</h3>
            <IsometricRoomPreview 
              furnitureImage={images[rotation]}
              dims={{ ns: parseInt(String(dims.ns)) || 1, ew: parseInt(String(dims.ew)) || 1 }}
              spriteOffsetY={spriteOffsetY}
            />
          </div>
        </div>
        
        {/* AI Correction */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
          <h3 className="font-bold text-slate-700 flex items-center gap-2"><Wand2 size={16}/> AI 修正 (模擬)</h3>
          <div className="flex gap-2">
            <input type="text" placeholder="例如: 去背, 調亮, 風格化..." value={correctionPrompt} onChange={e => setCorrectionPrompt(e.target.value)} className="flex-1 border rounded p-2 text-xs" />
            <Button variant="primary" className="px-3 py-1 text-xs" onClick={handleAICorrection} disabled={isAIProcessing}>
              {isAIProcessing ? <Loader2 className="animate-spin" size={14}/> : "修正"}
            </Button>
          </div>
          {aiMessage && <div className="text-xs text-emerald-600 font-bold">{aiMessage}</div>}
        </div>

        {/* Name and price */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500 block mb-1">家具名稱</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="給家具取個名字..." className="w-full border rounded p-2 text-sm"/>
            </div>
            <div className="w-1/3">
              <label className="text-xs font-bold text-slate-500 block mb-1">定價 (參考: ${refPrice})</label>
              <div className="relative">
                <DollarSign size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full border rounded p-2 pl-6 text-sm"/>
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-100 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button variant="primary" onClick={handleSave} icon={Package}>上架家具</Button>
          </div>
        </div>
      </div>

      {/* Version history sidebar */}
      <div className="w-48 bg-slate-50 border-l p-4 flex flex-col gap-2 overflow-y-auto shrink-0">
        <h4 className="font-bold text-xs text-slate-500 uppercase flex items-center gap-1"><History size={12}/> 版本歷史</h4>
        {history.map((h) => (
          <div key={h.id} onClick={() => restoreVersion(h)} className="p-3 bg-white border rounded-xl cursor-pointer hover:border-indigo-400 text-xs shadow-sm active:scale-95 transition-all group">
            <div className="font-bold text-indigo-600 mb-1">{h.name}</div>
            <div className="grid grid-cols-2 gap-0.5 opacity-50 group-hover:opacity-100">
              {h.images.slice(0,4).map((img, idx) => (
                <div key={idx} className="w-full h-8 bg-slate-100 rounded overflow-hidden">
                  {img && <img src={img} className="w-full h-full object-cover" style={{filter: h.filter}}/>}
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
          onClose={() => { setShowBgRemoval(false); setBgRemovalImageIndex(null); }}
          onApply={handleBgRemovalApply}
        />
      )}
    </div>
  );
};

// ==================== WALL UPLOAD TAB ====================
const WallUploadTab = ({ onClose, onSave }) => {
  const [lightImage, setLightImage] = useState<string | null>(null);
  const [darkImage, setDarkImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(100);
  // Track if dark image was manually uploaded
  const [darkManuallyUploaded, setDarkManuallyUploaded] = useState(false);

  const [isUploading, setIsUploading] = useState(false);

  const handleLightImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const url = await uploadImageToSupabase(file, 'walls');
    setIsUploading(false);
    
    if (url) {
      setLightImage(url);
      // Auto-generate dark image if not manually uploaded
      if (!darkManuallyUploaded) {
        try {
          const flippedDarkUrl = await flipAndDarkenImage(url);
          setDarkImage(flippedDarkUrl);
        } catch (err) {
          console.error('Failed to auto-generate dark wall image:', err);
        }
      }
    }
  };

  const handleDarkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const url = await uploadImageToSupabase(file, 'walls');
    setIsUploading(false);
    
    if (url) {
      setDarkImage(url);
      setDarkManuallyUploaded(true);
    }
  };

  const handleSave = () => {
    if (!name || !lightImage) {
      alert("請輸入名稱並上傳光面牆壁圖片");
      return;
    }
    const newWall = {
      id: `wall_${Date.now()}`,
      name,
      cost: parseInt(String(price)) || 100,
      lightImage,
      darkImage: darkImage || lightImage,
    };
    onSave(newWall);
    onClose();
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      {/* Upload areas */}
      <div className="grid grid-cols-2 gap-6">
        {/* Light side wall */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Layers size={16}/> 光面牆壁 (左側/亮面)
          </h3>
          <div className="border-2 border-dashed border-gray-300 rounded-xl h-64 flex flex-col items-center justify-center relative bg-gray-50 hover:bg-white transition-colors">
            {lightImage ? (
              <img src={lightImage} alt="Light Wall" className="w-full h-full object-contain p-4" />
            ) : (
              <div className="text-gray-400 flex flex-col items-center">
                <Upload size={32} className="mb-2"/>
                <span className="text-sm">點擊上傳光面牆壁</span>
                <span className="text-xs text-gray-300 mt-1">建議尺寸: 512x512</span>
              </div>
            )}
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleLightImageUpload} />
          </div>
        </div>

        {/* Dark side wall */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Layers size={16}/> 暗面牆壁 (右側/暗面)
            {darkImage && !darkManuallyUploaded && (
              <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">自動生成</span>
            )}
          </h3>
          <div className={`border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center relative transition-colors
            ${darkImage && !darkManuallyUploaded 
              ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100' 
              : 'border-gray-300 bg-gray-50 hover:bg-white'}`}>
            {darkImage ? (
              <>
                <img src={darkImage} alt="Dark Wall" className="w-full h-full object-contain p-4" />
                {!darkManuallyUploaded && (
                  <div className="absolute bottom-2 left-2 right-2 text-center text-xs text-emerald-600">
                    點擊可自訂
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-400 flex flex-col items-center">
                <Upload size={32} className="mb-2"/>
                <span className="text-sm">點擊上傳暗面牆壁</span>
                <span className="text-xs text-gray-300 mt-1">或上傳光面後自動生成</span>
              </div>
            )}
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleDarkImageUpload} />
          </div>
        </div>
      </div>

      {/* Preview section */}
      <div className="bg-slate-100 rounded-xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Home size={16}/> 牆壁預覽
        </h3>
        <div className="flex justify-center items-end gap-1">
          {/* Isometric wall preview */}
          <svg width="300" height="200" viewBox="0 0 300 200">
            <defs>
              <pattern id="lightWallPattern" patternUnits="objectBoundingBox" width="1" height="1">
                {lightImage && <image href={lightImage} width="150" height="150" preserveAspectRatio="xMidYMid slice"/>}
              </pattern>
              <pattern id="darkWallPattern" patternUnits="objectBoundingBox" width="1" height="1">
                {(darkImage || lightImage) && <image href={darkImage || lightImage} width="150" height="150" preserveAspectRatio="xMidYMid slice"/>}
              </pattern>
            </defs>
            
            {/* Left wall (light) */}
            <path 
              d="M50 150 L150 100 L150 50 L50 100 Z" 
              fill={lightImage ? "url(#lightWallPattern)" : "#5DC9BF"}
              stroke="#2D8B81"
              strokeWidth="2"
            />
            {/* Right wall (dark) */}
            <path 
              d="M150 100 L250 150 L250 100 L150 50 Z" 
              fill={(darkImage || lightImage) ? "url(#darkWallPattern)" : "#4AA89E"}
              stroke="#2D8B81"
              strokeWidth="2"
              style={{ filter: 'brightness(0.85)' }}
            />
            {/* Floor base */}
            <path 
              d="M50 150 L150 200 L250 150 L150 100 Z" 
              fill="#E8D5C4"
              stroke="#C4A882"
              strokeWidth="1"
            />
            
            {/* Labels */}
            <text x="80" y="90" fill="#fff" fontSize="12" fontWeight="bold">光面</text>
            <text x="180" y="90" fill="#fff" fontSize="12" fontWeight="bold">暗面</text>
          </svg>
        </div>
      </div>

      {/* Name and price */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-500 block mb-1">牆壁名稱</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="給牆壁取個名字..." className="w-full border rounded p-2 text-sm"/>
          </div>
          <div className="w-1/3">
            <label className="text-xs font-bold text-slate-500 block mb-1">定價</label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input type="number" value={price} onChange={e => setPrice(parseInt(e.target.value) || 0)} className="w-full border rounded p-2 pl-6 text-sm"/>
            </div>
          </div>
        </div>
        <div className="pt-2 border-t border-gray-100 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={handleSave} icon={Layers}>上架牆壁</Button>
        </div>
      </div>
    </div>
  );
};

// ==================== FLOOR UPLOAD TAB ====================

/**
 * Transform a square front-facing image to 30-degree isometric projection
 * Creates a 2:1 aspect ratio diamond shape
 */
const transformToIsometric = async (
  imageUrl: string, 
  outputSize: number = 512
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Output dimensions (2:1 ratio for isometric)
      const outWidth = outputSize;
      const outHeight = outputSize / 2;
      
      const canvas = document.createElement('canvas');
      canvas.width = outWidth;
      canvas.height = outHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Isometric transformation parameters
      const cos30 = Math.cos(Math.PI / 6);  // ≈ 0.866
      const sin30 = Math.sin(Math.PI / 6);  // = 0.5
      
      // Scale factor to fill output (based on input image size)
      const inputSize = Math.max(img.width, img.height);
      const scale = outWidth / (inputSize * 2 * cos30);
      
      // Move to center top for proper positioning
      ctx.translate(outWidth / 2, 0);
      
      // Apply isometric transformation matrix
      // [a, b, c, d, e, f] where:
      // x' = a*x + c*y + e
      // y' = b*x + d*y + f
      ctx.transform(
        cos30 * scale,   // a: X axis X component
        sin30 * scale,   // b: X axis Y component
        -cos30 * scale,  // c: Y axis X component
        sin30 * scale,   // d: Y axis Y component
        0,               // e: X offset
        0                // f: Y offset
      );
      
      // Draw the source image (will be transformed)
      // Center the image if not square
      const offsetX = (inputSize - img.width) / 2;
      const offsetY = (inputSize - img.height) / 2;
      ctx.drawImage(img, -offsetX, -offsetY, img.width, img.height);
      
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
};

const FloorUploadTab = ({ onClose, onSave }) => {
  const [floorImage, setFloorImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(80);
  const [uploadMode, setUploadMode] = useState<'direct' | 'transform'>('transform');
  const [isTransforming, setIsTransforming] = useState(false);

  const [isUploading, setIsUploading] = useState(false);

  const handleFloorImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const url = await uploadImageToSupabase(file, 'floors');
    setIsUploading(false);
    
    if (!url) return;
    
    if (uploadMode === 'transform') {
      // Store original and transform to isometric
      setOriginalImage(url);
      setIsTransforming(true);
      try {
        const isometricUrl = await transformToIsometric(url, 512);
        setFloorImage(isometricUrl);
      } catch (err) {
        console.error('Failed to transform image:', err);
        // Fallback to original if transform fails
        setFloorImage(url);
      }
      setIsTransforming(false);
    } else {
      // Direct mode - use as-is
      setFloorImage(url);
      setOriginalImage(null);
    }
  };

  const handleSave = () => {
    if (!name || !floorImage) {
      alert("請輸入名稱並上傳地板圖片");
      return;
    }
    const newFloor = {
      id: `floor_${Date.now()}`,
      name,
      cost: parseInt(String(price)) || 80,
      image: floorImage,
    };
    onSave(newFloor);
    onClose();
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      {/* Upload mode selector */}
      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Settings size={16}/> 上傳模式
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setUploadMode('transform')}
            className={`flex-1 p-3 rounded-lg border-2 transition-all text-sm ${
              uploadMode === 'transform' 
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                : 'border-gray-200 hover:border-gray-300 text-gray-600'
            }`}
          >
            <Wand2 size={16} className="mx-auto mb-1"/>
            <div className="font-medium">上傳正面圖案</div>
            <div className="text-xs opacity-75">自動轉換為等角投影</div>
          </button>
          <button
            onClick={() => setUploadMode('direct')}
            className={`flex-1 p-3 rounded-lg border-2 transition-all text-sm ${
              uploadMode === 'direct' 
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                : 'border-gray-200 hover:border-gray-300 text-gray-600'
            }`}
          >
            <ImageIcon size={16} className="mx-auto mb-1"/>
            <div className="font-medium">直接上傳等角圖</div>
            <div className="text-xs opacity-75">已處理好的圖片</div>
          </button>
        </div>
      </div>

      {/* Upload area */}
      <div className="space-y-3">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <Square size={16}/> 地板紋理
          {uploadMode === 'transform' && (
            <span className="text-xs font-normal text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
              自動轉換模式
            </span>
          )}
        </h3>
        
        {uploadMode === 'transform' ? (
          // Transform mode: show original + converted side by side
          <div className="flex gap-4">
            {/* Original upload area */}
            <div className="flex-1">
              <div className="text-xs font-medium text-slate-500 mb-2 text-center">原始圖案 (正方形)</div>
              <div className="border-2 border-dashed border-gray-300 rounded-xl h-48 flex flex-col items-center justify-center relative bg-gray-50 hover:bg-white transition-colors">
                {isUploading ? (
                  <div className="text-indigo-500 flex flex-col items-center">
                    <Loader2 size={24} className="mb-2 animate-spin"/>
                    <span className="text-xs">上傳中...</span>
                  </div>
                ) : originalImage ? (
                  <img src={originalImage} alt="Original" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-gray-400 flex flex-col items-center">
                    <Upload size={24} className="mb-2"/>
                    <span className="text-sm">點擊上傳</span>
                    <span className="text-xs text-gray-300 mt-1">建議: 正方形圖片</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFloorImageUpload} />
              </div>
            </div>
            
            {/* Arrow */}
            <div className="flex items-center justify-center pt-6">
              <div className="text-slate-400">
                {isTransforming ? (
                  <Loader2 size={24} className="animate-spin"/>
                ) : (
                  <Wand2 size={24}/>
                )}
              </div>
            </div>
            
            {/* Converted preview */}
            <div className="flex-1">
              <div className="text-xs font-medium text-slate-500 mb-2 text-center">等角投影結果</div>
              <div className={`border-2 rounded-xl h-48 flex flex-col items-center justify-center ${
                floorImage ? 'border-emerald-300 bg-emerald-50' : 'border-dashed border-gray-300 bg-gray-50'
              }`}>
                {isTransforming ? (
                  <div className="text-indigo-500 flex flex-col items-center">
                    <Loader2 size={24} className="mb-2 animate-spin"/>
                    <span className="text-xs">轉換中...</span>
                  </div>
                ) : floorImage ? (
                  <>
                    <img src={floorImage} alt="Isometric" className="w-full h-full object-contain p-2" />
                    <div className="absolute bottom-2 left-0 right-0 text-center">
                      <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded">自動生成</span>
                    </div>
                  </>
                ) : (
                  <div className="text-gray-300 flex flex-col items-center">
                    <Square size={24} className="mb-2"/>
                    <span className="text-xs">等待轉換</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Direct mode: single upload area
          <div className="border-2 border-dashed border-gray-300 rounded-xl h-64 flex flex-col items-center justify-center relative bg-gray-50 hover:bg-white transition-colors">
            {isUploading ? (
              <div className="text-indigo-500 flex flex-col items-center">
                <Loader2 size={24} className="mb-2 animate-spin"/>
                <span className="text-xs">上傳中...</span>
              </div>
            ) : floorImage ? (
              <img src={floorImage} alt="Floor" className="w-full h-full object-contain p-4" />
            ) : (
              <div className="text-gray-400 flex flex-col items-center">
                <Upload size={32} className="mb-2"/>
                <span className="text-sm">點擊上傳地板紋理</span>
                <span className="text-xs text-gray-300 mt-1">建議尺寸: 512x256 (2:1 等角比例)</span>
              </div>
            )}
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFloorImageUpload} />
          </div>
        )}
      </div>

      {/* Preview section */}
      <div className="bg-slate-100 rounded-xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Home size={16}/> 地板預覽
        </h3>
        <div className="flex justify-center">
          {/* Isometric floor preview */}
          <svg width="300" height="200" viewBox="0 0 300 200">
            <defs>
              <pattern id="floorPattern" patternUnits="userSpaceOnUse" width="60" height="35">
                {floorImage && <image href={floorImage} width="60" height="35" preserveAspectRatio="xMidYMid slice"/>}
              </pattern>
            </defs>
            
            {/* Floor diamond */}
            <path 
              d="M50 100 L150 50 L250 100 L150 150 Z" 
              fill={floorImage ? "url(#floorPattern)" : "#E8D5C4"}
              stroke="#C4A882"
              strokeWidth="2"
            />
            
            {/* Grid lines for texture */}
            {!floorImage && (
              <>
                <line x1="100" y1="75" x2="200" y2="125" stroke="#C4A882" strokeWidth="1" opacity="0.5"/>
                <line x1="100" y1="125" x2="200" y2="75" stroke="#C4A882" strokeWidth="1" opacity="0.5"/>
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Name and price */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-500 block mb-1">地板名稱</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="給地板取個名字..." className="w-full border rounded p-2 text-sm"/>
          </div>
          <div className="w-1/3">
            <label className="text-xs font-bold text-slate-500 block mb-1">定價</label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input type="number" value={price} onChange={e => setPrice(parseInt(e.target.value) || 0)} className="w-full border rounded p-2 pl-6 text-sm"/>
            </div>
          </div>
        </div>
        <div className="pt-2 border-t border-gray-100 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={handleSave} icon={Square}>上架地板</Button>
        </div>
      </div>
    </div>
  );
};
