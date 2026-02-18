import React, { useState } from 'react';
import { Sparkles, Image as ImageIcon, RefreshCw, Save, Check } from 'lucide-react';
import { generate_flowith_image, FLOWITH_IMAGE_MODELS } from '../../utils/flowithImageApi';
import { saveGeneratedImageToAssets } from '../../utils/saveAiImage';
import { ASSET_CONTEXTS } from '../../constants/assetCategories';

export const FlowithImageGen: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [model, setModel] = useState('google-nano-banana-pro');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedContext, setSelectedContext] = useState('general');

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        setLoading(true);
        setError(null);
        setImageUrl(null);
        setSaveSuccess(false);

        try {
            const url = await generate_flowith_image(prompt, model);
            setImageUrl(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate image');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!imageUrl || !prompt) return;

        setSaving(true);
        try {
            const asset = await saveGeneratedImageToAssets(imageUrl, prompt, selectedContext);
            if (asset) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
            } else {
                throw new Error('Failed to save asset');
            }
        } catch (err) {
            setError('Failed to save image to gallery');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl mx-auto my-8">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                    <Sparkles size={20} />
                    <h2 className="font-bold text-lg">AI Illustrator</h2>
                </div>
                <div className="text-xs text-purple-100 bg-purple-700/50 px-2 py-1 rounded">
                    {model}
                </div>
            </div>

            <div className="p-6">
                <form onSubmit={handleGenerate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Image Description
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="A cute cartoon cat sitting on a mat..."
                            className="w-full h-24 px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                            required
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-slate-50"
                        >
                            {FLOWITH_IMAGE_MODELS.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>

                        <button
                            type="submit"
                            disabled={loading || !prompt.trim()}
                            className={`
                                flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all
                                ${loading || !prompt.trim()
                                    ? 'bg-slate-300 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg active:scale-95'
                                }
                            `}
                        >
                            {loading ? (
                                <>
                                    <RefreshCw className="animate-spin" size={18} />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <ImageIcon size={18} />
                                    Generate Art
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {error && (
                    <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                        Error: {error}
                    </div>
                )}

                {imageUrl && (
                    <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="relative group rounded-xl overflow-hidden shadow-lg border border-slate-100 bg-slate-50">
                            <img
                                src={imageUrl}
                                alt={prompt}
                                className="w-full h-auto object-cover max-h-[500px]"
                            />

                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                <a
                                    href={imageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition"
                                    title="Open Full Size"
                                >
                                    <ImageIcon size={24} />
                                </a>

                                <div className="flex items-center gap-2 bg-white rounded-full p-1 shadow-lg">
                                    <select
                                        value={selectedContext}
                                        onChange={(e) => setSelectedContext(e.target.value)}
                                        className="text-xs bg-transparent border-none focus:ring-0 text-slate-600 font-medium py-1 pl-2 pr-1 cursor-pointer outline-none"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {ASSET_CONTEXTS.map(ctx => (
                                            <option key={ctx.id} value={ctx.id}>{ctx.label}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSave();
                                        }}
                                        disabled={saving || saveSuccess}
                                        className={`p-2 rounded-full transition-all ${saveSuccess
                                            ? 'bg-green-500 text-white'
                                            : 'bg-purple-600 text-white hover:bg-purple-700'
                                            }`}
                                        title="Save to Asset Gallery"
                                    >
                                        {saving ? (
                                            <RefreshCw className="animate-spin" size={20} />
                                        ) : saveSuccess ? (
                                            <Check size={20} />
                                        ) : (
                                            <Save size={20} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-400">
                            <p>Generated with {model}</p>
                            {saveSuccess && <span className="text-green-600 font-medium fa-fade">Saved to Gallery!</span>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
