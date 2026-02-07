/**
 * HSL Color Picker Component
 * 
 * A visual color picker that works with HSL format
 */

import { useState, useEffect, useCallback } from 'react';

interface ColorPickerProps {
    label: string;
    value: string;                  // HSL format: "H S% L%"
    onChange: (value: string) => void;
    description?: string;
}

// Parse HSL string to components
function parseHSL(hsl: string): { h: number; s: number; l: number } {
    const parts = hsl.split(' ');
    return {
        h: parseInt(parts[0]) || 0,
        s: parseInt(parts[1]) || 50,
        l: parseInt(parts[2]) || 50,
    };
}

// Format HSL components to string
function formatHSL(h: number, s: number, l: number): string {
    return `${h} ${s}% ${l}%`;
}

// Convert HSL to hex for native color picker
function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

// Convert hex to HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 0, s: 50, l: 50 };

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}

export function ColorPicker({ label, value, onChange, description }: ColorPickerProps) {
    const [hsl, setHsl] = useState(() => parseHSL(value));

    useEffect(() => {
        setHsl(parseHSL(value));
    }, [value]);

    const handleHexChange = useCallback((hex: string) => {
        const newHsl = hexToHSL(hex);
        setHsl(newHsl);
        onChange(formatHSL(newHsl.h, newHsl.s, newHsl.l));
    }, [onChange]);

    const handleSliderChange = useCallback((component: 'h' | 's' | 'l', newValue: number) => {
        const newHsl = { ...hsl, [component]: newValue };
        setHsl(newHsl);
        onChange(formatHSL(newHsl.h, newHsl.s, newHsl.l));
    }, [hsl, onChange]);

    const hexValue = hslToHex(hsl.h, hsl.s, hsl.l);

    return (
        <div className="space-y-3">
            {/* Label and description */}
            <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-primary">{label}</label>
                <div
                    className="w-8 h-8 rounded-lg border-2 border-white shadow-md cursor-pointer relative overflow-hidden"
                    style={{ backgroundColor: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` }}
                >
                    <input
                        type="color"
                        value={hexValue}
                        onChange={(e) => handleHexChange(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>
            </div>

            {description && (
                <p className="text-xs text-primary/50">{description}</p>
            )}

            {/* HSL Sliders */}
            <div className="space-y-2">
                {/* Hue */}
                <div className="flex items-center gap-3">
                    <span className="text-xs text-primary/40 w-6">H</span>
                    <input
                        type="range"
                        min="0"
                        max="360"
                        value={hsl.h}
                        onChange={(e) => handleSliderChange('h', parseInt(e.target.value))}
                        className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                        style={{
                            background: `linear-gradient(to right, 
                                hsl(0, ${hsl.s}%, ${hsl.l}%), 
                                hsl(60, ${hsl.s}%, ${hsl.l}%), 
                                hsl(120, ${hsl.s}%, ${hsl.l}%), 
                                hsl(180, ${hsl.s}%, ${hsl.l}%), 
                                hsl(240, ${hsl.s}%, ${hsl.l}%), 
                                hsl(300, ${hsl.s}%, ${hsl.l}%), 
                                hsl(360, ${hsl.s}%, ${hsl.l}%))`
                        }}
                    />
                    <span className="text-xs text-primary/60 w-8 text-right">{hsl.h}°</span>
                </div>

                {/* Saturation */}
                <div className="flex items-center gap-3">
                    <span className="text-xs text-primary/40 w-6">S</span>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={hsl.s}
                        onChange={(e) => handleSliderChange('s', parseInt(e.target.value))}
                        className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                        style={{
                            background: `linear-gradient(to right, 
                                hsl(${hsl.h}, 0%, ${hsl.l}%), 
                                hsl(${hsl.h}, 100%, ${hsl.l}%))`
                        }}
                    />
                    <span className="text-xs text-primary/60 w-8 text-right">{hsl.s}%</span>
                </div>

                {/* Lightness */}
                <div className="flex items-center gap-3">
                    <span className="text-xs text-primary/40 w-6">L</span>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={hsl.l}
                        onChange={(e) => handleSliderChange('l', parseInt(e.target.value))}
                        className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                        style={{
                            background: `linear-gradient(to right, 
                                hsl(${hsl.h}, ${hsl.s}%, 0%), 
                                hsl(${hsl.h}, ${hsl.s}%, 50%), 
                                hsl(${hsl.h}, ${hsl.s}%, 100%))`
                        }}
                    />
                    <span className="text-xs text-primary/60 w-8 text-right">{hsl.l}%</span>
                </div>
            </div>

            {/* Hex value display */}
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={hexValue.toUpperCase()}
                    onChange={(e) => handleHexChange(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs font-mono bg-white border-2 border-primary/10 rounded-lg focus:border-primary/30 outline-none"
                />
                <div className="text-xs text-primary/40">
                    HSL: {hsl.h}, {hsl.s}%, {hsl.l}%
                </div>
            </div>
        </div>
    );
}
