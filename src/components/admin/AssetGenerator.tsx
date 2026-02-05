import React, { useState } from 'react';
import { Sparkles, Wand2, Loader2, X, Sliders, Zap } from 'lucide-react';
import { orange_sofa, wooden_bookshelf, round_rug, floor_lamp, wooden_table, cozy_bed, armchair, mystery_box, pink_desk } from '@/assets/furniture/orange_sofa';
import { supabase } from '@/integrations/supabase/client';
import { generateAssetPrompt, getDesignJSON } from '@/utils/promptGenerator';

import { FurnitureItem, FurnitureBoxPrimitive, CustomFurniture } from '@/types/furniture';

interface AssetGeneratorProps {
    onClose?: () => void;
    onSave?: (item: FurnitureItem, model: FurnitureBoxPrimitive[]) => void;
}

export function AssetGenerator({ onClose, onSave }: AssetGeneratorProps) {
    const [category, setCategory] = useState('furniture');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    // AI Gen State
    const [useRealAI, setUseRealAI] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [hue, setHue] = useState(0);
    const [refinementPrompt, setRefinementPrompt] = useState('');

    // Advanced Logic State
    const [isLogicOpen, setIsLogicOpen] = useState(false);
    const [optimizedPrompt, setOptimizedPrompt] = useState('');
    const [configJson, setConfigJson] = useState('');
    const [hasManuallyEditedLogic, setHasManuallyEditedLogic] = useState(false);

    React.useEffect(() => {
        const checkApiStatus = async () => {
            setApiStatus('checking');
            try {
                // Ensure we have the latest session
                await supabase.auth.getSession();

                const { error } = await supabase.functions.invoke('generate-asset', {
                    body: { ping: true }
                });

                // Check for 401 Unauthorized
                if (error && (error as any).status === 401) {
                    console.error("AI Status: 401 Unauthorized. Supabase function requires authentication.");
                    setApiStatus('offline');
                    return;
                }

                if (error && error.message?.includes('Failed to fetch')) {
                    setApiStatus('offline');
                } else {
                    setApiStatus('online');
                }
            } catch (err) {
                console.error("API ping failed:", err);
                setApiStatus('offline');
            }
        };
        checkApiStatus();
    }, []);

    // Sync logic from basic inputs
    React.useEffect(() => {
        if (!hasManuallyEditedLogic) {
            const newPrompt = generateAssetPrompt(category, name, description);
            const newJson = JSON.stringify(getDesignJSON(category, name, description), null, 2);
            setOptimizedPrompt(newPrompt);
            setConfigJson(newJson);
            // Also sync the main prompt field for the user
            setPrompt(description || name || "A cute isometric asset");
        }
    }, [category, name, description, hasManuallyEditedLogic]);

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

    const handleRefine = () => {
        if (!refinementPrompt) return;
        const refinedFullPrompt = `${prompt}. Refinement: ${refinementPrompt}`;
        setPrompt(refinedFullPrompt);
        generateAIWithPrompt(refinedFullPrompt);
        setRefinementPrompt('');
    };

    const generateAIWithPrompt = async (promptText: string) => {
        if (!promptText) return;
        setIsGenerating(true);
        setGeneratedImage(null);
        setErrorMsg(null);
        setIsEditing(false);

        if (useRealAI) {
            try {
                const { data, error } = await supabase.functions.invoke('generate-asset', {
                    body: { prompt: promptText, style_preset: 'isometric vector art' }
                });

                if (error) throw error;
                if (data.error) throw new Error(data.error);

                setGeneratedImage(data.image);
                setName(promptText.split(' ').slice(0, 3).join(' '));
            } catch (err: any) {
                console.error('AI Generation failed:', err);
                if (err.status === 401 || err.message?.includes('401')) {
                    setErrorMsg("Authentication Error (401). Please ensure you have deployed the function with the correct config.");
                } else if (err.message?.includes('FLOWITH_API_KEY')) {
                    setErrorMsg("Missing API Key. Please add 'FLOWITH_API_KEY' to your Supabase secrets.");
                } else {
                    setErrorMsg(`Generation failed: ${err.message || "Please check the Logic Panel or try Simulation Mode."}`);
                }
            } finally {
                setIsGenerating(false);
            }
        } else {
            const p = promptText.toLowerCase();
            let resultImage = mystery_box;
            let defaultName = 'AI Asset';

            // Rich Simulation Keywords
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
                if (p.includes('pink')) {
                    resultImage = pink_desk;
                    defaultName = 'Pastel Pink Desk';
                } else {
                    resultImage = wooden_table;
                    defaultName = 'Wooden Table';
                }
            } else if (p.includes('bed') || p.includes('sleep') || p.includes('bunk')) {
                resultImage = cozy_bed;
                defaultName = 'Cozy Bed';
            } else if (p.includes('chair') || p.includes('seat') || p.includes('stool')) {
                resultImage = armchair;
                defaultName = 'Armchair';
            } else if (p.includes('plain') || p.includes('grass') || p.includes('flower') || p.includes('green')) {
                // Using a placeholder or the most descriptive available asset for green plains
                // Since we don't have a specific plain asset, stay with mystery box but label it correctly
                // OR use a related asset if available. For now, let's keep mystery box but fix name.
                resultImage = mystery_box;
                defaultName = 'Green Plain with Flowers';
            } else {
                defaultName = 'Mystery Item';
            }

            setTimeout(() => {
                setIsGenerating(false);
                setGeneratedImage(resultImage);
                if (!name) setName(defaultName);
            }, 1000);
        }
    }

    const handleTriggerAIGenerator = () => {
        // Use optimizedPrompt for generation if logic is open or if we want better results
        generateAIWithPrompt(optimizedPrompt || prompt);
    };

    const handleSaveGenerated = () => {
        if (!generatedImage || !onSave) {
            alert('Please generate an image first!');
            return;
        }

        // Parse configJson if valid, otherwise use defaults
        let designParams = {};
        try {
            designParams = JSON.parse(configJson);
        } catch (e) {
            console.warn("Using default design params due to parse error", e);
        }

        const newItem: CustomFurniture = {
            id: `asset_ai_${Date.now()}`,
            name: name || 'AI Generated Asset',
            desc: description || prompt,
            type: 'sprite',
            cost: 100,
            size: [2, 1],
            height: 1,
            color: '#ffffff',
            icon: Wand2,
            spriteImages: [generatedImage, generatedImage, generatedImage, generatedImage],
            spriteScale: 1,
            price: 100,
            // Store the logic too if needed
            // @ts-ignore
            designParams
        };

        const placeholderModel: FurnitureBoxPrimitive[] = [{
            x: 0, y: 0, z: 0, w: 2, d: 1, h: 1, color: '#ff9966'
        }];

        onSave(newItem, placeholderModel);
        alert('AI Asset saved to inventory!');
        if (onClose) onClose();
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
                            <h2 className="text-2xl font-bold text-slate-800">AI Asset Generator</h2>
                            <p className="text-slate-500">Generate unique furniture with AI</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${apiStatus === 'online' ? 'bg-green-50 text-green-700 border-green-200' :
                            apiStatus === 'offline' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-gray-50 text-gray-700 border-gray-200'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-green-500 animate-pulse' :
                                apiStatus === 'offline' ? 'bg-red-500' :
                                    'bg-gray-400'
                                }`} />
                            {apiStatus === 'online' ? 'AI Systems Online' :
                                apiStatus === 'offline' ? 'AI Systems Offline' :
                                    'Checking Systems...'}
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 p-6 rounded-2xl border border-indigo-100 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-indigo-900">Asset Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="e.g. Vintage Record Player"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-indigo-900">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none"
                                        placeholder="Details like colors, materials..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-indigo-900">Asset Category</label>
                                    <select
                                        className="w-full p-3 rounded-xl border border-indigo-200 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-indigo-900">AI Engine</label>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-semibold ${useRealAI ? 'text-purple-600' : 'text-slate-500'}`}>
                                                {useRealAI ? 'DALL-E 3' : 'Isometric Sim'}
                                            </span>
                                            <button
                                                onClick={() => setUseRealAI(!useRealAI)}
                                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${useRealAI ? 'bg-purple-600' : 'bg-slate-300'}`}
                                            >
                                                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${useRealAI ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-white/60 rounded-xl border border-indigo-100 text-xs text-slate-500 flex items-center gap-2">
                                        <Zap size={14} className={useRealAI ? "text-purple-600" : "text-slate-400"} />
                                        {useRealAI ? 'Uses Supabase Edge Function with OpenAI' : 'Uses pre-loaded isometric asset library'}
                                    </div>
                                </div>

                                <div className="bg-white/40 p-4 rounded-xl border border-indigo-100/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-indigo-900 uppercase tracking-wider">AI Logic Panel</label>
                                        <button
                                            onClick={() => setIsLogicOpen(!isLogicOpen)}
                                            className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 transition-colors flex items-center gap-1"
                                        >
                                            {isLogicOpen ? <X size={12} /> : <Sliders size={12} />}
                                            {isLogicOpen ? "Hide Logic" : "Display Logic"}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-500 italic">
                                        Edit the underlying prompt and design JSON to fine-tune the AI brain.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {isLogicOpen && (
                            <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 border-t border-indigo-100 pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold text-indigo-900">Optimized AI Prompt</label>
                                            <button
                                                onClick={() => setHasManuallyEditedLogic(false)}
                                                className="text-[10px] text-indigo-600 hover:underline"
                                            >
                                                Reset to Auto
                                            </button>
                                        </div>
                                        <textarea
                                            value={optimizedPrompt}
                                            onChange={(e) => {
                                                setOptimizedPrompt(e.target.value);
                                                setHasManuallyEditedLogic(true);
                                            }}
                                            className="w-full h-32 p-3 text-xs font-mono rounded-lg border border-indigo-200 bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-indigo-900">Design Config JSON</label>
                                        <textarea
                                            value={configJson}
                                            onChange={(e) => {
                                                setConfigJson(e.target.value);
                                                setHasManuallyEditedLogic(true);
                                            }}
                                            className="w-full h-32 p-3 text-[10px] font-mono rounded-lg border border-indigo-200 bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-6 space-y-2">
                            <label className="block text-sm font-bold text-indigo-900">Custom Prompt Overlay (Final Tweak)</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="flex-1 border-indigo-200 rounded-xl p-4 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm bg-white"
                                    placeholder="e.g. A cute orange isometric sofa with yellow pillows..."
                                    onKeyDown={(e) => e.key === 'Enter' && handleTriggerAIGenerator()}
                                />
                                <button
                                    onClick={handleTriggerAIGenerator}
                                    disabled={isGenerating || (!prompt && !optimizedPrompt)}
                                    className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                                    Generate
                                </button>
                            </div>
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
                                            className="absolute top-2 right-2 p-2 bg-white/90 rounded-full shadow-md text-slate-600 hover:text-indigo-600 transition-all font-bold z-10"
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

                                        <div className="pt-2 border-t border-slate-200">
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Refine with Text</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={refinementPrompt}
                                                    onChange={(e) => setRefinementPrompt(e.target.value)}
                                                    placeholder="Make it blue..."
                                                    className="flex-1 text-xs border rounded p-2 outline-none focus:border-indigo-500"
                                                />
                                                <button
                                                    onClick={handleRefine}
                                                    disabled={!refinementPrompt}
                                                    className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                                >
                                                    Refine
                                                </button>
                                            </div>
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
                            <p className="animate-pulse">
                                {useRealAI ? 'Sending request to AI Brain...' : 'Dreaming up your asset...'}
                            </p>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 text-sm flex items-center gap-2">
                            <X size={16} />
                            {errorMsg}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
