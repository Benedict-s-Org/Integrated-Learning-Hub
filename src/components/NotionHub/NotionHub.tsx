import React, { useState, useEffect } from 'react';
import { ExternalLink, AlertCircle, RefreshCw, Lock } from 'lucide-react';

interface NotionHubProps {
    initialUrl?: string;
}

export const NotionHub: React.FC<NotionHubProps> = ({
    initialUrl = 'https://www.notion.so/'
}) => {
    const [url, setUrl] = useState(initialUrl);
    const [inputUrl, setInputUrl] = useState(initialUrl);

    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [key, setKey] = useState(0); // To force iframe refresh

    useEffect(() => {
        setInputUrl(url);
    }, [url]);

    const handleReload = () => {
        setIsLoading(true);
        setHasError(false);
        setKey(prev => prev + 1);
    };

    const handleUrlSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputUrl !== url) {
            let finalUrl = inputUrl;
            // Basic scheme validation
            if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
                finalUrl = 'https://' + finalUrl;
            }
            setUrl(finalUrl);
            setIsLoading(true);
            setHasError(false);
            setKey(prev => prev + 1);
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-white">
            {/* Browser-like Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 bg-gray-50 shrink-0 shadow-sm z-10">
                {/* Controls */}
                <div className="flex items-center gap-2 text-gray-500">
                    <button
                        onClick={handleReload}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                    </button>
                </div>

                {/* Address Bar */}
                <form onSubmit={handleUrlSubmit} className="flex-1 max-w-4xl mx-auto relative flex items-center">
                    <div className="absolute left-3 text-gray-400 pointer-events-none">
                        <Lock size={14} />
                    </div>
                    <input
                        type="text"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all shadow-sm"
                        placeholder="Enter Notion URL..."
                    />
                </form>

                {/* Actions */}
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap"
                    title="Open in new tab"
                >
                    <ExternalLink size={16} />
                    <span className="hidden sm:inline">Open External</span>
                </a>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative w-full h-full bg-gray-100 overflow-hidden">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-10 transition-opacity duration-300">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
                            <p className="text-gray-500 text-sm font-medium">Loading content...</p>
                        </div>
                    </div>
                )}

                <iframe
                    key={key}
                    src={url}
                    className="w-full h-full border-0 block"
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                        setIsLoading(false);
                        setHasError(true);
                    }}
                    title="Notion Content"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                // Note: sandbox attribute might block navigation but is safer. 
                // For Notion full functionality sandbox usually needs to be omitted or very permissive.
                />

                {hasError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
                        <div className="max-w-md p-8 bg-red-50 rounded-2xl text-center border border-red-100 shadow-xl m-4">
                            <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                            <h3 className="text-lg font-bold text-red-700 mb-2">Notion Embedding Restricted</h3>
                            <div className="text-gray-600 mb-6 text-sm leading-relaxed text-left space-y-2">
                                <p><strong>Why is this happening?</strong><br />
                                    Notion prevents their standard pages (notion.so) from being embedded inside other websites for security.</p>

                                <p><strong>How to fix it:</strong></p>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Use a tool like <b>Super.so</b>, <b>Potion</b>, or <b>Fruition</b> to turn your Notion page into a website.</li>
                                    <li>Or simply open the page in a new tab below.</li>
                                </ul>
                            </div>
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm shadow-md shadow-red-200"
                            >
                                Open in New Tab
                                <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
