import React from "react";
import {
    Move,
    Maximize2,
    MoveVertical,
    Sliders,
    Grid,
    RotateCcw,
    Save,
    X,
    ChevronLeft,
    Upload,
} from "lucide-react";

export interface TerrainTransformData {
    scale: number;
    offsetX: number;
    offsetY: number;
    anchorMultiplier: number;
    scaleX: number;
    scaleY: number;
    skewX: number;
    skewY: number;
}

interface TerrainTransformPanelProps {
    terrainName: string;
    terrainImage?: string;
    data: TerrainTransformData;
    onChange: (data: Partial<TerrainTransformData>) => void;
    onSave: () => void;
    onCancel: () => void;
    onReset: () => void;
    onImageUpload: (file: File) => void;
}

const SliderControl = ({
    label,
    value,
    min,
    max,
    step = 1,
    unit = "",
    onChange,
    description,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    onChange: (value: number) => void;
    description?: string;
}) => (
    <div className="space-y-1">
        <div className="flex justify-between items-center">
            <label className="text-xs font-medium text-slate-300">{label}</label>
            <div className="flex items-center gap-1">
                <input
                    type="number"
                    value={parseFloat(value.toFixed(2))}
                    step={0.01}
                    min={min}
                    max={max}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) onChange(val);
                    }}
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-right text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500 w-4">{unit}</span>
            </div>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        {description && (
            <p className="text-[10px] text-slate-500">{description}</p>
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
            ? "bg-emerald-500 text-white"
            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
    >
        {label}
    </button>
);

export const TerrainTransformPanel: React.FC<TerrainTransformPanelProps> = ({
    terrainName,
    terrainImage,
    data,
    onChange,
    onSave,
    onCancel,
    onReset,
    onImageUpload,
}) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onImageUpload(file);
        }
    };

    return (
        <div
            className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col h-full"
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
                        <h2 className="text-white font-bold text-sm">草地精細調整</h2>
                        <p className="text-slate-400 text-xs">Terrain Transform Panel</p>
                    </div>
                </div>

                {/* Terrain Preview & Replace */}
                <div className="bg-slate-700/50 rounded-lg p-3 flex items-center gap-3">
                    {terrainImage ? (
                        <img
                            src={terrainImage}
                            alt={terrainName}
                            className="w-12 h-12 object-contain rounded bg-slate-800"
                        />
                    ) : (
                        <div className="w-12 h-12 bg-slate-600 rounded flex items-center justify-center">
                            <Grid size={20} className="text-slate-400" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{terrainName}</p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-emerald-400 text-xs hover:text-emerald-300 flex items-center gap-1 mt-1 transition-colors"
                        >
                            <Upload size={10} /> 更換圖片
                        </button>
                    </div>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                />
            </div>

            {/* Scrollable Controls Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Section 1: Scale */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <Maximize2 size={14} />
                        <span className="text-xs font-bold uppercase tracking-wide">第一區：整體大小</span>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
                        <SliderControl
                            label="🔥 縮放比例 (Scale)"
                            value={data.scale}
                            min={1.0}
                            max={4.0}
                            step={0.05}
                            unit="x"
                            onChange={(v) => onChange({ scale: v })}
                            description="增大此值讓草地填滿格子"
                        />
                        <div className="flex gap-1 flex-wrap">
                            <QuickButton
                                label="1.5x"
                                onClick={() => onChange({ scale: 1.5 })}
                                active={Math.abs(data.scale - 1.5) < 0.05}
                            />
                            <QuickButton
                                label="2.0x"
                                onClick={() => onChange({ scale: 2.0 })}
                                active={Math.abs(data.scale - 2.0) < 0.05}
                            />
                            <QuickButton
                                label="2.1x"
                                onClick={() => onChange({ scale: 2.1 })}
                                active={Math.abs(data.scale - 2.1) < 0.05}
                            />
                            <QuickButton
                                label="2.5x"
                                onClick={() => onChange({ scale: 2.5 })}
                                active={Math.abs(data.scale - 2.5) < 0.05}
                            />
                            <QuickButton
                                label="3.0x"
                                onClick={() => onChange({ scale: 3.0 })}
                                active={Math.abs(data.scale - 3.0) < 0.05}
                            />
                        </div>
                    </div>
                </div>

                {/* Section 2: Position */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-indigo-400">
                        <Move size={14} />
                        <span className="text-xs font-bold uppercase tracking-wide">第二區：位置偏移</span>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
                        <SliderControl
                            label="水平偏移 (Offset X)"
                            value={data.offsetX}
                            min={-50}
                            max={50}
                            step={1}
                            unit="px"
                            onChange={(v) => onChange({ offsetX: v })}
                            description="左右移動草地位置"
                        />
                        <SliderControl
                            label="垂直偏移 (Offset Y)"
                            value={data.offsetY}
                            min={-50}
                            max={50}
                            step={1}
                            unit="px"
                            onChange={(v) => onChange({ offsetY: v })}
                            description="上下移動草地位置"
                        />
                    </div>
                </div>

                {/* Section 3: Anchor */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-400">
                        <Grid size={14} />
                        <span className="text-xs font-bold uppercase tracking-wide">第三區：錨點調整</span>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
                        <SliderControl
                            label="🔥 錨點乘數 (Anchor)"
                            value={data.anchorMultiplier}
                            min={0.3}
                            max={1.0}
                            step={0.01}
                            unit=""
                            onChange={(v) => onChange({ anchorMultiplier: v })}
                            description="調整草地的垂直對齊，讓底部對齊格線"
                        />
                        <div className="flex gap-1 flex-wrap">
                            <QuickButton
                                label="0.5"
                                onClick={() => onChange({ anchorMultiplier: 0.5 })}
                                active={Math.abs(data.anchorMultiplier - 0.5) < 0.02}
                            />
                            <QuickButton
                                label="0.6"
                                onClick={() => onChange({ anchorMultiplier: 0.6 })}
                                active={Math.abs(data.anchorMultiplier - 0.6) < 0.02}
                            />
                            <QuickButton
                                label="0.65"
                                onClick={() => onChange({ anchorMultiplier: 0.65 })}
                                active={Math.abs(data.anchorMultiplier - 0.65) < 0.02}
                            />
                            <QuickButton
                                label="0.7"
                                onClick={() => onChange({ anchorMultiplier: 0.7 })}
                                active={Math.abs(data.anchorMultiplier - 0.7) < 0.02}
                            />
                            <QuickButton
                                label="0.8"
                                onClick={() => onChange({ anchorMultiplier: 0.8 })}
                                active={Math.abs(data.anchorMultiplier - 0.8) < 0.02}
                            />
                        </div>
                    </div>
                </div>

                {/* Section 4: Stretch */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-400">
                        <MoveVertical size={14} />
                        <span className="text-xs font-bold uppercase tracking-wide">第四區：拉伸修正</span>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
                        <div className="space-y-2">
                            <SliderControl
                                label="🔥 垂直拉伸 (Scale Y)"
                                value={data.scaleY ?? 100}
                                min={50}
                                max={200}
                                unit="%"
                                onChange={(v) => onChange({ scaleY: v })}
                            />
                            <div className="flex gap-1">
                                <QuickButton
                                    label="To 26.6° (86.6%)"
                                    onClick={() => onChange({ scaleY: 86.6 })}
                                    active={Math.abs((data.scaleY ?? 100) - 86.6) < 0.5}
                                />
                                <QuickButton
                                    label="To 30° (115.5%)"
                                    onClick={() => onChange({ scaleY: 115.5 })}
                                    active={Math.abs((data.scaleY ?? 100) - 115.5) < 0.5}
                                />
                            </div>
                        </div>
                        <SliderControl
                            label="水平拉伸 (Scale X)"
                            value={data.scaleX ?? 100}
                            min={50}
                            max={150}
                            unit="%"
                            onChange={(v) => onChange({ scaleX: v })}
                            description="修正寬度比例"
                        />
                    </div>
                </div>

                {/* Section 5: Skew */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-rose-400">
                        <Sliders size={14} />
                        <span className="text-xs font-bold uppercase tracking-wide">第五區：傾斜修正</span>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
                        <SliderControl
                            label="垂直傾斜 (Skew Y)"
                            value={data.skewY ?? 0}
                            min={-45}
                            max={45}
                            unit="°"
                            onChange={(v) => onChange({ skewY: v })}
                            description="拉高右側/壓低左側"
                        />
                        <SliderControl
                            label="水平傾斜 (Skew X)"
                            value={data.skewX ?? 0}
                            min={-45}
                            max={45}
                            unit="°"
                            onChange={(v) => onChange({ skewX: v })}
                            description="修正透視比例"
                        />
                    </div>
                </div>

                {/* Help Section */}
                <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-3">
                    <p className="text-emerald-300 text-xs font-bold mb-2">💡 調整建議</p>
                    <ul className="text-[10px] text-emerald-200/70 space-y-1 list-disc list-inside">
                        <li>如果草地看起來太小，增加「縮放比例」</li>
                        <li>如果草地沒對齊格線，調整「錨點乘數」</li>
                        <li>微調「偏移」來對齊周圍元素</li>
                    </ul>
                </div>
            </div >

            {/* Bottom Action Bar */}
            < div className="p-4 border-t border-slate-700 space-y-2" >
                <button
                    onClick={onReset}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                    <RotateCcw size={16} />
                    重設預設值
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
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Save size={16} />
                        保存設定
                    </button>
                </div>
            </div >
        </div >
    );
};
