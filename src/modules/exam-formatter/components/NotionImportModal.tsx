import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useExam } from '../store/ExamContext';
import { NotionService } from '../services/NotionService';
import { Loader2, Database, Download, AlertCircle, X, Search } from 'lucide-react';
import { Block } from '../types';

interface NotionModalProps {
    onClose: () => void;
}

export const NotionImportModal: React.FC<NotionModalProps> = ({ onClose }) => {
    const { session } = useAuth();
    const { appendBlocks } = useExam();
    
    const [databaseId, setDatabaseId] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [fetchedBlocks, setFetchedBlocks] = useState<Block[]>([]);

    const handleFetch = async () => {
        if (!databaseId) return;
        setStatus('loading');
        try {
            const blocks = await NotionService.fetchDatabase(databaseId, session);
            setFetchedBlocks(blocks.filter(b => b.content.stem)); // Filter out empty ones
            setStatus('success');
        } catch (err: any) {
            console.error('Notion fetch error:', err);
            setErrorMsg(err.message || 'Failed to fetch database');
            setStatus('error');
        }
    };

    const handleImportAll = () => {
        if (fetchedBlocks.length > 0) {
            appendBlocks(fetchedBlocks);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Database className="text-blue-500" />
                            Notion Integration
                        </h2>
                        <p className="text-sm text-gray-500">Fetch questions from your Notion database</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {status === 'idle' || status === 'loading' || status === 'error' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Notion Database ID</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={databaseId}
                                        onChange={(e) => setDatabaseId(e.target.value)}
                                        placeholder="e.g. 3239baca6fa380a9b501deceb133946d"
                                        className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-blue-200 outline-none"
                                        disabled={status === 'loading'}
                                    />
                                    <button 
                                        onClick={handleFetch}
                                        disabled={status === 'loading' || !databaseId}
                                        className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {status === 'loading' ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                                        Fetch
                                    </button>
                                </div>
                            </div>
                            
                            {status === 'error' && (
                                <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-start gap-3">
                                    <AlertCircle size={20} className="mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-bold">Fetch Failed</p>
                                        <p className="text-sm opacity-90">{errorMsg}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-green-800">Successfully fetched!</p>
                                    <p className="text-sm text-green-600">Found {fetchedBlocks.length} valid questions.</p>
                                </div>
                                <button 
                                    onClick={handleImportAll}
                                    className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 flex items-center gap-2"
                                >
                                    <Download size={16} />
                                    Import All to Canvas
                                </button>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Preview</h4>
                                {fetchedBlocks.slice(0, 5).map((b) => (
                                    <div key={b.id} className="p-3 border rounded-lg bg-gray-50 text-sm">
                                        <div className="font-medium text-gray-800 truncate">{b.content.stem}</div>
                                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                            {b.content.marks && <span>Marks: {b.content.marks}</span>}
                                            {b.content.options && <span>Options: {b.content.options.length}</span>}
                                        </div>
                                    </div>
                                ))}
                                {fetchedBlocks.length > 5 && (
                                    <div className="text-center text-sm text-gray-500 italic">
                                        ... and {fetchedBlocks.length - 5} more
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
