import React, { useState } from "react";
import { PenTool, Loader2, Package, History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FURNITURE_MODELS } from "@/constants/furnitureCatalog";
import { FurnitureItem, FurnitureModel } from "@/types/furniture";

interface FurnitureStudioProps {
  onClose: () => void;
  onSave: (furniture: FurnitureItem, model: FurnitureModel[]) => void;
}

export const FurnitureStudio: React.FC<FurnitureStudioProps> = ({ onClose, onSave }) => {
  const [prompt, setPrompt] = useState("");
  const [modelJson, setModelJson] = useState(JSON.stringify(FURNITURE_MODELS.hk_stool, null, 2));
  const [itemName, setItemName] = useState("New Furniture");
  const [price, setPrice] = useState(100);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<Array<{ id: number; model: FurnitureModel[]; name: string }>>([]);

  const generateFromPrompt = (input: string): FurnitureModel[] => {
    const p = input.toLowerCase();
    let color = "#cbd5e1";
    if (p.includes("紅")) color = "#ef4444";
    else if (p.includes("藍")) color = "#3b82f6";
    else if (p.includes("木")) color = "#b45309";
    return [{ x: 0.1, y: 0.1, z: 0, w: 0.8, d: 0.8, h: 0.5, color: color }];
  };

  const handleGenerate = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const model = generateFromPrompt(prompt);
      setHistory((prev) => [...prev, { id: Date.now(), model, name: `版本 #${history.length + 1}` }]);
      setModelJson(JSON.stringify(model, null, 2));
      setIsAnalyzing(false);
    }, 1000);
  };

  const restoreVersion = (item: { id: number; model: FurnitureModel[]; name: string }) => {
    setModelJson(JSON.stringify(item.model, null, 2));
  };

  const handleSave = () => {
    const newFurniture: FurnitureItem = {
      id: `design_${Date.now()}`,
      name: itemName,
      icon: PenTool,
      cost: price,
      desc: "Designer Furniture",
      type: "geometric",
      size: [1, 1],
      height: 10,
      color: "#cbd5e1",
    };
    onSave(newFurniture, JSON.parse(modelJson));
    onClose();
  };

  return (
    <div className="h-full flex gap-4 p-2">
      <div className="flex-1 flex flex-col gap-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <PenTool /> 家具設計室 (Parametric)
        </h3>
        
        <div className="bg-white p-4 rounded-xl border space-y-3">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="輸入提示詞 (e.g. 紅色椅子)..."
            className="border p-2 rounded w-full text-sm"
          />
          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={isAnalyzing} className="flex-1">
              {isAnalyzing ? <Loader2 className="animate-spin" size={14} /> : "生成模型"}
            </Button>
          </div>
        </div>
        
        <div className="flex-1 bg-slate-100 rounded-xl flex items-center justify-center border">
          <div className="text-slate-400 text-sm">幾何預覽 (JSON驅動)</div>
        </div>
        
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSave} icon={Package}>
            儲存設計
          </Button>
        </div>
      </div>
      
      <div className="w-48 bg-slate-50 border-l p-4 flex flex-col gap-2 overflow-y-auto">
        <h4 className="font-bold text-xs text-slate-500 uppercase flex items-center gap-1">
          <History size={12} /> 版本歷史
        </h4>
        {history.length === 0 && <div className="text-xs text-slate-400 italic">暫無生成紀錄</div>}
        {history.map((h) => (
          <div
            key={h.id}
            onClick={() => restoreVersion(h)}
            className="p-2 bg-white border rounded cursor-pointer hover:border-indigo-400 text-xs shadow-sm active:scale-95 transition-all"
          >
            <div className="font-bold text-indigo-600">{h.name}</div>
            <div className="text-[10px] text-slate-400">JSON: {JSON.stringify(h.model).length} chars</div>
          </div>
        ))}
      </div>
    </div>
  );
};
