import { useState, useEffect } from 'react';
import { Sparkles, Wand2, Loader2, X, Sliders, Zap, Package, Grid } from 'lucide-react';
import { orange_sofa, wooden_bookshelf, round_rug, floor_lamp, wooden_table, cozy_bed, armchair, mystery_box, pink_desk } from '@/assets/furniture/orange_sofa';
import { supabase } from '@/integrations/supabase/client';
import { generateAssetPrompt, getDesignJSON } from '@/utils/promptGenerator';
import { useMemoryPalaceContext } from '@/contexts/MemoryPalaceContext';

import { FurnitureItem, FurnitureBoxPrimitive, CustomFurniture } from '@/types/furniture';

interface AssetGeneratorProps {
    onClose?: () => void;
    onSave?: (item: FurnitureItem, model: FurnitureBoxPrimitive[]) => void;
}

export function AssetGenerator({ onClose, onSave }: AssetGeneratorProps) {
    const { fullCatalog } = useMemoryPalaceContext();
    const [category, setCategory] = useState('furniture');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    // AI Gen State
    const [useRealAI, setUseRealAI] = useState(true);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [selectedModel, setSelectedModel] = useState('nano-banana-pro');

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [hue, setHue] = useState(0);

    // Advanced Logic State
    const [isLogicOpen, setIsLogicOpen] = useState(false);
    const [optimizedPrompt, setOptimizedPrompt] = useState('');
    const [configJson, setConfigJson] = useState('');
    const [hasManuallyEditedLogic, setHasManuallyEditedLogic] = useState(false);

    useEffect(() => {
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
    useEffect(() => {
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


    const getReferenceImages = () => {
        // Collect all unique sprite images from custom assets
        const urls = new Set<string>();
        fullCatalog.forEach(item => {
            if (item.type === 'sprite' && Array.isArray(item.spriteImages)) {
                item.spriteImages.forEach((img: any) => {
                    if (typeof img === 'string' && img.startsWith('http')) {
                        urls.add(img);
                    }
                });
            }
        });
        // We take the latest ones (end of the list usually)
        return Array.from(urls).reverse().slice(0, 5);
    };

    const generateAIWithPrompt = async (promptText: string) => {
        if (!promptText) return;
        setIsGenerating(true);
        setGeneratedImage(null);
        setErrorMsg(null);
        setIsEditing(false);

        if (useRealAI) {
            console.log('🚀 AI Engine: Real AI (Flowith)');
            try {
                const referenceImages = getReferenceImages();
                console.log(`Sending ${referenceImages.length} style references to AI`);

                const payload = {
                    prompt: promptText,
                    style_preset: 'isometric vector art',
                    reference_images: referenceImages
                };
                const functionUrl = `${(supabase as any).functions.url}/generate-asset`;
                console.log('Invoke generate-asset at:', functionUrl, 'with payload:', payload);

                const { data, error } = await supabase.functions.invoke('generate-asset', {
                    body: { ...payload, model: selectedModel }
                });

                console.log('Invoke Result:', { data, error });

                if (error) {
                    console.error('Function Invoke Error Object:', error);
                    let errMsg = error.message || "Unknown invocation error";
                    if (errMsg.includes('Unexpected token')) {
                        errMsg = "The server returned an invalid response (HTML instead of JSON). This usually means the Edge Function crashed too early or the URL is wrong.";
                    }
                    throw new Error(errMsg);
                }

                if (data.error || data.success === false) {
                    const errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
                    throw new Error(errorMsg || "Generation failed with no error message");
                }

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
            console.log('🎮 AI Engine: Isometric Simulation (Fallback)');
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
        // Use optimizedPrompt if the logic panel is open, otherwise use the simpler prompt
        generateAIWithPrompt(isLogicOpen ? optimizedPrompt : prompt);
    };

    const handleSaveAsCityStyle = async () => {
        if (!generatedImage) {
            alert('Please generate an image first!');
            return;
        }

        try {
            const { error } = await supabase
                .from('city_style_assets')
                .insert({
                    name: name || 'AI City Style',
                    asset_type: category === 'city_building' ? 'building' : category === 'decoration' ? 'decoration' : 'building',
                    image_url: generatedImage,
                    config: {
                        prompt: prompt,
                        optimizedPrompt: optimizedPrompt,
                        description: description,
                        category: category
                    }
                });

            if (error) throw error;
            alert('City Style Asset saved successfully!');
            if (onClose) onClose();
        } catch (err: any) {
            console.error('Error saving city style:', err);
            alert('Failed to save city style: ' + err.message);
        }
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
            icon: null,
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
        <div className="flex-1 flex flex-col min-h-0 bg-background/50 p-6 overflow-hidden font-bold">
            <div className="flex-1 flex gap-8 overflow-hidden">
                {/* Left Column: Generator Controls */}
                <div className="w-[480px] flex flex-col gap-6 overflow-y-auto pr-2 pb-6">
                    {/* Basic Info Card */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-primary/5 border-2 border-primary/5 flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-primary flex items-center gap-3">
                                <Sparkles className="w-7 h-7 p-1.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20" />
                                靈感來源
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-full border border-primary/10">
                                    <div className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 animate-pulse'}`} />
                                    <span className="text-[10px] text-primary/60 uppercase tracking-tighter">AI {apiStatus === 'online' ? '已連線' : '離線'}</span>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full text-primary/40 transition-all">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-primary/50 uppercase ml-2 tracking-widest">家具名稱</label>
                                    <input
                                        type="text"
                                        placeholder="例如: 夢幻雲朵沙發"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-5 py-3.5 rounded-2xl bg-secondary/30 border-2 border-transparent focus:border-primary/20 focus:bg-white transition-all outline-none text-sm placeholder:text-primary/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-primary/50 uppercase ml-2 tracking-widest">類別</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full px-5 py-3.5 rounded-2xl bg-secondary/30 border-2 border-transparent focus:border-primary/20 focus:bg-white transition-all outline-none text-sm cursor-pointer appearance-none"
                                    >
                                        <option value="furniture">家具 (Sofa, Table)</option>
                                        <option value="decoration">裝飾 (Lamp, Rug)</option>
                                        <option value="map_element">地圖元素 (Tree, Rock)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-primary/50 uppercase ml-2 tracking-widest">描述資訊</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="描述一下這個家具的風格..."
                                    rows={3}
                                    className="w-full px-5 py-4 rounded-3xl bg-secondary/30 border-2 border-transparent focus:border-primary/20 focus:bg-white transition-all outline-none text-sm resize-none placeholder:text-primary/20 leading-relaxed"
                                />
                            </div>
                        </div>
                    </div>

                    {/* AI Logic Panel */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-primary/5 border-2 border-primary/5 flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Zap className="w-5 h-5 text-primary" />
                                <h3 className="text-sm font-black text-primary uppercase tracking-widest">生成核心設定</h3>
                            </div>
                            <button
                                onClick={() => setIsLogicOpen(!isLogicOpen)}
                                className={`p-2 rounded-xl transition-all ${isLogicOpen ? 'bg-primary text-white' : 'bg-primary/5 text-primary hover:bg-primary/10'}`}
                            >
                                <Sliders size={18} />
                            </button>
                        </div>

                        {isLogicOpen && (
                            <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-primary/40 uppercase ml-2">模型選擇</label>
                                        <div className="flex bg-secondary/50 p-1.5 rounded-2xl gap-1">
                                            {['nano-banana-pro', 'flux'].map(m => (
                                                <button
                                                    key={m}
                                                    onClick={() => setSelectedModel(m)}
                                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${selectedModel === m ? 'bg-white text-primary shadow-sm' : 'text-primary/40 hover:text-primary'}`}
                                                >
                                                    {m === 'nano-banana-pro' ? 'Banana' : 'Flux'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-primary/40 uppercase ml-2">生成模式</label>
                                        <div className="flex bg-secondary/50 p-1.5 rounded-2xl gap-1">
                                            <button
                                                onClick={() => setUseRealAI(true)}
                                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${useRealAI ? 'bg-white text-primary shadow-sm' : 'text-primary/40 hover:text-primary'}`}
                                            >
                                                AI 生成
                                            </button>
                                            <button
                                                onClick={() => setUseRealAI(false)}
                                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${!useRealAI ? 'bg-white text-primary shadow-sm' : 'text-primary/40 hover:text-primary'}`}
                                            >
                                                本地庫
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center ml-2">
                                        <label className="text-[10px] font-black text-primary/40 uppercase">進階優化指令</label>
                                        <button onClick={() => setHasManuallyEditedLogic(false)} className="text-[9px] text-primary hover:underline">回復預設</button>
                                    </div>
                                    <textarea
                                        value={optimizedPrompt}
                                        onChange={(e) => { setOptimizedPrompt(e.target.value); setHasManuallyEditedLogic(true); }}
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-2xl bg-secondary/30 border border-primary/10 text-[10px] font-mono focus:bg-white outline-none"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleTriggerAIGenerator}
                            disabled={isGenerating || (!prompt && !optimizedPrompt)}
                            className="w-full h-16 bg-gradient-to-r from-primary to-accent text-white rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all transform disabled:opacity-50 disabled:scale-100"
                        >
                            {isGenerating ? <Loader2 className="animate-spin" /> : "開始施展魔法生成 ✨"}
                        </button>
                    </div>
                </div>

                {/* Right Column: Preview & Actions */}
                <div className="flex-1 flex flex-col gap-8 overflow-hidden">
                    {/* Preview Canvas */}
                    <div className="flex-1 bg-white rounded-[3rem] shadow-2xl shadow-primary/5 border-8 border-white relative flex flex-col items-center justify-center group overflow-hidden">
                        {/* Static Grid Background */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none"
                            style={{ backgroundImage: 'radial-gradient(var(--primary) 1px, transparent 1px)', backgroundSize: '30px 30px' }}
                        />

                        {/* Content */}
                        <div className="relative z-10 p-12 transition-all duration-700 transform group-hover:scale-110">
                            {generatedImage ? (
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full scale-150 animate-sparkle" />
                                    <img
                                        src={generatedImage}
                                        alt="Generated"
                                        className="max-w-[500px] max-h-[500px] object-contain relative z-10 drop-shadow-[0_40px_80px_rgba(0,0,0,0.25)] filter"
                                        style={{ filter: isEditing ? `brightness(${brightness}%) contrast(${contrast}%) hue-rotate(${hue}deg)` : 'none' }}
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-6 text-primary/20">
                                    <Wand2 size={96} className="animate-sway" />
                                    <div className="text-center">
                                        <p className="font-black text-2xl uppercase tracking-[0.2em] mb-2">等待召喚...</p>
                                        <p className="text-sm font-bold opacity-50">在左側輸入描述來創造你的家具</p>
                                    </div>
                                </div>
                            )}

                            {isGenerating && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-sm z-50 rounded-[2rem]">
                                    <div className="w-24 h-24 relative">
                                        <div className="absolute inset-0 border-8 border-primary/20 rounded-full" />
                                        <div className="absolute inset-0 border-8 border-primary border-t-transparent rounded-full animate-spin" />
                                    </div>
                                    <p className="mt-6 text-primary font-black animate-bounce">AI 正在畫室裡精心描繪中...</p>
                                </div>
                            )}
                        </div>

                        {/* Floating Interaction Controls */}
                        {generatedImage && !isGenerating && (
                            <div className="absolute bottom-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className={`px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl transition-all ${isEditing ? 'bg-primary text-white' : 'bg-white text-primary hover:bg-secondary'}`}
                                >
                                    <Sliders size={18} />
                                    微調外觀
                                </button>
                            </div>
                        )}

                        {/* Refine Overlay */}
                        {isEditing && (
                            <div className="absolute top-10 right-10 w-72 bg-white/70 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl border-2 border-white space-y-6 animate-in slide-in-from-right-8 duration-500">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black text-primary/60 uppercase">
                                            <span>亮度</span>
                                            <span>{brightness}%</span>
                                        </div>
                                        <input type="range" min="50" max="150" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full accent-primary h-2 bg-primary/10 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black text-primary/60 uppercase">
                                            <span>對比</span>
                                            <span>{contrast}%</span>
                                        </div>
                                        <input type="range" min="50" max="150" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full accent-primary h-2 bg-primary/10 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black text-primary/60 uppercase">
                                            <span>色相</span>
                                            <span>{hue}°</span>
                                        </div>
                                        <input type="range" min="-180" max="180" value={hue} onChange={(e) => setHue(Number(e.target.value))} className="w-full accent-primary h-2 bg-primary/10 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                </div>
                                <button onClick={processImage} className="w-full py-3 bg-primary text-white rounded-xl font-black text-xs hover:opacity-90 transition-all shadow-lg shadow-primary/20">套用設定</button>
                            </div>
                        )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex gap-4 p-1">
                        <button
                            onClick={handleSaveGenerated}
                            disabled={!generatedImage || isGenerating}
                            className="flex-1 h-20 bg-white border-4 border-primary/20 text-primary rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 transition-all hover:bg-primary/5 hover:border-primary/40 disabled:opacity-30 active:scale-95 shadow-xl shadow-primary/5"
                        >
                            <Package size={28} />
                            存入背包
                        </button>
                        <button
                            onClick={handleSaveAsCityStyle}
                            disabled={!generatedImage || isGenerating}
                            className="flex-1 h-20 bg-primary text-white rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 transition-all hover:opacity-90 shadow-2xl shadow-primary/30 disabled:opacity-30 active:scale-95"
                        >
                            <Grid size={28} />
                            發布到商店
                        </button>
                    </div>
                </div>
            </div>

            {errorMsg && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-rose-50 border-2 border-rose-200 text-rose-600 px-8 py-4 rounded-3xl font-black animate-in slide-in-from-top-10 shadow-2xl flex items-center gap-3 z-[100]">
                    <span className="text-xl">⚠️</span>
                    {errorMsg}
                    <button onClick={() => setErrorMsg(null)} className="ml-4 hover:opacity-50">✕</button>
                </div>
            )}
        </div>
    );
}
