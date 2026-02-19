import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, Database, FileText, Search, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
    parseCSVQuestions,
    parseNotionAPIResponse,
} from '../../utils/importParsers';

interface NotionImporterProps {
    title: string;
    description: string;
    onImport: (questions: any[], title: string, description: string) => void;
    onCancel: () => void;
}

export function NotionImporter({ title, description, onImport, onCancel }: NotionImporterProps) {
    const [mode, setMode] = useState<'api' | 'csv'>('api');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    // API Mode State
    const [databaseId, setDatabaseId] = useState('');

    // CSV Mode State
    const [fileInputKey, setFileInputKey] = useState(0);

    const handleFetchFromNotion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!databaseId.trim()) {
            setErrors(['Please enter a Notion Database ID']);
            return;
        }

        setIsLoading(true);
        setErrors([]);

        try {
            const { data, error } = await supabase.functions.invoke('notion-api/query-mcq-database', {
                body: { databaseId: databaseId.trim() }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);
            if (!data.results || data.results.length === 0) {
                throw new Error("No questions found in this database. Please check the property names.");
            }

            const questions = parseNotionAPIResponse(data.results);
            onImport(questions, title, description);
        } catch (err: any) {
            console.error("Notion API Error:", err);
            setErrors([
                err instanceof Error ? err.message : 'Failed to fetch from Notion',
                'Make sure the database is shared with the integration and ID is correct.'
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setErrors([]);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const csvText = event.target?.result as string;
                const questions = parseCSVQuestions(csvText);
                onImport(questions, title, description);
            } catch (err: any) {
                setErrors([err.message || "Failed to parse CSV."]);
            } finally {
                setIsLoading(false);
                setFileInputKey(prev => prev + 1);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h2 className="text-2xl font-bold text-gray-900">Import from Notion</h2>
            </div>

            <div className="space-y-8">
                {/* Mode Selection Tabs */}
                <div className="flex p-1 bg-gray-100 rounded-lg w-fit">
                    <button
                        onClick={() => { setMode('api'); setErrors([]); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'api' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <Database className="w-4 h-4" />
                        Connect Database (API)
                    </button>
                    <button
                        onClick={() => { setMode('csv'); setErrors([]); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'csv' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <FileText className="w-4 h-4" />
                        Upload CSV Export
                    </button>
                </div>

                {mode === 'api' ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect to Notion Database</h3>
                            <p className="text-gray-600 text-sm mb-4">
                                Enter the ID of your Notion database. Make sure the database has these properties:
                                <br />
                                <code className="bg-gray-100 px-1 py-0.5 rounded text-xs text-red-500">Question</code>,{' '}
                                <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Choice A</code>,{' '}
                                <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Choice B</code>,{' '}
                                <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Choice C</code>,{' '}
                                <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Choice D</code>,{' '}
                                <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Correct Answer</code>
                            </p>
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 mb-4">
                                <span className="font-bold">Tip:</span> The Database ID is the 32-character part of the URL:
                                <br />
                                <span className="font-mono text-gray-500">notion.so/my-workspace/</span>
                                <span className="font-mono font-bold bg-blue-100 px-1">a8aec43384f447ed84390e8e42c2e089</span>
                                <span className="font-mono text-gray-500">?v=...</span>
                            </div>
                        </div>

                        <form onSubmit={handleFetchFromNotion} className="flex gap-3">
                            <div className="flex-1 relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={databaseId}
                                    onChange={(e) => setDatabaseId(e.target.value)}
                                    placeholder="Paste Database ID (e.g., a8aec43384f447ed84390e8e42c2e089)"
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow shadow-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading || !databaseId}
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Fetching...
                                    </>
                                ) : (
                                    <>Fetch Questions</>
                                )}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Notion CSV Export</h3>
                        <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                            <li>Open your Notion database</li>
                            <li>Click the <span className="font-bold">•••</span> menu at the top right</li>
                            <li>Select <span className="font-bold">Export</span></li>
                            <li>Choose <span className="font-bold">Markdown & CSV</span> format</li>
                            <li>Unzip the downloaded file and upload the CSV below</li>
                        </ol>

                        <div className="relative">
                            <input
                                key={fileInputKey}
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="notion-csv-upload"
                            />
                            <label
                                htmlFor="notion-csv-upload"
                                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-all"
                            >
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <FileText className="w-8 h-8 text-gray-400 mb-2" />
                                    <p className="mb-1 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                    <p className="text-xs text-gray-400">Notion CSV export</p>
                                </div>
                            </label>
                        </div>
                    </div>
                )}

                {errors.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-red-900 mb-2">Import Error</p>
                                <ul className="space-y-1">
                                    {errors.map((error, idx) => (
                                        <li key={idx} className="text-sm text-red-700">• {error}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
