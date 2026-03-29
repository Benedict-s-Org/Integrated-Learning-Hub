import React, { useState } from 'react';
import { useExam } from '../store/ExamContext';
import { 
    ChevronDown, 
    ChevronUp, 
    Download, 
    Database, 
    Plus, 
    Columns, 
    Type, 
    SplitSquareVertical,
    PanelRight,
    Search,
    Type as FontIcon,
    CircleDot
} from 'lucide-react';
import { DocxService } from '../services/DocxService';
import { BlockType } from '../types';

interface ToolbarProps {
    showReference: boolean;
    setShowReference: (show: boolean) => void;
    onOpenNotion: () => void;
    showInspector: boolean;
    setShowInspector: (show: boolean) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
    showReference, 
    setShowReference, 
    onOpenNotion,
    showInspector,
    setShowInspector
}) => {
    const { document, template, addBlock, selectedBlockId, updateBlock, updateTemplate } = useExam();
    const [isExpanded, setIsExpanded] = useState(true);

    const selectedBlock = document.blocks.find(b => b.id === selectedBlockId);

    const handleExport = async () => {
        try {
            await DocxService.generate(document, template);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please check the console for details.');
        }
    };

    const handleContentChange = (field: string, value: any) => {
        if (!selectedBlock) return;
        updateBlock(selectedBlock.id, {
            content: { ...selectedBlock.content, [field]: value }
        });
    };

    const quickAddButtons: { type: BlockType; label: string; icon: any }[] = [
        { type: 'QUESTION', label: 'Question', icon: Type },
        { type: 'SECTION_HEADER', label: 'Section', icon: Columns },
        { type: 'PAGE_BREAK', label: 'Page Break', icon: SplitSquareVertical },
    ];

    return (
        <div className="w-full bg-white border-b border-gray-200 shadow-sm z-20 transition-all duration-300">
            {/* Header / Toggle Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="bg-orange-100 p-1.5 rounded-lg">
                            <Plus size={16} className="text-orange-600" />
                        </div>
                        <span className="text-sm font-bold text-gray-700">Quick Actions</span>
                    </div>

                    {/* Quick Access Settings (Visible even when collapsed) */}
                    {!isExpanded && (
                        <div className="flex items-center gap-4 animate-in fade-in duration-500">
                            <div className="h-4 w-px bg-gray-200 mx-1" />
                            <div className="flex items-center gap-2">
                                <FontIcon size={14} className="text-gray-400" />
                                <select 
                                    className="text-[10px] font-bold border-none bg-transparent outline-none text-gray-600 hover:text-orange-600 transition-colors"
                                    value={template.theme.fontFamily}
                                    onChange={(e) => updateTemplate({ theme: { ...template.theme, fontFamily: e.target.value } })}
                                >
                                    <option value="serif">Serif</option>
                                    <option value="pmingliu">PMingLiU</option>
                                    <option value="sans-serif">Sans</option>
                                </select>
                            </div>
                            
                            {selectedBlock?.type === 'QUESTION' && (
                                <div className="flex items-center gap-2">
                                    <CircleDot size={14} className="text-gray-400" />
                                    <select 
                                        className="text-[10px] font-bold border-none bg-transparent outline-none text-gray-600 hover:text-orange-600 transition-colors"
                                        value={selectedBlock.content.mcqStyle || 'ALPHA'}
                                        onChange={(e) => handleContentChange('mcqStyle', e.target.value)}
                                    >
                                        <option value="ALPHA">A. B. C.</option>
                                        <option value="CIRCLE">Ⓐ Ⓑ Ⓒ</option>
                                        <option value="PAREN">(A) (B)</option>
                                        <option value="NONE">None</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
            </div>

            {/* Collapsible Content */}
            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-32 opacity-100 py-3' : 'max-h-0 opacity-0'}`}>
                <div className="px-4 flex items-center justify-between gap-6">
                    {/* Quick Add Section */}
                    <div className="flex items-center gap-2 border-r pr-6 border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-2">Add</span>
                        {quickAddButtons.map((btn) => (
                            <button
                                key={btn.type}
                                onClick={() => addBlock(btn.type)}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-orange-50 hover:text-orange-600 rounded-lg border border-gray-100 hover:border-orange-200 transition-all"
                            >
                                <btn.icon size={14} />
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {/* Styling Section */}
                    <div className="flex items-center gap-4 border-r pr-6 border-gray-100">
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Font Family</label>
                            <select 
                                className="text-xs p-1 border rounded bg-white font-bold text-gray-700 outline-none focus:ring-1 focus:ring-orange-200"
                                value={template.theme.fontFamily}
                                onChange={(e) => updateTemplate({ theme: { ...template.theme, fontFamily: e.target.value } })}
                            >
                                <option value="serif">Times New Roman</option>
                                <option value="pmingliu">新細明體 / PMingLiU</option>
                                <option value="sans-serif">Arial / Inter</option>
                                <option value="monospace">Courier New</option>
                            </select>
                        </div>
                        
                        {selectedBlock?.type === 'QUESTION' && (
                            <div className="flex flex-col gap-1 animate-in slide-in-from-left duration-200">
                                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">MCQ Symbol</label>
                                <select 
                                    className="text-xs p-1 border rounded bg-white font-bold text-gray-700 outline-none focus:ring-1 focus:ring-orange-200"
                                    value={selectedBlock.content.mcqStyle || 'ALPHA'}
                                    onChange={(e) => handleContentChange('mcqStyle', e.target.value)}
                                >
                                    <option value="ALPHA">Standard (A. B. C.)</option>
                                    <option value="CIRCLE">Circles (Ⓐ Ⓑ Ⓒ)</option>
                                    <option value="PAREN">Parentheses ((A))</option>
                                    <option value="NONE">None</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Tools Section */}
                    <div className="flex items-center gap-2 border-r pr-6 border-gray-100">
                        <button
                            onClick={() => setShowReference(!showReference)}
                            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                showReference 
                                ? 'bg-orange-50 text-orange-600 border-orange-200' 
                                : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600 border-gray-100'
                            }`}
                        >
                            <Search size={14} />
                            Reference
                        </button>
                        <button
                            onClick={onOpenNotion}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg border border-gray-100 hover:border-blue-200 transition-all"
                        >
                            <Database size={14} />
                            Notion
                        </button>
                    </div>

                    {/* Interface Controls */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowInspector(!showInspector)}
                            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                showInspector 
                                ? 'bg-orange-100 text-orange-600 border-orange-300' 
                                : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600 border-gray-100'
                            }`}
                        >
                            <PanelRight size={14} />
                            Inspector
                        </button>
                        
                        <button 
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-orange-400 to-pink-400 text-white rounded-lg text-xs font-bold shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                        >
                            <Download size={14} />
                            Export
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
