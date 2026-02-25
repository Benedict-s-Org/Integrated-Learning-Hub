import { Move, Maximize, RotateCw, RefreshCcw } from "lucide-react";
import type { CityTransformData } from "@/types/city";

interface TransformControlsProps {
    data: CityTransformData;
    onChange: (changes: Partial<CityTransformData>) => void;
    onReset: () => void;
    title?: string;
}

export function TransformControls({
    data,
    onChange,
    onReset,
    title = "細節調整"
}: TransformControlsProps) {
    const {
        offsetX = 0,
        offsetY = 0,
        scale = 1,
        scaleX = 100,
        scaleY = 100,
        rotation = 0,
    } = data;

    const ControlGroup = ({
        label,
        icon: Icon,
        children
    }: {
        label: string;
        icon: any;
        children: React.ReactNode
    }) => (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <Icon size={12} className="text-emerald-500" />
                {label}
            </div>
            <div className="space-y-3 px-1">
                {children}
            </div>
        </div>
    );

    const SliderField = ({
        label,
        value,
        min,
        max,
        step = 1,
        unit = "",
        onChange: onValChange
    }: {
        label: string;
        value: number;
        min: number;
        max: number;
        step?: number;
        unit?: string;
        onChange: (val: number) => void
    }) => (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                <span>{label}</span>
                <div className="flex items-center gap-1">
                    <input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(e) => onValChange(Number(e.target.value))}
                        className="w-12 bg-slate-800/50 border border-slate-700/50 rounded px-1.5 py-0.5 font-mono text-emerald-500 text-[10px] focus:outline-none focus:border-emerald-500/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="font-mono text-emerald-500/50 opacity-50">{unit}</span>
                </div>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onValChange(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
            />
        </div>
    );

    return (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="text-xs font-black text-white flex items-center gap-2">
                    <Maximize size={14} className="text-emerald-500" />
                    {title}
                </h4>
                <button
                    onClick={onReset}
                    className="p-1.5 hover:bg-slate-800 rounded-md text-slate-500 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-bold"
                >
                    <RefreshCcw size={12} />
                    重置
                </button>
            </div>

            <ControlGroup label="位置偏移" icon={Move}>
                <SliderField
                    label="水平 (X)"
                    value={offsetX}
                    min={-100}
                    max={100}
                    unit="px"
                    onChange={(val) => onChange({ offsetX: val })}
                />
                <SliderField
                    label="垂直 (Y)"
                    value={offsetY}
                    min={-100}
                    max={100}
                    unit="px"
                    onChange={(val) => onChange({ offsetY: val })}
                />
            </ControlGroup>

            <ControlGroup label="比例大小" icon={Maximize}>
                <SliderField
                    label="整體缩放"
                    value={scale}
                    min={0.1}
                    max={3}
                    step={0.05}
                    onChange={(val) => onChange({ scale: val })}
                />
                <div className="grid grid-cols-2 gap-4">
                    <SliderField
                        label="寬度 %"
                        value={scaleX}
                        min={10}
                        max={300}
                        unit="%"
                        onChange={(val) => onChange({ scaleX: val })}
                    />
                    <SliderField
                        label="高度 %"
                        value={scaleY}
                        min={10}
                        max={300}
                        unit="%"
                        onChange={(val) => onChange({ scaleY: val })}
                    />
                </div>
            </ControlGroup>

            <ControlGroup label="旋轉角度" icon={RotateCw}>
                <SliderField
                    label="角度"
                    value={rotation}
                    min={-180}
                    max={180}
                    unit="°"
                    onChange={(val) => onChange({ rotation: val })}
                />
            </ControlGroup>
        </div>
    );
}
