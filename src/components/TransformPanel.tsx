import React from "react";
import {
  Move,
  Maximize2,
  MoveVertical,
  Sliders,
  RotateCcw,
  Save,
  X,
  ChevronLeft,
} from "lucide-react";

interface TransformData {
  spriteOffsetX: number;
  spriteOffsetY: number;
  spriteScale: number;
  spriteScaleX: number;
  spriteScaleY: number;
  spriteSkewX: number;
  spriteSkewY: number;
}

interface TransformPanelProps {
  furnitureName: string;
  furnitureImage?: string;
  data: TransformData;
  onChange: (data: Partial<TransformData>) => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
}

const SliderControl = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  warning,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  warning?: string;
}) => (
  <div className="space-y-1">
    <div className="flex justify-between items-center">
      <label className="text-xs font-medium text-slate-300">{label}</label>
      <span className="text-xs font-mono text-indigo-400">
        {value.toFixed(step < 1 ? 1 : 0)}{unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
    />
    {warning && (
      <p className="text-[10px] text-amber-400">{warning}</p>
    )}
  </div>
);

const QuickButton = ({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`px-2 py-1 text-[10px] rounded font-medium transition-colors ${active
        ? "bg-indigo-500 text-white"
        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
      }`}
  >
    {label}
  </button>
);

export const TransformPanel: React.FC<TransformPanelProps> = ({
  furnitureName,
  furnitureImage,
  data,
  onChange,
  onSave,
  onCancel,
  onReset,
}) => {
  const defaultData: TransformData = {
    spriteOffsetX: 0,
    spriteOffsetY: 20,
    spriteScale: 1,
    spriteScaleX: 100,
    spriteScaleY: 100,
    spriteSkewX: 0,
    spriteSkewY: 0,
  };

  return (
    <div
      className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col h-full"
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <h2 className="text-white font-bold text-sm">變形控制台</h2>
            <p className="text-slate-400 text-xs">Transform Panel</p>
          </div>
        </div>

        {/* Furniture Preview */}
        <div className="bg-slate-700/50 rounded-lg p-3 flex items-center gap-3">
          {furnitureImage ? (
            <img
              src={furnitureImage}
              alt={furnitureName}
              className="w-12 h-12 object-contain rounded"
            />
          ) : (
            <div className="w-12 h-12 bg-slate-600 rounded flex items-center justify-center">
              <Sliders size={20} className="text-slate-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm truncate">{furnitureName}</p>
            <p className="text-slate-400 text-xs">精細調整模式</p>
          </div>
        </div>
      </div>

      {/* Scrollable Controls Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Section 1: Position */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-indigo-400">
            <Move size={14} />
            <span className="text-xs font-bold uppercase tracking-wide">第一區：基礎定位</span>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
            <SliderControl
              label="垂直偏移 (Offset Y)"
              value={data.spriteOffsetY}
              min={-50}
              max={100}
              unit="px"
              onChange={(v) => onChange({ spriteOffsetY: v })}
            />
            <SliderControl
              label="水平偏移 (Offset X)"
              value={data.spriteOffsetX}
              min={-50}
              max={50}
              unit="px"
              onChange={(v) => onChange({ spriteOffsetX: v })}
            />
            <p className="text-[10px] text-slate-500">用途：對齊地板格線</p>
          </div>
        </div>

        {/* Section 2: Overall Size */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <Maximize2 size={14} />
            <span className="text-xs font-bold uppercase tracking-wide">第二區：整體大小</span>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
            <SliderControl
              label="整體縮放 (Scale)"
              value={data.spriteScale}
              min={0.5}
              max={2.0}
              step={0.1}
              unit="x"
              onChange={(v) => onChange({ spriteScale: v })}
            />
            <p className="text-[10px] text-slate-500">用途：調整家具在場景中的視覺大小</p>
          </div>
        </div>

        {/* Section 3: Stretch */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <MoveVertical size={14} />
            <span className="text-xs font-bold uppercase tracking-wide">第三區：拉伸修正</span>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
            <div className="space-y-2">
              <SliderControl
                label="🔥 垂直拉伸 (Scale Y)"
                value={data.spriteScaleY}
                min={50}
                max={200}
                unit="%"
                onChange={(v) => onChange({ spriteScaleY: v })}
              />
              <div className="flex gap-1">
                <QuickButton
                  label="To 26.6° (86.6%)"
                  onClick={() => onChange({ spriteScaleY: 86.6 })}
                  active={Math.abs(data.spriteScaleY - 86.6) < 0.5}
                />
                <QuickButton
                  label="To 30° (115.5%)"
                  onClick={() => onChange({ spriteScaleY: 115.5 })}
                  active={Math.abs(data.spriteScaleY - 115.5) < 0.5}
                />
              </div>
            </div>
            <SliderControl
              label="水平拉伸 (Scale X)"
              value={data.spriteScaleX}
              min={50}
              max={150}
              unit="%"
              onChange={(v) => onChange({ spriteScaleX: v })}
              warning="通常保持 100%，除非修正寬度比例"
            />
            <p className="text-[10px] text-slate-500">用途：修正視角角度</p>
          </div>
        </div>

        {/* Section 4: Skew */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-rose-400">
            <Sliders size={14} />
            <span className="text-xs font-bold uppercase tracking-wide">第四區：傾斜修正 🔥NEW</span>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
            <SliderControl
              label="垂直傾斜 (Skew Y)"
              value={data.spriteSkewY}
              min={-45}
              max={45}
              unit="°"
              onChange={(v) => onChange({ spriteSkewY: v })}
            />
            <p className="text-[10px] text-slate-500">用途：拉高右側/壓低左側，修正「左右不平」的變形</p>

            <SliderControl
              label="水平傾斜 (Skew X)"
              value={data.spriteSkewX}
              min={-45}
              max={45}
              unit="°"
              onChange={(v) => onChange({ spriteSkewX: v })}
            />
            <p className="text-[10px] text-slate-500">用途：修正正面/側面的透視比例</p>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="p-4 border-t border-slate-700 space-y-2">
        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
        >
          <RotateCcw size={16} />
          重設 (Reset)
        </button>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
          >
            <X size={16} />
            取消
          </button>
          <button
            onClick={onSave}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save size={16} />
            保存並返回
          </button>
        </div>
      </div>
    </div>
  );
};
