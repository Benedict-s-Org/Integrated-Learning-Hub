import React, { useState } from 'react';
import { BookOpen, AlertCircle, CheckCircle, ArrowLeft, Database, FileText, Search, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
    parseCSVQuestions,
    parseNotionAPIResponse,
    validateImportedQuestions,
    ImportedQuestion,
} from '../../utils/importParsers';

interface NotionImporterProps {
    title: string;
    description: string;
    onImport: (questions: ImportedQuestion[], setTitle: string, setDescription: string) => void;
    onCancel: () => void;
}

export function NotionImporter({ title: initialTitle, description: initialDescription, onImport, onCancel }: NotionImporterProps) {
    const [mode, setMode] = useState<'api' | 'csv'>('api');
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState(initialDescription);

    // API Mode State
    const [databaseId, setDatabaseId] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // CSV Mode State
    const [fileInputKey, setFileInputKey] = useState(0);

    // Shared State
    const [parsedQuestions, setParsedQuestions] = useState<ImportedQuestion[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [step, setStep] = useState<'connect' | 'preview'>('connect');

    // ─── API Mode Handlers ──────────────────────────────────────────────

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

            const parsed = parseNotionAPIResponse(data.results || []);
            handleParsedResult(parsed);
        } catch (err) {
            console.error('Notion API Error:', err);
            setErrors([
                err instanceof Error ? err.message : 'Failed to fetch from Notion',
                'Make sure the database is shared with the integration and ID is correct.'
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    // ─── CSV Mode Handlers ──────────────────────────────────────────────

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            const parsed = parseCSVQuestions(content);
            handleParsedResult(parsed);
        };
        reader.readAsText(file);
    };

    // ─── Shared Logic ───────────────────────────────────────────────────

    const handleParsedResult = (parsed: ImportedQuestion[]) => {
        if (parsed.length === 0) {
            setErrors(['No valid questions found. check your column names match: Question, Choice A, Choice B, Choice C, Choice D, Correct Answer, Explanation, Difficulty']);
            setParsedQuestions([]);
            return;
        }

        const { valid, errors: validationErrors } = validateImportedQuestions(parsed);

        if (validationErrors.length > 0 && valid.length === 0) {
            setErrors(validationErrors);
            setParsedQuestions([]);
        } else {
            setErrors(validationErrors);
            setParsedQuestions(valid);
            setStep('preview');
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h2 className="text-2xl font-bold text-gray-900">Import from Notion</h2>
            </div>

            {step === 'connect' ? (
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
            ) : (
                /* Preview Step (Reused from FileImporter UI logic somewhat) */
                <div className="space-y-6">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-green-900">
                                    Found {parsedQuestions.length} questions
                                </p>
                                {mode === 'api' ? (
                                    <p className="text-sm text-green-700 mt-0.5">from Notion Database</p>
                                ) : (
                                    <p className="text-sm text-green-700 mt-0.5">from CSV Export</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Set Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g., Biology Chapter 5"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Optional description..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                        {parsedQuestions.map((q, idx) => (
                            <div key={idx} className="p-4 border border-gray-200 rounded-xl bg-white hover:shadow-sm transition-shadow">
                                <p className="font-semibold text-gray-900 mb-2.5">
                                    <span className="text-blue-600 mr-1.5">Q{idx + 1}.</span>
                                    {q.question}
                                </p>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    {q.choices.map((choice: string, choiceIdx: number) => (
                                        <div
                                            key={choiceIdx}
                                            className={`text-sm px-3 py-2 rounded-lg ${choiceIdx === q.correct_answer_index
                                                ? 'bg-green-50 text-green-800 border border-green-200 font-medium'
                                                : 'bg-gray-50 text-gray-700 border border-gray-100'
                                                }`}
                                        >
                                            <span className="font-mono font-bold mr-1.5">{String.fromCharCode(65 + choiceIdx)}.</span>
                                            {choice}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                    {q.explanation && (
                                        <span className="truncate max-w-[300px]">💡 {q.explanation}</span>
                                    )}
                                    {q.difficulty && (
                                        <span className={`px-2 py-0.5 rounded-full ${q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                            q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {q.difficulty}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => {
                                if (!title.trim()) {
                                    setErrors(['Please enter a set title']);
                                    return;
                                }
                                onImport(parsedQuestions, title, description);
                            }}
                            className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-sm"
                        >
                            Import {parsedQuestions.length} Questions
                        </button>
                        <button
                            onClick={() => {
                                setStep('connect');
                                setParsedQuestions([]);
                                setErrors([]);
                                setFileInputKey(prev => prev + 1);
                            }}
                            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                        >
                            Back
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
