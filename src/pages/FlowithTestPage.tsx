import React, { useState, useEffect } from 'react';
import { Sparkles, Send, Image as ImageIcon } from 'lucide-react';
import { call_flowith_api, get_flowith_models } from '../utils/flowithApi';
import { FlowithImageGen } from '../components/flowith/FlowithImageGen'; // Import the new component
import { useAuth } from '../context/AuthContext';

// Saved Prompt Interface
interface SavedPrompt {
    id: string;
    name: string;
    query: string;
    kbIds: string;
    refDesc: string;
    model: string;
    timestamp: number;
}

export const FlowithTestPage: React.FC = () => {
    const { session } = useAuth();
    const [query, setQuery] = useState('');
    const [kbIds, setKbIds] = useState('');
    const [model, setModel] = useState('google nano banana pro');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [apiErrorDetail, setApiErrorDetail] = useState<string | null>(null);

    // Saved Prompts State
    const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
    const [showSavedList, setShowSavedList] = useState(false);

    const [refDesc, setRefDesc] = useState('');

    // Load saved prompts from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('flowith_saved_prompts');
        if (saved) {
            try {
                setSavedPrompts(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse saved prompts', e);
            }
        }
    }, []);

    useEffect(() => {
        const checkStatus = async () => {
            console.log("Flowith Center: Checking status. Session:", !!session);
            if (!session) {
                console.warn("Flowith Center: No active session. API call skipped.");
                return;
            }

            setApiStatus('checking');
            try {
                const models = await get_flowith_models();
                setAvailableModels(models);
                setApiStatus('online');
                setApiErrorDetail(null);
                if (models.length > 0 && !models.includes('google nano banana pro')) {
                    setModel(models[0]);
                }
            } catch (err) {
                console.error('Failed to load models:', err);
                setApiStatus('offline');
                setApiErrorDetail(err instanceof Error ? err.message : String(err));
            }
        };

        if (session) {
            checkStatus();
        }
    }, [session]);

    const saveCurrentPrompt = () => {
        if (!query.trim()) {
            alert('Please enter a query to save.');
            return;
        }
        const name = prompt('Enter a name for this prompt preset:', query.slice(0, 20) + '...');
        if (!name) return;

        const newPrompt: SavedPrompt = {
            id: Date.now().toString(),
            name,
            query,
            kbIds,
            refDesc,
            model,
            timestamp: Date.now()
        };

        const updated = [newPrompt, ...savedPrompts];
        setSavedPrompts(updated);
        localStorage.setItem('flowith_saved_prompts', JSON.stringify(updated));
    };

    const loadPrompt = (p: SavedPrompt) => {
        setQuery(p.query);
        setKbIds(p.kbIds);
        setRefDesc(p.refDesc);
        setModel(p.model);
        setShowSavedList(false);
    };

    const deletePrompt = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this saved prompt?')) return;

        const updated = savedPrompts.filter(p => p.id !== id);
        setSavedPrompts(updated);
        localStorage.setItem('flowith_saved_prompts', JSON.stringify(updated));
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);
        setError(null);

        try {
            // Split kbIds by comma and clean up whitespace
            const kbList = kbIds ? kbIds.split(',').map(id => id.trim()).filter(Boolean) : [];



            const response = await call_flowith_api(
                query,
                model,
                kbList
            );
            setResult(response.content);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred calling Flowith API');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-12">
            {/* Image Generation Section */}
            <FlowithImageGen />

            <div className="border-t border-slate-200 my-8"></div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <Sparkles className="text-purple-600" />
                        Flowith Center
                    </h1>
                    <p className="text-gray-600 mt-2">Test knowledge retrieval and AI capabilities.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 border ${apiStatus === 'online' ? 'bg-green-50 text-green-700 border-green-200' :
                        apiStatus === 'offline' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-green-500 animate-pulse' :
                            apiStatus === 'offline' ? 'bg-red-500' :
                                'bg-gray-400'
                            }`} />
                        {apiStatus === 'online' ? 'API Online' :
                            apiStatus === 'offline' ? 'API Offline' :
                                'Checking API...'}
                    </div>
                </div>

                <div className="relative">
                    <div className="flex bg-white rounded-lg shadow-sm border border-gray-200">
                        <button
                            onClick={() => setShowSavedList(!showSavedList)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border-r border-gray-200 flex items-center gap-2"
                        >
                            <span>📂 Prompt Library</span>
                            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">{savedPrompts.length}</span>
                        </button>
                        <button
                            onClick={saveCurrentPrompt}
                            className="px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 flex items-center gap-1"
                            title="Save current inputs as preset"
                        >
                            <span>💾 Save Current</span>
                        </button>
                    </div>

                    {showSavedList && (
                        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-10 max-h-96 overflow-y-auto">
                            <div className="p-3 border-b border-gray-100 font-medium text-gray-900 bg-gray-50 flex justify-between items-center rounded-t-xl">
                                <span>Saved Presets</span>
                                <button onClick={() => setShowSavedList(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                            </div>

                            {savedPrompts.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 text-sm">
                                    No saved prompts yet. Save one to see it here!
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {savedPrompts.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => loadPrompt(p)}
                                            className="p-3 hover:bg-purple-50 cursor-pointer group transition-colors"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="font-medium text-gray-800 text-sm">{p.name}</h4>
                                                <button
                                                    onClick={(e) => deletePrompt(p.id, e)}
                                                    className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete preset"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-500 line-clamp-2">{p.query}</p>
                                            <div className="flex gap-2 mt-2">
                                                <span className="text-[10px] uppercase bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">{p.model}</span>
                                                {p.refDesc && <span className="text-[10px] uppercase bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-100">Style</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {apiStatus === 'offline' && apiErrorDetail && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">API Connection Error</h3>
                            <div className="mt-1 text-sm text-red-700">
                                <p className="font-mono bg-red-100/50 p-2 rounded mt-2 overflow-x-auto whitespace-pre-wrap">
                                    {apiErrorDetail}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">

                <form onSubmit={handleSubmit} className="p-6 space-y-6">

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Prompt / Query
                        </label>
                        <textarea
                            required
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Describe the image you want to generate or ask a question..."
                            className="w-full h-32 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Knowledge Base IDs (Optional)
                            </label>
                            <input
                                type="text"
                                value={kbIds}
                                onChange={(e) => setKbIds(e.target.value)}
                                placeholder="kb_123, kb_456"
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">Comma separated IDs</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Model
                            </label>
                            <select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm bg-white"
                            >
                                {availableModels.length > 0 ? (
                                    availableModels.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))
                                ) : (
                                    <>
                                        <option value="google nano banana pro">google nano banana pro</option>
                                        <option value="gpt-4o-mini">gpt-4o-mini</option>
                                    </>
                                )}
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all
                ${loading || !query.trim()
                                    ? 'bg-gray-300 cursor-not-allowed'
                                    : 'bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg active:transform active:scale-95'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Send size={18} />
                                    Send Request
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {(result || error) && (
                    <div className="border-t border-gray-100 bg-gray-50 p-6">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                            Response Output
                        </h3>

                        {error ? (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap">
                                Error: {error}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                                    {/* Heuristic to detect if result is an image URL */}
                                    {result && (result.startsWith('http') && (result.match(/\.(jpeg|jpg|gif|png|webp)$/) || result.includes('images'))) ? (
                                        <div className="flex flex-col items-center">
                                            <img
                                                src={result}
                                                alt="Generated content"
                                                className="max-w-full rounded-lg shadow-md mb-2"
                                                onError={(e) => {
                                                    // Fallback if image fails to load or isn't actually an image
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                            <a href={result} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline text-sm flex items-center gap-1">
                                                <ImageIcon size={14} /> Open Original
                                            </a>
                                        </div>
                                    ) : (
                                        /* Render as text */
                                        <div className="prose prose-purple max-w-none text-gray-800">
                                            <pre className="whitespace-pre-wrap text-sm font-sans">{result}</pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
