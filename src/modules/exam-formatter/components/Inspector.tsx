import React, { useState } from 'react';
import { useExam } from '../store/ExamContext';
import { RefreshCw, Upload, Loader2, AlertCircle, Sparkles, Plus, Trash2 } from 'lucide-react';
import { NotionService } from '../services/NotionService';
import { useAuth } from '@/context/AuthContext';
import { call_flowith_api } from '@/utils/flowithApi';

export const Inspector: React.FC = () => {
    const { document, template, selectedBlockId, updateBlock, updateTemplate } = useExam();
    const { session } = useAuth();
    const selectedBlock = document.blocks.find(b => b.id === selectedBlockId);

    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState('');
    const [syncSuccess, setSyncSuccess] = useState('');

    const [aiLoading, setAiLoading] = useState<'simplify' | 'distractor' | null>(null);
    const [aiError, setAiError] = useState('');

    if (!selectedBlock) {
        return (
            <div className="p-4 space-y-6 overflow-y-auto h-full">
                <header className="border-b pb-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Global Settings</h3>
                    <p className="text-[10px] text-gray-400">Apply styles to the whole paper</p>
                </header>

                <section className="space-y-6 mt-4">
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-l-2 border-orange-400 pl-2">Typography</h4>
                        <div>
                            <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Font Family</label>
                            <select 
                                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none bg-white"
                                value={template.theme.fontFamily}
                                onChange={(e) => updateTemplate({ theme: { ...template.theme, fontFamily: e.target.value } })}
                            >
                                <option value="serif">Times New Roman (Serif)</option>
                                <option value="sans-serif">Arial / Inter (Sans)</option>
                                <option value="monospace">Courier New (Mono)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Base Font Size ({template.theme.fontSize}px)</label>
                            <input 
                                type="range" min="10" max="24" step="1"
                                className="w-full accent-orange-500"
                                value={template.theme.fontSize}
                                onChange={(e) => updateTemplate({ theme: { ...template.theme, fontSize: Number(e.target.value) } })}
                            />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-l-2 border-orange-400 pl-2">Page Layout</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Top (cm)</label>
                                <input 
                                    type="number" step="0.5"
                                    className="w-full p-2 text-sm border rounded-lg"
                                    value={template.theme.margins.top}
                                    onChange={(e) => updateTemplate({ theme: { ...template.theme, margins: { ...template.theme.margins, top: Number(e.target.value) } } })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Bottom (cm)</label>
                                <input 
                                    type="number" step="0.5"
                                    className="w-full p-2 text-sm border rounded-lg"
                                    value={template.theme.margins.bottom}
                                    onChange={(e) => updateTemplate({ theme: { ...template.theme, margins: { ...template.theme.margins, bottom: Number(e.target.value) } } })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Left (cm)</label>
                                <input 
                                    type="number" step="0.5"
                                    className="w-full p-2 text-sm border rounded-lg"
                                    value={template.theme.margins.left}
                                    onChange={(e) => updateTemplate({ theme: { ...template.theme, margins: { ...template.theme.margins, left: Number(e.target.value) } } })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Right (cm)</label>
                                <input 
                                    type="number" step="0.5"
                                    className="w-full p-2 text-sm border rounded-lg"
                                    value={template.theme.margins.right}
                                    onChange={(e) => updateTemplate({ theme: { ...template.theme, margins: { ...template.theme.margins, right: Number(e.target.value) } } })}
                                />
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    const handleContentChange = (field: string, value: any) => {
        updateBlock(selectedBlock.id, {
            content: { ...selectedBlock.content, [field]: value }
        });
    };

    const handlePushToNotion = async () => {
        if (!selectedBlock?.sourceRef?.notionId) return;
        setSyncing(true);
        setSyncError('');
        setSyncSuccess('');
        try {
            const updates: any = {};
            if (selectedBlock.content.stem) {
                updates['Question'] = { rich_text: [{ text: { content: selectedBlock.content.stem } }] };
            }
            if (selectedBlock.content.marks !== undefined) {
                updates['Marks'] = { number: selectedBlock.content.marks };
            }

            await NotionService.updatePageFields(selectedBlock.sourceRef.notionId, updates, session);
            setSyncSuccess('Synced to Notion!');
            setTimeout(() => setSyncSuccess(''), 3000);
        } catch (err: any) {
            console.error('Sync error:', err);
            setSyncError(err.message || 'Failed to sync');
        } finally {
            setSyncing(false);
        }
    };

    const handleSimplifyLanguage = async () => {
        if (!selectedBlock?.content?.stem) return;
        setAiLoading('simplify');
        setAiError('');
        try {
            const prompt = `Rewrite the following question stem to use simpler vocabulary and shorter sentences, suitable for an ESL student. Keep the original meaning intact. Output ONLY the rewritten text, nothing else.\n\nOriginal: ${selectedBlock.content.stem}`;
            const res = await call_flowith_api(prompt, 'gpt-4o-mini');
            handleContentChange('stem', res.content.trim());
        } catch (err: any) {
            setAiError(err.message || 'Failed to simplify language.');
        } finally {
            setAiLoading(null);
        }
    };

    const handleGenerateDistractor = async () => {
        if (!selectedBlock?.content?.stem) return;
        setAiLoading('distractor');
        setAiError('');
        try {
            const currentOptions = selectedBlock.content.options || [];
            const prompt = `Given the question: "${selectedBlock.content.stem}"\nAnd the current options: ${JSON.stringify(currentOptions)}\n\nGenerate ONE plausible but incorrect multiple-choice distractor option. Output ONLY the text for the new option, nothing else.`;
            const res = await call_flowith_api(prompt, 'gpt-4o-mini');
            const newOption = res.content.trim().replace(/^["']|["']$/g, '');
            handleContentChange('options', [...currentOptions, newOption]);
        } catch (err: any) {
            setAiError(err.message || 'Failed to generate distractor.');
        } finally {
            setAiLoading(null);
        }
    };

    return (
        <div className="p-4 space-y-6 overflow-y-auto">
            <header className="border-b pb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Inspector</h3>
                <div className="inline-block px-2 py-0.5 rounded bg-orange-100 text-orange-600 text-[10px] font-bold">
                    {selectedBlock.type}
                </div>
            </header>

            <section className="space-y-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Content</h4>
                
                {selectedBlock.type === 'COVER' && (
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Title</label>
                            <input 
                                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none"
                                value={selectedBlock.content.title || ''}
                                onChange={(e) => handleContentChange('title', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Subtitle</label>
                            <input 
                                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none"
                                value={selectedBlock.content.subtitle || ''}
                                onChange={(e) => handleContentChange('subtitle', e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {selectedBlock.type === 'QUESTION' && (
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] text-gray-400 font-bold uppercase">Question Stem</label>
                                <button 
                                    onClick={handleSimplifyLanguage}
                                    disabled={aiLoading !== null}
                                    className="text-[10px] text-purple-600 font-bold bg-purple-50 hover:bg-purple-100 flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                                    title="Simplify Language with AI"
                                >
                                    {aiLoading === 'simplify' ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                    Simplify
                                </button>
                            </div>
                            <textarea 
                                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none min-h-[100px]"
                                value={selectedBlock.content.stem || ''}
                                onChange={(e) => handleContentChange('stem', e.target.value)}
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] text-gray-400 font-bold uppercase">Options</label>
                                <button 
                                    onClick={handleGenerateDistractor}
                                    disabled={aiLoading !== null}
                                    className="text-[10px] text-purple-600 font-bold bg-purple-50 hover:bg-purple-100 flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                                    title="Generate Distractor Option with AI"
                                >
                                    {aiLoading === 'distractor' ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                    Auto-Distractor
                                </button>
                            </div>
                            <div className="space-y-2">
                                {(selectedBlock.content.options || []).map((opt: string, i: number) => (
                                    <div key={i} className="flex gap-2">
                                        <span className="text-xs font-bold text-gray-400 mt-2">{String.fromCharCode(65 + i)}.</span>
                                        <input 
                                            className="w-full p-1.5 text-sm border rounded focus:ring-1 focus:ring-orange-200 outline-none"
                                            value={opt}
                                            onChange={(e) => {
                                                const newOptions = [...selectedBlock.content.options];
                                                newOptions[i] = e.target.value;
                                                handleContentChange('options', newOptions);
                                            }}
                                        />
                                        <button 
                                            onClick={() => {
                                                const newOptions = selectedBlock.content.options.filter((_: any, idx: number) => idx !== i);
                                                handleContentChange('options', newOptions);
                                            }}
                                            className="text-red-400 hover:text-red-600 p-1.5"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => handleContentChange('options', [...(selectedBlock.content.options || []), ''])}
                                    className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-gray-700 w-full justify-center p-1.5 border border-dashed rounded"
                                >
                                    <Plus size={12} /> Add Option
                                </button>
                            </div>
                        </div>

                        {aiError && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={10} /> {aiError}</p>}

                        <div className="flex gap-4 pt-2">
                            <div className="flex-1">
                                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Marks</label>
                                <input 
                                    type="number"
                                    className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none"
                                    value={selectedBlock.content.marks || 0}
                                    onChange={(e) => handleContentChange('marks', Number(e.target.value))}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Bold Stem</label>
                                <button
                                    onClick={() => handleContentChange('bold', !selectedBlock.content.bold)}
                                    className={`w-full p-2 text-sm border rounded-lg transition-colors ${selectedBlock.content.bold ? 'bg-orange-100 border-orange-300 text-orange-600 font-bold' : 'bg-white'}`}
                                >
                                    B
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {selectedBlock.type === 'SECTION_HEADER' && (
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Section Title</label>
                            <input 
                                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none"
                                value={selectedBlock.content.title || ''}
                                onChange={(e) => handleContentChange('title', e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {!['COVER', 'QUESTION', 'SECTION_HEADER'].includes(selectedBlock.type) && (
                    <p className="text-xs text-gray-400 italic">Editing for {selectedBlock.type} coming soon.</p>
                )}
            </section>

            {selectedBlock.sourceRef && (
                <div className="mt-8 pt-6 border-t border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <RefreshCw size={12} />
                            Notion Sync
                        </h4>
                        <span className="text-[10px] text-gray-400 font-mono">
                            {selectedBlock.sourceRef.notionId.split('-')[0]}...
                        </span>
                    </div>
                    
                    <button
                        onClick={handlePushToNotion}
                        disabled={syncing}
                        className="w-full py-2.5 px-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {syncing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        Push changes to Notion
                    </button>

                    {syncError && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle size={12} /> {syncError}
                        </p>
                    )}
                    {syncSuccess && (
                        <p className="text-xs text-green-500 font-medium text-center">
                            {syncSuccess}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};
