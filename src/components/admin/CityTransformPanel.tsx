import React, { useState, useEffect } from "react";
import { X, RotateCcw, Check, Sliders } from "lucide-react";
import type { CityTransformData } from "@/types/city";

interface CityTransformPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialTransform?: CityTransformData;
  itemName: string;
  customImageUrl?: string;
  onApply: (transform: CityTransformData) => void;
}

const DEFAULT_TRANSFORM: CityTransformData = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  scaleX: 100,
  scaleY: 100,
  rotation: 0,
};

export const CityTransformPanel: React.FC<CityTransformPanelProps> = ({
  isOpen,
  onClose,
  initialTransform,
  itemName,
  customImageUrl,
  onApply,
}) => {
  const [transform, setTransform] = useState<CityTransformData>({
    ...DEFAULT_TRANSFORM,
    ...initialTransform,
  });

  useEffect(() => {
    setTransform({
      ...DEFAULT_TRANSFORM,
      ...initialTransform,
    });
  }, [initialTransform]);

  const handleReset = () => {
    setTransform(DEFAULT_TRANSFORM);
  };

  const handleApply = () => {
    onApply(transform);
    onClose();
  };

  const updateTransform = (key: keyof CityTransformData, value: number) => {
    setTransform((prev) => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[420px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/50">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700/50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">精細調整模式</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Preview */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700/50">
            <div className="text-sm text-slate-400 mb-2 text-center">
              {itemName}
            </div>
            {customImageUrl && (
              <div className="flex justify-center">
                <img
                  src={customImageUrl}
                  alt={itemName}
                  className="max-w-32 max-h-32 object-contain"
                  style={{
                    transform: `scale(${transform.scale || 1}) scaleX(${(transform.scaleX || 100) / 100}) scaleY(${(transform.scaleY || 100) / 100}) rotate(${transform.rotation || 0}deg)`,
                  }}
                />
              </div>
            )}
          </div>

          {/* Section 1: Basic Positioning */}
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3 border-b border-slate-700 pb-1">
              基礎定位
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm text-slate-300">垂直偏移 (Offset Y)</label>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                    {transform.offsetY ?? 0}px
                  </span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={transform.offsetY ?? 0}
                  onChange={(e) => updateTransform("offsetY", parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm text-slate-300">水平偏移 (Offset X)</label>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                    {transform.offsetX ?? 0}px
                  </span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={transform.offsetX ?? 0}
                  onChange={(e) => updateTransform("offsetX", parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Overall Size */}
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3 border-b border-slate-700 pb-1">
              整體大小
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm text-slate-300">整體縮放 (Scale)</label>
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                  {(transform.scale ?? 1).toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min={0.3}
                max={3}
                step={0.1}
                value={transform.scale ?? 1}
                onChange={(e) => updateTransform("scale", parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>

          {/* Section 3: Stretch Correction */}
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3 border-b border-slate-700 pb-1">
              拉伸修正
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm text-slate-300">垂直拉伸 (Scale Y)</label>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                    {transform.scaleY ?? 100}%
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={200}
                  step={1}
                  value={transform.scaleY ?? 100}
                  onChange={(e) => updateTransform("scaleY", parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                {/* Preset buttons */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => updateTransform("scaleY", 86.6)}
                    className="flex-1 px-2 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                  >
                    等角 26.6° (86.6%)
                  </button>
                  <button
                    onClick={() => updateTransform("scaleY", 115.5)}
                    className="flex-1 px-2 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                  >
                    等角 30° (115.5%)
                  </button>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm text-slate-300">水平拉伸 (Scale X)</label>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                    {transform.scaleX ?? 100}%
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={200}
                  step={1}
                  value={transform.scaleX ?? 100}
                  onChange={(e) => updateTransform("scaleX", parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Rotation */}
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3 border-b border-slate-700 pb-1">
              旋轉
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm text-slate-300">旋轉角度</label>
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                  {transform.rotation ?? 0}°
                </span>
              </div>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={transform.rotation ?? 0}
                onChange={(e) => updateTransform("rotation", parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur border-t border-slate-700/50 px-4 py-3 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重設
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              套用變形
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
