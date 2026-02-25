import { useState } from "react";
import type { Building, BuildingExteriorStyle } from "@/types/city";
import { CARTOON_PALETTE } from "@/constants/cityStyleGuide";
import { Palette, Home, Layers, Wind, Image as ImageIcon, Sparkles } from "lucide-react";
import { AssetImageUploader } from "./AssetImageUploader";
import { TransformControls } from "./TransformControls";

interface BuildingStyleEditorProps {
  building: Building;
  onUpdate: (id: string, updates: Partial<Building>) => void;
}

// Color swatch component
function ColorSwatch({
  color,
  isSelected,
  onClick,
}: {
  color: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-lg border-2 transition-all ${isSelected
        ? "border-emerald-400 ring-2 ring-emerald-400/50 scale-110"
        : "border-slate-600 hover:border-slate-400"
        }`}
      style={{ backgroundColor: color }}
      title={color}
    />
  );
}

// Custom color input
function CustomColorInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value.startsWith("hsl") ? hslToHex(value) : value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border border-slate-600"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs font-mono"
        placeholder={label}
      />
    </div>
  );
}

// Convert HSL string to hex (approximate)
function hslToHex(hsl: string): string {
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return "#888888";

  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function BuildingStyleEditor({ building, onUpdate }: BuildingStyleEditorProps) {
  const [activeTab, setActiveTab] = useState<"cartoon" | "custom">(
    building.customImageUrl ? "custom" : "cartoon"
  );
  const style = building.exteriorStyle;

  const updateStyle = (updates: Partial<BuildingExteriorStyle>) => {
    onUpdate(building.id, {
      exteriorStyle: { ...style, ...updates },
    });
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/50">
        <button
          onClick={() => setActiveTab("cartoon")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "cartoon"
            ? "bg-slate-700 text-white shadow-lg"
            : "text-slate-400 hover:text-slate-200"
            }`}
        >
          <Palette size={14} />
          卡通樣式
        </button>
        <button
          onClick={() => setActiveTab("custom")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "custom"
            ? "bg-emerald-600 text-white shadow-lg"
            : "text-slate-400 hover:text-slate-200"
            }`}
        >
          <ImageIcon size={14} />
          自定義圖片
        </button>
      </div>

      {activeTab === "cartoon" ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Wall Color */}
          <div>
            <label className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Home className="w-3 h-3" />
              牆壁顏色
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {CARTOON_PALETTE.walls.map((color, i) => (
                <ColorSwatch
                  key={i}
                  color={color}
                  isSelected={style.wallColor === color}
                  onClick={() => updateStyle({ wallColor: color })}
                />
              ))}
            </div>
            <CustomColorInput
              value={style.wallColor}
              onChange={(color) => updateStyle({ wallColor: color })}
              label="自訂顏色"
            />
          </div>

          {/* Roof Color */}
          <div>
            <label className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Layers className="w-3 h-3" />
              屋頂顏色
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {CARTOON_PALETTE.roofs.map((color, i) => (
                <ColorSwatch
                  key={i}
                  color={color}
                  isSelected={style.roofColor === color}
                  onClick={() => updateStyle({ roofColor: color })}
                />
              ))}
            </div>
            <CustomColorInput
              value={style.roofColor}
              onChange={(color) => updateStyle({ roofColor: color })}
              label="自訂顏色"
            />
          </div>

          {/* Accent Color */}
          <div>
            <label className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Palette className="w-3 h-3" />
              點綴顏色
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {CARTOON_PALETTE.accents.map((color, i) => (
                <ColorSwatch
                  key={i}
                  color={color}
                  isSelected={style.accentColor === color}
                  onClick={() => updateStyle({ accentColor: color })}
                />
              ))}
            </div>
            <CustomColorInput
              value={style.accentColor}
              onChange={(color) => updateStyle({ accentColor: color })}
              label="自訂顏色"
            />
          </div>

          {/* Window Style */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">窗戶樣式</label>
            <div className="grid grid-cols-3 gap-2">
              {(["modern", "classic", "minimal"] as const).map((ws) => (
                <button
                  key={ws}
                  onClick={() => updateStyle({ windowStyle: ws })}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${style.windowStyle === ws
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                >
                  {ws === "modern" ? "現代" : ws === "classic" ? "經典" : "簡約"}
                </button>
              ))}
            </div>
          </div>

          {/* Stories */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">
              樓層數: {style.stories ?? 2}
            </label>
            <input
              type="range"
              min={0}
              max={5}
              value={style.stories ?? 2}
              onChange={(e) => updateStyle({ stories: parseInt(e.target.value) })}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0</span>
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
          </div>

          {/* Chimney & Balcony */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={style.hasChimney ?? false}
                onChange={(e) => updateStyle({ hasChimney: e.target.checked })}
                className="rounded border-slate-600 bg-slate-800 text-emerald-500"
              />
              <span className="text-sm text-slate-300 flex items-center gap-1">
                <Wind className="w-3 h-3" />
                煙囪
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={style.hasBalcony ?? false}
                onChange={(e) => updateStyle({ hasBalcony: e.target.checked })}
                className="rounded border-slate-600 bg-slate-800 text-emerald-500"
              />
              <span className="text-sm text-slate-300">陽台</span>
            </label>
          </div>

          {/* Style Presets */}
          <div className="border-t border-slate-700 pt-4">
            <label className="block text-xs text-slate-400 mb-2">快速套用預設</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  updateStyle({
                    wallColor: CARTOON_PALETTE.walls[0],
                    roofColor: CARTOON_PALETTE.roofs[0],
                    accentColor: CARTOON_PALETTE.accents[0],
                    windowStyle: "modern",
                    stories: 2,
                    hasChimney: false,
                  })
                }
                className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs"
              >
                🏠 溫馨小屋
              </button>
              <button
                onClick={() =>
                  updateStyle({
                    wallColor: CARTOON_PALETTE.walls[1],
                    roofColor: CARTOON_PALETTE.roofs[3],
                    accentColor: CARTOON_PALETTE.accents[0],
                    windowStyle: "classic",
                    stories: 1,
                    hasChimney: true,
                  })
                }
                className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs"
              >
                🥐 麵包店
              </button>
              <button
                onClick={() =>
                  updateStyle({
                    wallColor: CARTOON_PALETTE.walls[2],
                    roofColor: CARTOON_PALETTE.roofs[2],
                    accentColor: CARTOON_PALETTE.accents[2],
                    windowStyle: "classic",
                    stories: 3,
                    hasChimney: false,
                  })
                }
                className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs"
              >
                🏫 學校
              </button>
              <button
                onClick={() =>
                  updateStyle({
                    wallColor: CARTOON_PALETTE.walls[0],
                    roofColor: CARTOON_PALETTE.roofs[4],
                    accentColor: CARTOON_PALETTE.accents[0],
                    windowStyle: "classic",
                    stories: 4,
                    hasChimney: true,
                  })
                }
                className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs"
              >
                🏛️ 地標
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <Sparkles size={12} className="text-emerald-500" />
              圖片素材
            </label>
            <AssetImageUploader
              assetType="building"
              currentImageUrl={building.customImageUrl}
              onSelect={(url, id) => onUpdate(building.id, { customImageUrl: url, customAssetId: id })}
              onClear={() => onUpdate(building.id, { customImageUrl: undefined, customAssetId: undefined })}
            />
          </div>

          {building.customImageUrl && (
            <TransformControls
              data={building.transform || {}}
              onChange={(transform) => onUpdate(building.id, {
                transform: { ...(building.transform || {}), ...transform }
              })}
              onReset={() => onUpdate(building.id, { transform: {} })}
            />
          )}
        </div>
      )}
    </div>
  );
}
