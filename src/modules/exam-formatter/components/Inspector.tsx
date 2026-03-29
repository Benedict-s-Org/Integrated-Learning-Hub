import React, { useState } from 'react';
import { useExam } from '../store/ExamContext';
import { 
    RefreshCw, 
    Upload, 
    Loader2, 
    AlertCircle, 
    Sparkles, 
    Plus, 
    Trash2, 
    CheckCircle, 
    Circle,
    ChevronDown,
    ChevronRight,
    X,
} from 'lucide-react';
import { NotionService } from '../services/NotionService';
import { useAuth } from '@/context/AuthContext';
import { call_flowith_api } from '@/utils/flowithApi';

export const Inspector: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const { document, template, selectedBlockId, updateBlock, updateTemplate } = useExam();
    const { session } = useAuth();
    const selectedBlock = document.blocks.find(b => b.id === selectedBlockId);

    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState('');
    const [syncSuccess, setSyncSuccess] = useState('');

    const [aiLoading, setAiLoading] = useState<'simplify' | 'distractor' | null>(null);
    const [aiError, setAiError] = useState('');

    const [isTypographyExpanded, setIsTypographyExpanded] = useState(true);
    const [isPageLayoutExpanded, setIsPageLayoutExpanded] = useState(true);

    const handleContentChange = (field: string, value: any) => {
        if (!selectedBlock) return;
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

    if (!selectedBlock) {
        return (
            <div className="p-4 space-y-6 overflow-y-auto h-full">
                <header className="flex items-center justify-between border-b pb-4">
                    <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Global Settings</h3>
                        <p className="text-[10px] text-gray-400">Apply styles to the whole paper</p>
                    </div>
                    {onClose && (
                        <button 
                            onClick={onClose}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </header>

                <section className="space-y-4 mt-4">
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-100 mb-6">
                        <label className="text-[10px] text-orange-600 font-bold block mb-2 uppercase">Template Preset</label>
                        <select 
                            className="w-full p-2 text-sm border border-orange-200 rounded-md focus:ring-2 focus:ring-orange-200 outline-none bg-white font-medium"
                            onChange={(e) => {
                                if (e.target.value === 'primaryEnglish') {
                                    updateTemplate({ theme: template.presets.primaryEnglish.theme });
                                }
                            }}
                        >
                            <option value="">-- Select a Preset --</option>
                            <option value="primaryEnglish">Primary English (Standard)</option>
                        </select>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={() => setIsTypographyExpanded(!isTypographyExpanded)}
                            className="w-full flex items-center justify-between p-2 rounded hover:bg-gray-100 transition-colors group"
                        >
                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-l-2 border-orange-400 pl-2">Typography</h4>
                            {isTypographyExpanded ? (
                                <ChevronDown size={14} className="text-gray-400 group-hover:text-orange-500 transition-transform" />
                            ) : (
                                <ChevronRight size={14} className="text-gray-400 group-hover:text-orange-500 transition-transform" />
                            )}
                        </button>
                        
                        {isTypographyExpanded && (
                            <div className="space-y-4 animate-in slide-in-from-top-1 duration-200">
                                <div>
                                    <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Font Family</label>
                                    <select 
                                        className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none bg-white"
                                        value={template.theme.fontFamily}
                                        onChange={(e) => updateTemplate({ theme: { ...template.theme, fontFamily: e.target.value } })}
                                    >
                                        <option value="serif">Times New Roman (Serif)</option>
                                        <option value="pmingliu">新細明體 / PMingLiU (Exam Standard)</option>
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
                        )}
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <button 
                            onClick={() => setIsPageLayoutExpanded(!isPageLayoutExpanded)}
                            className="w-full flex items-center justify-between p-2 rounded hover:bg-gray-100 transition-colors group"
                        >
                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-l-2 border-orange-400 pl-2">Page Layout</h4>
                            {isPageLayoutExpanded ? (
                                <ChevronDown size={14} className="text-gray-400 group-hover:text-orange-500 transition-transform" />
                            ) : (
                                <ChevronRight size={14} className="text-gray-400 group-hover:text-orange-500 transition-transform" />
                            )}
                        </button>

                        {isPageLayoutExpanded && (
                            <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-1 duration-200">
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
                        )}
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6 overflow-y-auto h-full">
            <header className="flex items-center justify-between border-b pb-4">
                <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Inspector</h3>
                    <div className="inline-block px-2 py-0.5 rounded bg-orange-100 text-orange-600 text-[10px] font-bold">
                        {selectedBlock.id.slice(0, 8)} • {selectedBlock.type}
                    </div>
                </div>
                {onClose && (
                    <button 
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                )}
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

                {selectedBlock.type === 'STIMULUS_BOX' && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Box Title</label>
                            <input 
                                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none"
                                value={selectedBlock.content.title || ''}
                                placeholder="e.g. A Poster"
                                onChange={(e) => handleContentChange('title', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Image URL (Optional)</label>
                            <input 
                                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none"
                                value={selectedBlock.content.imageUrl || ''}
                                placeholder="https://..."
                                onChange={(e) => handleContentChange('imageUrl', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Text Content</label>
                            <textarea 
                                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none min-h-[100px]"
                                value={selectedBlock.content.text || ''}
                                placeholder="Enter the text for the stimulus material..."
                                onChange={(e) => handleContentChange('text', e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {selectedBlock.type === 'QUESTION' && (
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] text-gray-400 font-bold uppercase">Question Stem</label>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => handleContentChange('bold', !selectedBlock.content.bold)}
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${selectedBlock.content.bold ? 'bg-orange-100 border-orange-300 text-orange-600' : 'bg-gray-50'}`}
                                    >
                                        Bold
                                    </button>
                                    <button 
                                        onClick={handleSimplifyLanguage}
                                        disabled={aiLoading !== null}
                                        className="text-[10px] text-purple-600 font-bold bg-purple-50 hover:bg-purple-100 flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                                    >
                                        {aiLoading === 'simplify' ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                        Simplify
                                    </button>
                                </div>
                            </div>
                            <textarea 
                                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none min-h-[80px]"
                                value={selectedBlock.content.stem || ''}
                                onChange={(e) => handleContentChange('stem', e.target.value)}
                            />
                        </div>

                        <div className="pt-2 border-t">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] text-gray-400 font-bold uppercase">Question Format</label>
                                <select 
                                    className="text-[10px] p-1 border rounded bg-white font-bold"
                                    value={selectedBlock.content.questionType || 'MCQ'}
                                    onChange={(e) => handleContentChange('questionType', e.target.value)}
                                >
                                    <option value="MCQ">Multiple Choice</option>
                                    <option value="FILL_BLANK">Fill in the Blank</option>
                                    <option value="SHORT_ANSWER">Short Answer (Lines)</option>
                                </select>
                            </div>
                        </div>

                        {(!selectedBlock.content.questionType || selectedBlock.content.questionType === 'MCQ') && (
                        <div className="pt-2 border-t">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] text-gray-400 font-bold uppercase">Options Style</label>
                                <select 
                                    className="text-[10px] p-1 border rounded bg-white font-bold"
                                    value={selectedBlock.content.mcqStyle || 'ALPHA'}
                                    onChange={(e) => handleContentChange('mcqStyle', e.target.value)}
                                >
                                    <option value="ALPHA">A. B. C. D.</option>
                                    <option value="CIRCLE">Ⓐ Ⓑ Ⓒ Ⓓ (Word Standard)</option>
                                    <option value="PAREN">(A) (B) (C) (D)</option>
                                    <option value="NONE">No Prefix</option>
                                </select>
                            </div>

                            <div className="flex justify-between items-center mb-3">
                                <label className="text-[10px] text-gray-400 font-bold uppercase">Layout (Columns)</label>
                                <div className="flex bg-gray-100 p-0.5 rounded-lg">
                                    {[1, 2, 4].map(cols => (
                                        <button
                                            key={cols}
                                            onClick={() => handleContentChange('mcqColumns', cols)}
                                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${selectedBlock.content.mcqColumns === cols || (!selectedBlock.content.mcqColumns && cols === 1) ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            {cols}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                {(selectedBlock.content.options || []).map((opt: string, i: number) => (
                                    <div key={i} className="flex gap-2 group/opt">
                                        <button 
                                            onClick={() => handleContentChange('answerIndex', selectedBlock.content.answerIndex === i ? null : i)}
                                            className={`mt-1.5 transition-colors ${selectedBlock.content.answerIndex === i ? 'text-green-500' : 'text-gray-300 hover:text-gray-400'}`}
                                            title="Mark as Correct Answer"
                                        >
                                            {selectedBlock.content.answerIndex === i ? <CheckCircle size={14} /> : <Circle size={14} />}
                                        </button>
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
                                                if (selectedBlock.content.answerIndex === i) handleContentChange('answerIndex', null);
                                                else if (selectedBlock.content.answerIndex > i) handleContentChange('answerIndex', selectedBlock.content.answerIndex - 1);
                                            }}
                                            className="text-red-300 hover:text-red-500 p-1.5 opacity-0 group-hover/opt:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleContentChange('options', [...(selectedBlock.content.options || []), ''])}
                                        className="flex-1 flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-gray-700 justify-center p-1.5 border border-dashed rounded bg-gray-50 hover:bg-white transition-colors"
                                    >
                                        <Plus size={12} /> Add Option
                                    </button>
                                    <button 
                                        onClick={handleGenerateDistractor}
                                        disabled={aiLoading !== null}
                                        className="px-3 flex items-center justify-center text-purple-600 bg-purple-50 hover:bg-purple-100 rounded border border-purple-100 transition-colors disabled:opacity-50"
                                        title="Generate Distractor with AI"
                                    >
                                        {aiLoading === 'distractor' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        )}

                        {aiError && (
                            <div className="flex items-center gap-1.5 p-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-medium border border-red-100">
                                <AlertCircle size={10} />
                                {aiError}
                            </div>
                        )}

                        <div className="pt-3 border-t grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Marks</label>
                                <input 
                                    type="number"
                                    className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none"
                                    value={selectedBlock.content.marks || 0}
                                    onChange={(e) => handleContentChange('marks', Number(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Marks Pos</label>
                                <select 
                                    className="w-full p-2 text-sm border rounded-lg bg-white"
                                    value={selectedBlock.content.markPosition || 'INLINE'}
                                    onChange={(e) => handleContentChange('markPosition', e.target.value)}
                                >
                                    <option value="INLINE">Inline</option>
                                    <option value="RIGHT">Right-Aligned</option>
                                </select>
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

                {selectedBlock.type === 'READING_PASSAGE' && (
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Passage Title</label>
                            <input 
                                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none"
                                value={selectedBlock.content.title || ''}
                                onChange={(e) => handleContentChange('title', e.target.value)}
                                placeholder="Optional title..."
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Passage Text</label>
                            <textarea 
                                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none min-h-[150px]"
                                value={selectedBlock.content.text || ''}
                                onChange={(e) => handleContentChange('text', e.target.value)}
                                placeholder="Paste story or reading passage here..."
                            />
                        </div>
                    </div>
                )}

                {selectedBlock.type === 'GRID_LAYOUT' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Rows</label>
                                <input 
                                    type="number" min="1" max="10"
                                    className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none"
                                    value={selectedBlock.content.rows || 1}
                                    onChange={(e) => handleContentChange('rows', Number(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Columns</label>
                                <input 
                                    type="number" min="1" max="4"
                                    className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-200 outline-none"
                                    value={selectedBlock.content.columns || 2}
                                    onChange={(e) => handleContentChange('columns', Number(e.target.value))}
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 italic">
                            (Grid content editing will be supported on the canvas in a future update. For now, layout shells are created.)
                        </p>
                    </div>
                )}

                {!['COVER', 'QUESTION', 'SECTION_HEADER', 'READING_PASSAGE', 'GRID_LAYOUT'].includes(selectedBlock.type) && (
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
