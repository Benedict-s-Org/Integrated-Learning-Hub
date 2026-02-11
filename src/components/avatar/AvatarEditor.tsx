import React, { useState, useMemo } from 'react';
import {
    AvatarConfig,
    DEFAULT_AVATAR_CONFIG,
    AvatarCategory,
    ALL_PARTS,
    SKIN_TONES,
    HAIR_COLORS,
    EYE_COLORS,
    OUTFIT_COLORS
} from './avatarParts';
import { AvatarRenderer } from './AvatarRenderer';
import { Palette, X, check } from 'lucide-react';

interface AvatarEditorProps {
    initialConfig?: AvatarConfig;
    onSave?: (config: AvatarConfig) => void;
    onCancel?: () => void;
}

const CATEGORIES: { id: AvatarCategory; label: string }[] = [
    { id: 'body', label: 'Body' },
    { id: 'skin', label: 'Skin' },
    { id: 'hair', label: 'Hair' },
    { id: 'eyes', label: 'Eyes' },
    { id: 'mouth', label: 'Mouth' },
    { id: 'nose', label: 'Nose' },
    { id: 'outfit', label: 'Outfit' },
    { id: 'accessory', label: 'Gear' },
];

export const AvatarEditor: React.FC<AvatarEditorProps> = ({
    initialConfig = DEFAULT_AVATAR_CONFIG,
    onSave,
    onCancel
}) => {
    const [config, setConfig] = useState<AvatarConfig>(initialConfig);
    const [activeCategory, setActiveCategory] = useState<AvatarCategory>('body');

    const handlePartSelect = (category: AvatarCategory, partId: string) => {
        setConfig(prev => ({
            ...prev,
            [category]: partId
        }));
    };

    const handleColorSelect = (category: AvatarCategory, color: string) => {
        // Map category to config color key
        const colorKeyMap: Partial<Record<AvatarCategory, keyof AvatarConfig>> = {
            skin: 'skinColor',
            hair: 'hairColor',
            eyes: 'eyeColor',
            outfit: 'outfitColor',
        };

        const key = colorKeyMap[category];
        if (key) {
            setConfig(prev => ({
                ...prev,
                [key]: color
            }));
        }
    };

    // Render color picker if applicable for category
    const renderColorPicker = () => {
        let colors: { id: string, color: string, name: string }[] = [];

        switch (activeCategory) {
            case 'skin': colors = SKIN_TONES; break;
            case 'hair': colors = HAIR_COLORS; break;
            case 'eyes': colors = EYE_COLORS; break;
            case 'outfit': colors = OUTFIT_COLORS; break;
            default: return null;
        }

        const currentColor =
            activeCategory === 'skin' ? config.skinColor :
                activeCategory === 'hair' ? config.hairColor :
                    activeCategory === 'eyes' ? config.eyeColor :
                        activeCategory === 'outfit' ? config.outfitColor : '';

        return (
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                    <Palette className="w-4 h-4" /> Color
                </h3>
                <div className="flex flex-wrap gap-3">
                    {colors.map((c) => (
                        <button
                            key={c.id}
                            onClick={() => handleColorSelect(activeCategory, c.color)}
                            className={`
                w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center
                ${currentColor === c.color ? 'border-amber-500 scale-110 shadow-md ring-2 ring-amber-200' : 'border-gray-200 hover:scale-105'}
              `}
                            style={{ backgroundColor: c.color }}
                            title={c.name}
                        >
                            {currentColor === c.color && <div className="w-2 h-2 bg-white/50 rounded-full" />}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    // Get items for current category
    const activeItems = useMemo(() => {
        if (activeCategory === 'skin') return []; // Handled by color picker
        return ALL_PARTS[activeCategory] || [];
    }, [activeCategory]);

    return (
        <div className="flex flex-col md:flex-row h-full max-h-[800px] bg-white rounded-2xl overflow-hidden shadow-2xl border border-amber-100">

            {/* LEFT: Preview Area */}
            <div className="w-full md:w-1/3 bg-gradient-to-b from-amber-50 to-orange-100 p-8 flex flex-col items-center justify-center relative border-b md:border-b-0 md:border-r border-amber-100">
                <div className="relative z-10 animate-fade-in">
                    <AvatarRenderer config={config} size={280} showBackground />
                </div>

                <div className="mt-8 flex gap-3 w-full max-w-[280px]">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 px-4 rounded-xl font-fredoka font-medium text-amber-700 bg-white/50 hover:bg-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave?.(config)}
                        className="flex-1 py-3 px-4 rounded-xl font-fredoka font-medium text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-200 transition-all hover:-translate-y-1"
                    >
                        Save Look
                    </button>
                </div>
            </div>

            {/* RIGHT: Controls */}
            <div className="flex-1 flex flex-col h-full bg-white">

                {/* Category Tabs */}
                <div className="flex overflow-x-auto p-2 gap-1 border-b border-gray-100 no-scrollbar">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`
                px-4 py-3 rounded-xl font-fredoka font-medium whitespace-nowrap transition-all duration-200
                ${activeCategory === cat.id
                                    ? 'bg-amber-100 text-amber-700 shadow-inner'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}
              `}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-amber-200">

                    {/* Color Picker (if applicable) */}
                    {renderColorPicker()}

                    {/* Items Grid */}
                    {activeItems.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 mb-3">Style</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                                {activeItems.map((item) => {
                                    const isSelected = config[activeCategory as keyof AvatarConfig] === item.id;

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => handlePartSelect(activeCategory, item.id)}
                                            className={`
                        aspect-square rounded-2xl border-2 flex flex-col items-center justify-center p-2 transition-all relative
                        ${isSelected
                                                    ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200 shadow-md'
                                                    : 'border-slate-100 hover:border-amber-200 hover:bg-white hover:shadow-sm'}
                      `}
                                        >
                                            {/* Mini Preview using Renderer? Too heavy. 
                          For now, just text or simple icon. 
                          Ideally, we would render a tiny preview of just that part.
                          Let's try rendering the specific part component isolated!
                      */}
                                            <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
                                                <AvatarRenderer
                                                    config={{ ...config, [activeCategory]: item.id }}
                                                    size={60}
                                                    showBackground={false}
                                                    className="translate-y-2 opacity-90" // Slight zoom/position tweak
                                                />
                                            </div>

                                            <span className="text-xs font-medium text-slate-600 mt-2 truncate max-w-full">
                                                {item.name}
                                            </span>

                                            {!item.isFree && (
                                                <div className="absolute top-1 right-1 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                    {item.price}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeItems.length === 0 && activeCategory !== 'skin' && (
                        <div className="text-center py-12 text-gray-400 font-fredoka">
                            Select options coming soon!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
