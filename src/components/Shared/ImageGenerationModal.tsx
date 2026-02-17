import { useState, useEffect } from "react";
import { X, Key, Loader2, Save, Download, Sparkles } from "lucide-react";
import { localAiService } from "@/utils/localAiService";

interface ImageGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImageSelected: (url: string) => void;
    initialPrompt?: string;
}

export function ImageGenerationModal({
    isOpen,
    onClose,
    onImageSelected,
    initialPrompt = "",
}: ImageGenerationModalProps) {
    const [apiKey, setApiKey] = useState("");
    const [hasKey, setHasKey] = useState(false);
    const [activeTab, setActiveTab] = useState<'generate' | 'settings'>('generate');

    const [prompt, setPrompt] = useState(initialPrompt);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            const key = localAiService.getKey();
            if (key) {
                setApiKey(key);
                setHasKey(true);
            } else {
                setHasKey(false);
                setActiveTab('settings');
            }
            if (initialPrompt) setPrompt(initialPrompt);
        }
    }, [isOpen, initialPrompt]);

    const handleSaveKey = () => {
        if (apiKey.trim().startsWith('sk-')) {
            localAiService.saveKey(apiKey.trim());
            setHasKey(true);
            setActiveTab('generate');
            setError(null);
        } else {
            setError("Invalid API Key format. It should start with 'sk-'.");
        }
    };

    const handleClearKey = () => {
        localAiService.removeKey();
        setApiKey("");
        setHasKey(false);
        setActiveTab('settings');
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Please enter a prompt");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setGeneratedImageUrl(null);

        try {
            const url = await localAiService.generateImage(prompt);
            setGeneratedImageUrl(url);
        } catch (err: any) {
            setError(err.message || "Failed to generate image");
            if (err.message && (err.message.includes("401") || err.message.includes("key"))) {
                setActiveTab('settings');
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUseImage = async () => {
        if (!generatedImageUrl) return;

        try {
            setIsGenerating(true); // Re-use loading state for upload
            // The URL from OpenAI is temporary, so we MUST upload it to our storage
            const permanentUrl = await localAiService.uploadToSupabase(generatedImageUrl);
            onImageSelected(permanentUrl);
            onClose();
        } catch (err: any) {
            setError("Failed to save image: " + err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <Sparkles className="w-5 h-5" />
                        <h2 className="font-bold text-lg">AI Image Generator</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('generate')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'generate'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Generate
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'settings'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Settings
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2">
                            <span className="font-bold">Error:</span> {error}
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                                <p className="font-semibold mb-1 flex items-center gap-2">
                                    <Key className="w-4 h-4" />
                                    Security Notice
                                </p>
                                <p>Your API Key is stored locally in your browser and is sent directly to OpenAI. It is never sent to our servers.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key</label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="sk-..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveKey}
                                    disabled={!apiKey}
                                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Key Locally
                                </button>
                                {hasKey && (
                                    <button
                                        onClick={handleClearKey}
                                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'generate' && (
                        <div className="space-y-4">
                            {!hasKey && (
                                <div className="text-center py-8 text-gray-500">
                                    <Key className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                    <p>Please configure your API Key in Settings first.</p>
                                    <button onClick={() => setActiveTab('settings')} className="mt-4 text-indigo-600 font-medium hover:underline">Go to Settings</button>
                                </div>
                            )}

                            {hasKey && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
                                        <textarea
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            placeholder="Describe the image you want to generate..."
                                            rows={3}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                        />
                                    </div>

                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating || !prompt}
                                        className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-5 h-5" />
                                                Generate Image
                                            </>
                                        )}
                                    </button>

                                    {generatedImageUrl && (
                                        <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                            <div className="relative rounded-xl overflow-hidden border border-gray-200 aspect-square group">
                                                <img src={generatedImageUrl} alt="Generated" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                            </div>

                                            <button
                                                onClick={handleUseImage}
                                                disabled={isGenerating} // Disable while uploading
                                                className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                                            >
                                                {isGenerating ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Saving...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Download className="w-5 h-5" />
                                                        Use This Image
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
