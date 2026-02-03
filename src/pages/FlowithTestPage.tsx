import React, { useState } from 'react';
import { Sparkles, Send, Image as ImageIcon } from 'lucide-react';
import { call_flowith_api } from '../utils/flowithApi';

export const FlowithTestPage: React.FC = () => {
    const [query, setQuery] = useState('');
    const [kbIds, setKbIds] = useState('');
    const [model, setModel] = useState('google nano banana pro');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);
        setError(null);

        try {
            // Split kbIds by comma and clean up whitespace
            const kbList = kbIds ? kbIds.split(',').map(id => id.trim()).filter(Boolean) : [];

            const response = await call_flowith_api(query, kbList, model);
            setResult(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred calling Flowith API');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <Sparkles className="text-purple-600" />
                    Flowith API Playground
                </h1>
                <p className="text-gray-600 mt-2">Test image generation and knowledge retrieval.</p>
            </div>

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
                            <input
                                type="text"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                placeholder="Model Name"
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                            />
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
