import React, { useState, useMemo } from 'react';
import { AvatarImageItem, UserAvatarConfig, AvatarCategory, DEFAULT_PART_OFFSET } from './avatarParts';
import { AvatarRenderer } from './AvatarRenderer';
import { MoveUp, MoveDown, MoveLeft, MoveRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface AvatarEditorProps {
    availableItems: AvatarImageItem[];
    initialEquipped?: AvatarImageItem[];
    initialConfig?: UserAvatarConfig;
    unlockedItemIds?: string[];
    onSave?: (equippedItemIds: string[], config: UserAvatarConfig) => void;
    onBuyItem?: (item: AvatarImageItem) => Promise<void> | void;
    onCancel?: () => void;
}

const CATEGORIES: { id: AvatarCategory; label: string }[] = [
    { id: 'background', label: 'BG' },
    { id: 'body', label: 'Body' },
    { id: 'face', label: 'Face' },
    { id: 'eyes', label: 'Eyes' },
    { id: 'mouth', label: 'Mouth' },
    { id: 'hair_back', label: 'Hair Back' },
    { id: 'hair_front', label: 'Hair Front' },
    { id: 'tops', label: 'Top' },
    { id: 'bottoms', label: 'Bottom' },
    { id: 'shoes', label: 'Shoes' },
    { id: 'accessories', label: 'Accs' },
];

export const AvatarEditor: React.FC<AvatarEditorProps> = ({
    availableItems = [],
    initialEquipped = [],
    initialConfig = {},
    unlockedItemIds = [],
    onSave,
    onBuyItem,
    onCancel
}) => {
    const [equippedItems, setEquippedItems] = useState<AvatarImageItem[]>(initialEquipped);
    const [userConfig, setUserConfig] = useState<UserAvatarConfig>(initialConfig);
    const [activeCategory, setActiveCategory] = useState<AvatarCategory>('eyes');

    // Equipping / Unequipping items
    const handlePartSelect = (item: AvatarImageItem) => {
        setEquippedItems(prev => {
            // Remove any existing item in this category
            const filtered = prev.filter(p => p.category !== item.category);
            return [...filtered, item];
        });

        // Ensure there is a default offset config for this new item if none exists
        if (!userConfig[item.category]) {
            setUserConfig(prev => ({
                ...prev,
                [item.category]: { ...DEFAULT_PART_OFFSET, item_id: item.id }
            }));
        } else {
            setUserConfig(prev => ({
                ...prev,
                [item.category]: { ...prev[item.category]!, item_id: item.id }
            }));
        }
    };

    const handlePartUnequip = (category: AvatarCategory) => {
        setEquippedItems(prev => prev.filter(p => p.category !== category));
    };

    // Transform Adjustment
    const handleTransform = (axis: 'x' | 'y' | 'scale', delta: number) => {
        setUserConfig(prev => {
            const currentOffset = prev[activeCategory] || { ...DEFAULT_PART_OFFSET, item_id: '' };

            // Apply limits (e.g., max offset +/- 50%, scale between 0.5x and 2x)
            let newValue = currentOffset[axis] + delta;
            if (axis === 'scale') {
                newValue = Math.max(0.2, Math.min(3.0, newValue)); // Min 0.2x, Max 3.0x
            } else {
                newValue = Math.max(-100, Math.min(100, newValue)); // Percentage offset
            }

            return {
                ...prev,
                [activeCategory]: {
                    ...currentOffset,
                    [axis]: Number(newValue.toFixed(2)) // nice decimals
                }
            };
        });
    };

    const resetTransform = () => {
        setUserConfig(prev => {
            const currentItem = prev[activeCategory]?.item_id || '';
            return {
                ...prev,
                [activeCategory]: { ...DEFAULT_PART_OFFSET, item_id: currentItem }
            };
        });
    };

    // Get items for current category from all available DB items
    const activeItems = useMemo(() => {
        return availableItems.filter(item => item.category === activeCategory);
    }, [availableItems, activeCategory]);

    // Check which item in the current category is currently equipped
    const equippedItemInCategory = useMemo(() => {
        return equippedItems.find(item => item.category === activeCategory);
    }, [equippedItems, activeCategory]);

    const activeOffset = userConfig[activeCategory] || DEFAULT_PART_OFFSET;

    return (
        <div className="flex flex-col md:flex-row h-full max-h-[800px] bg-white rounded-2xl overflow-hidden shadow-2xl border border-amber-100">

            {/* LEFT: Preview & Controls Area */}
            <div className="w-full md:w-5/12 bg-gradient-to-b from-amber-50 to-orange-100 p-6 flex flex-col items-center justify-between relative border-b md:border-b-0 md:border-r border-amber-100 overflow-y-auto">

                {/* Avatar Preview */}
                <div className="relative z-10 animate-fade-in w-full max-w-[280px] aspect-square mb-6 bg-white/50 rounded-3xl shadow-inner border border-amber-200 p-4">
                    <AvatarRenderer
                        equippedItems={equippedItems}
                        userConfig={userConfig}
                        size={'100%'}
                        showBackground={false}
                    />
                </div>

                {/* Transform Controls (Only show if an item is equipped in this category) */}
                {equippedItemInCategory ? (
                    <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-amber-200">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-semibold text-amber-900 font-fredoka">Adjust Layer</h3>
                            <button onClick={resetTransform} className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md">
                                <RotateCcw className="w-3 h-3" /> Reset
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Position Controls */}
                            <div className="flex flex-col items-center gap-1 bg-amber-50 rounded-xl p-2">
                                <span className="text-[10px] uppercase font-bold text-amber-700/70 mb-1 tracking-wider">Position</span>
                                <button onClick={() => handleTransform('y', -2)} className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-amber-100 text-amber-700 transition" title="Move Up"><MoveUp className="w-4 h-4" /></button>
                                <div className="flex gap-2">
                                    <button onClick={() => handleTransform('x', -2)} className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-amber-100 text-amber-700 transition" title="Move Left"><MoveLeft className="w-4 h-4" /></button>
                                    <div className="w-10 text-center flex items-center justify-center text-xs font-mono font-medium text-amber-800 bg-white/50 rounded">
                                        {activeOffset.x},{activeOffset.y}
                                    </div>
                                    <button onClick={() => handleTransform('x', 2)} className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-amber-100 text-amber-700 transition" title="Move Right"><MoveRight className="w-4 h-4" /></button>
                                </div>
                                <button onClick={() => handleTransform('y', 2)} className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-amber-100 text-amber-700 transition" title="Move Down"><MoveDown className="w-4 h-4" /></button>
                            </div>

                            {/* Scale Controls */}
                            <div className="flex flex-col items-center justify-center gap-3 bg-amber-50 rounded-xl p-2">
                                <span className="text-[10px] uppercase font-bold text-amber-700/70 mb-1 tracking-wider">Scale</span>
                                <button onClick={() => handleTransform('scale', 0.05)} className="p-2.5 bg-white rounded-lg shadow-sm hover:bg-amber-100 text-amber-700 transition" title="Zoom In"><ZoomIn className="w-5 h-5" /></button>
                                <div className="text-xs font-mono font-medium text-amber-800 bg-white/50 px-2 py-1 rounded">
                                    {(activeOffset.scale * 100).toFixed(0)}%
                                </div>
                                <button onClick={() => handleTransform('scale', -0.05)} className="p-2.5 bg-white rounded-lg shadow-sm hover:bg-amber-100 text-amber-700 transition" title="Zoom Out"><ZoomOut className="w-5 h-5" /></button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-full bg-amber-50 rounded-2xl p-4 border border-amber-200 border-dashed text-center">
                        <p className="text-sm text-amber-700/70 font-fredoka">Select an item in this category to unlock layout fine-tuning.</p>
                    </div>
                )}

                {/* Save/Cancel */}
                <div className="mt-6 flex gap-3 w-full">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 px-4 rounded-xl font-fredoka font-medium text-amber-700 bg-white/50 hover:bg-white border border-amber-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave?.(equippedItems.map(i => i.id), userConfig)}
                        className="flex-1 py-3 px-4 rounded-xl font-fredoka font-medium text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-200 transition-all hover:-translate-y-1"
                    >
                        Save Look
                    </button>
                </div>
            </div>

            {/* RIGHT: Inventory / Shop Selection */}
            <div className="flex-1 flex flex-col h-full bg-white md:max-w-7/12">

                {/* Category Tabs */}
                <div className="flex overflow-x-auto p-2 gap-1 border-b border-gray-100 no-scrollbar">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`
                                px-4 py-2.5 rounded-xl text-sm font-fredoka font-medium whitespace-nowrap transition-all duration-200
                                ${activeCategory === cat.id
                                    ? 'bg-amber-100 text-amber-800 shadow-inner'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}
                            `}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-amber-200 bg-slate-50/50">

                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-slate-700 font-fredoka">Available {CATEGORIES.find(c => c.id === activeCategory)?.label}</h3>
                        {equippedItemInCategory && (
                            <button
                                onClick={() => handlePartUnequip(activeCategory)}
                                className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition-colors"
                            >
                                Unequip
                            </button>
                        )}
                    </div>

                    {/* Items Grid */}
                    {activeItems.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {activeItems.map((item) => {
                                const isSelected = equippedItemInCategory?.id === item.id;
                                const isUnlocked = item.is_default || unlockedItemIds.includes(item.id);

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            if (isUnlocked) {
                                                handlePartSelect(item);
                                            } else {
                                                onBuyItem?.(item);
                                            }
                                        }}
                                        className={`
                                            group aspect-square rounded-2xl border-2 flex flex-col items-center justify-center p-3 transition-all relative overflow-hidden bg-white
                                            ${isSelected
                                                ? 'border-amber-500 ring-2 ring-amber-200 shadow-md bg-amber-50/50'
                                                : isUnlocked
                                                    ? 'border-slate-200 hover:border-amber-300 hover:shadow-md'
                                                    : 'border-slate-200 opacity-60 hover:opacity-100 hover:border-amber-300'}
                                        `}
                                    >
                                        <div className="flex-1 w-full flex items-center justify-center p-2">
                                            <img
                                                src={item.image_url}
                                                alt={item.name}
                                                className={`max-w-full max-h-full object-contain transition-transform group-hover:scale-110 ${isSelected ? 'scale-110 drop-shadow-md' : 'drop-shadow-sm'} ${!isUnlocked ? 'grayscale' : ''}`}
                                            />
                                        </div>

                                        <div className="w-full mt-2 text-center bg-white/80 p-1 rounded backdrop-blur-sm">
                                            <span className="text-xs font-semibold text-slate-700 truncate block w-full">
                                                {item.name}
                                            </span>
                                            {!item.is_default && (
                                                <span className={`text-[10px] font-bold block ${isUnlocked ? 'text-amber-600' : 'text-slate-500'}`}>
                                                    {isUnlocked ? 'Owned' : (item.base_price > 0 ? `💰 ${item.base_price}` : 'Free')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                            <span className="text-4xl mb-3 block">🎨</span>
                            <p className="text-slate-500 font-fredoka font-medium">No items found in this category.</p>
                            <p className="text-xs text-slate-400 mt-2">More coming soon!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
