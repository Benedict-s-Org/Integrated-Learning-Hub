
import React, { useState } from 'react';
import { generateAssetPrompt, getDesignJSON } from '@/utils/promptGenerator';
import { Copy, Sparkles, Image as ImageIcon, Wand2, Loader2, Box, X, Sliders } from 'lucide-react';
import { orange_sofa, wooden_bookshelf, round_rug, floor_lamp, wooden_table, cozy_bed, armchair, mystery_box } from '@/assets/furniture/orange_sofa';

import { FurnitureItem, FurnitureBoxPrimitive, CustomFurniture } from '@/types/furniture';
import { PenTool } from 'lucide-react';

interface AssetGeneratorProps {
    onClose?: () => void;
    onSave?: (item: FurnitureItem, model: FurnitureBoxPrimitive[]) => void;
}

export function AssetGenerator({ onClose, onSave }: AssetGeneratorProps) {
    const [category, setCategory] = useState('furniture');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#e2e8f0'); // Added color state

    // Manual Gen State
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [jsonOutput, setJsonOutput] = useState('');

    // AI Gen State
    const [genMode, setGenMode] = useState<'manual' | 'ai'>('manual');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [hue, setHue] = useState(0);

    const processImage = async () => {
        if (!generatedImage) return;

        const img = new Image();
        img.src = generatedImage;
        img.crossOrigin = "anonymous";

        await new Promise((resolve) => { img.onload = resolve; });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) hue-rotate(${hue}deg)`;
        ctx.drawImage(img, 0, 0);

        setGeneratedImage(canvas.toDataURL('image/png'));
        setIsEditing(false);
    };

    const handleGenerate = () => {
        const prompt = generateAssetPrompt(category, name, description);
        const json = JSON.stringify(getDesignJSON(category, name, description), null, 2);
        setGeneratedPrompt(prompt);
        setJsonOutput(json);
    };

    const handleGenerateAI = () => {
        if (!prompt) return;
        setIsGenerating(true);
        setGeneratedImage(null); // Clear previous image

        // Simple keyword matching simulation
        const p = prompt.toLowerCase();
        let resultImage = mystery_box; // Default to mystery box
        let defaultName = 'AI Asset';

        if (p.includes('shelf') || p.includes('book')) {
            resultImage = wooden_bookshelf;
            defaultName = 'Wooden Bookshelf';
        } else if (p.includes('rug') || p.includes('carpet') || p.includes('mat')) {
            resultImage = round_rug;
            defaultName = 'Round Rug';
        } else if (p.includes('lamp') || p.includes('light')) {
            resultImage = floor_lamp;
            defaultName = 'Floor Lamp';
        } else if (p.includes('sofa') || p.includes('couch')) {
            resultImage = orange_sofa;
            defaultName = 'Orange Sofa';
        } else if (p.includes('table') || p.includes('desk') || p.includes('coffee')) {
            resultImage = wooden_table;
            defaultName = 'Wooden Table';
        } else if (p.includes('bed') || p.includes('sleep') || p.includes('bunk')) {
            resultImage = cozy_bed;
            defaultName = 'Cozy Bed';
        } else if (p.includes('chair') || p.includes('seat') || p.includes('stool')) {
            resultImage = armchair;
            defaultName = 'Armchair';
        } else {
            defaultName = 'Mystery Item';
            // resultImage is already mystery_box
        }

        // Simulate API call
        setTimeout(() => {
            setIsGenerating(false);
            setGeneratedImage(resultImage);
            if (!name) setName(defaultName);
        }, 1500);
    };

    const handleSaveGenerated = () => {
        if (!generatedImage || !onSave) return;

        const newItem: CustomFurniture = {
            id: `asset_ai_${Date.now()}`,
            name: name || 'AI Generated Asset',
            desc: description || prompt,
            type: 'sprite', // AI assets are sprites
            cost: 100,
            size: [2, 1], // Estimate size
            height: 1,
            color: '#ffffff',
            icon: Wand2,
            spriteImages: [generatedImage, generatedImage, generatedImage, generatedImage], // Use same image for all angles for now
            spriteScale: 1,
            price: 100 // Add price to satisfy FurnitureItem type if needed (depends on interface consistency)
        };

        // Use a dummy placeholder model for geometric fallback if needed
        const placeholderModel: FurnitureBoxPrimitive[] = [{
            x: 0, y: 0, z: 0, w: 2, d: 1, h: 1, color: '#ff9966'
        }];

        onSave(newItem, placeholderModel);
        alert('AI Asset saved to inventory!');
        if (onClose) onClose();
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    const handleCreateDraft = () => {
        console.log('handleCreateDraft called');
        if (!onSave) {
            console.error('onSave prop is missing');
            return;
        }

        // Create a basic placeholder model based on category
        // This is a simple block representation
        const placeholderModel: FurnitureBoxPrimitive[] = [{
            x: 0, y: 0, z: 0,
            w: 1, d: 1, h: 1,
            color: '#e2e8f0'
        }];

        const newItem: FurnitureItem = {
            id: `asset_${Date.now()} `,
            name: name || 'New Asset',
            desc: description || 'Generated asset',
            type: 'geometric',
            cost: 0,
            size: [1, 1],
            height: 1,
            color: '#e2e8f0',
            icon: PenTool
        };

        onSave(newItem, placeholderModel);
        alert('Draft asset created! Check your inventory to place it.');
    };

    return (
        <div className="p-6 h-full bg-region-ground overflow-y-auto">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
                <div className="flex items-center justify-between gap-3 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-100 rounded-xl">
                            <Sparkles className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">New Asset Generator</h2>
                            <p className="text-slate-500">Create custom furniture assets</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setGenMode('manual')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${genMode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            <Box className="inline-block mr-2 w-4 h-4" />
                            Geometric
                        </button>
                        <button
                            onClick={() => setGenMode('ai')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${genMode === 'ai' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            <Wand2 className="inline-block mr-2 w-4 h-4" />
                            AI Gen
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">

                    {genMode === 'manual' ? (
                        /* Manual Mode Content */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Input Section */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-foreground">Asset Category</label>
                                    <select
                                        className="w-full p-3 rounded-lg border border-border bg-background"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                    >
                                        <option value="furniture">Furniture (Table, Chair, Bed)</option>
                                        <option value="decoration">Decoration (Plant, Rug, Lamp)</option>
                                        <option value="city_building">City Building (House, Shop)</option>
                                        <option value="public_facility">Public Facility (Library, Gym)</option>
                                        <option value="map_element">Map Element (Tree, Rock)</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-foreground">Asset Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Cozy Red Sofa"
                                        className="w-full p-3 rounded-lg border border-border bg-background"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-foreground">Description</label>
                                    <textarea
                                        placeholder="Describe the shape, key features, and mood..."
                                        className="w-full p-3 rounded-lg border border-border bg-background min-h-[100px]"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                </div>

                                <button
                                    onClick={handleGenerate}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                                >
                                    <Sparkles className="w-5 h-5" />
                                    Generate Design Parameters
                                </button>
                            </div>

                            {/* Output Section */}
                            <div className="space-y-6">
                                {generatedPrompt ? (
                                    <>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-sm font-semibold text-foreground">Optimized AI Prompt</label>
                                                <button
                                                    onClick={() => copyToClipboard(generatedPrompt)}
                                                    className="text-xs flex items-center gap-1 text-primary hover:underline"
                                                >
                                                    <Copy className="w-3 h-3" /> Copy
                                                </button>
                                            </div>
                                            <div className="p-4 rounded-lg bg-muted text-sm whitespace-pre-wrap h-[150px] overflow-y-auto font-mono border border-border">
                                                {generatedPrompt}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-sm font-semibold text-foreground">Full Design JSON</label>
                                                <button
                                                    onClick={() => copyToClipboard(jsonOutput)}
                                                    className="text-xs flex items-center gap-1 text-primary hover:underline"
                                                >
                                                    <Copy className="w-3 h-3" /> Copy
                                                </button>
                                            </div>
                                            <div className="p-4 rounded-lg bg-muted text-xs whitespace-pre-wrap h-[200px] overflow-y-auto font-mono border border-border">
                                                {jsonOutput}
                                            </div>
                                        </div>

                                        <div className="p-4 bg-accent/20 border border-accent rounded-xl flex items-center gap-4">
                                            <div className="p-2 bg-white rounded-lg">
                                                <ImageIcon className="w-6 h-6 text-accent" />
                                            </div>
                                            <div className="text-sm">
                                                <p className="font-bold text-accent-foreground">Ready to Create!</p>
                                                <p className="text-muted-foreground">Use these parameters with your image generation tool.</p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 border-2 border-dashed border-border rounded-xl">
                                        <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                                        <p>Enter details and click Generate to see the magic happen</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* AI Mode Content */
                        <div className="space-y-6">
                            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-xl border border-purple-100">
                                <label className="block text-sm font-bold text-purple-900 mb-2">Describe your asset</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        className="flex-1 border-purple-200 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm"
                                        placeholder="e.g. A cute orange isometric sofa with yellow pillows..."
                                        onKeyDown={(e) => e.key === 'Enter' && handleGenerateAI()}
                                    />
                                    <button
                                        onClick={handleGenerateAI}
                                        disabled={isGenerating || !prompt}
                                        className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 />}
                                        Generate
                                    </button>
                                </div>
                            </div>

                            {generatedImage && (
                                <div className="flex gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="w-1/2">
                                        <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm relative group overflow-hidden">
                                            <img
                                                src={generatedImage}
                                                alt="Generated"
                                                className="w-full h-auto rounded-lg transition-all"
                                                style={{ filter: isEditing ? `brightness(${brightness}%) contrast(${contrast}%) hue-rotate(${hue}deg)` : 'none' }}
                                            />
                                            {!isEditing && (
                                                <button
                                                    onClick={() => setIsEditing(true)}
                                                    className="absolute top-2 right-2 p-2 bg-white/90 rounded-full shadow-md text-slate-600 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Sliders size={18} />
                                                </button>
                                            )}
                                        </div>
                                        {isEditing && (
                                            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 animate-in slide-in-from-top-2">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h3 className="font-bold text-sm text-slate-700">Refine Asset</h3>
                                                    <button onClick={processImage} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-full">Apply</button>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-xs text-slate-500">
                                                        <span>Brightness</span>
                                                        <span>{brightness}%</span>
                                                    </div>
                                                    <input
                                                        type="range" min="50" max="150" value={brightness}
                                                        onChange={(e) => setBrightness(Number(e.target.value))}
                                                        className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-xs text-slate-500">
                                                        <span>Contrast</span>
                                                        <span>{contrast}%</span>
                                                    </div>
                                                    <input
                                                        type="range" min="50" max="150" value={contrast}
                                                        onChange={(e) => setContrast(Number(e.target.value))}
                                                        className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-xs text-slate-500">
                                                        <span>Hue</span>
                                                        <span>{hue}°</span>
                                                    </div>
                                                    <input
                                                        type="range" min="-180" max="180" value={hue}
                                                        onChange={(e) => setHue(Number(e.target.value))}
                                                        className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-1/2 space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Asset Name</label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
                                                placeholder="Name your generated asset..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                                            <textarea
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none h-24 resize-none"
                                                placeholder="Description..."
                                            />
                                        </div>
                                        <div className="pt-4">
                                            <button
                                                onClick={handleSaveGenerated}
                                                disabled={!name}
                                                className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-lg shadow-green-200 disabled:opacity-50 disabled:shadow-none transition-all transform active:scale-95"
                                            >
                                                Save to Inventory
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!generatedImage && !isGenerating && (
                                <div className="text-center py-20 text-slate-400">
                                    <Wand2 size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>Enter a prompt above to generate a unique asset</p>
                                </div>
                            )}

                            {isGenerating && (
                                <div className="text-center py-20 text-purple-600">
                                    <Loader2 size={48} className="mx-auto mb-4 animate-spin" />
                                    <p className="animate-pulse">Dreaming up your asset...</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {genMode === 'manual' && onSave && (
                    <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 rounded-lg text-slate-500 hover:bg-slate-50 font-medium"
                        >
                            Close
                        </button>
                        <button
                            onClick={handleCreateDraft}
                            className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm flex items-center gap-2"
                        >
                            <PenTool size={18} />
                            Create Draft Asset
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
