import React from 'react';
import { useExam } from '../store/ExamContext';
import { 
    Heading1, 
    Type, 
    Columns, 
    Plus, 
    Trash2, 
    ArrowUp, 
    ArrowDown,
    FileText,
    ListTodo,
    SplitSquareVertical,
} from 'lucide-react';
import { BlockType } from '../types';

export const Sidebar: React.FC = () => {
    const { addBlock, selectedBlockId, deleteBlock, moveBlock, mode, setMode } = useExam();

    const blockButtons: { type: BlockType; label: string; icon: any }[] = [
        { type: 'COVER', label: 'Cover Header', icon: Heading1 },
        { type: 'INSTRUCTIONS', label: 'Instructions', icon: FileText },
        { type: 'SECTION_HEADER', label: 'Section Header', icon: Columns },
        { type: 'QUESTION', label: 'Question (L1)', icon: Type },
        { type: 'MCQ_OPTIONS', label: 'MCQ Options', icon: ListTodo },
        { type: 'PAGE_BREAK', label: 'Page Break', icon: SplitSquareVertical },
        { type: 'END_PAPER', label: 'End of Paper', icon: FileText },
    ];

    return (
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
            <div className="p-4 border-b">
                <h2 className="text-lg font-bold bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
                    Exam Formatter
                </h2>
                <div className="flex bg-gray-100 p-1 rounded-lg mt-4">
                    <button 
                        onClick={() => setMode('BUILD')}
                        className={`flex-1 text-xs py-1.5 rounded-md transition-all ${mode === 'BUILD' ? 'bg-white shadow-sm font-bold text-orange-600' : 'text-gray-500'}`}
                    >
                        Build
                    </button>
                    <button 
                        onClick={() => setMode('TEMPLATE')}
                        className={`flex-1 text-xs py-1.5 rounded-md transition-all ${mode === 'TEMPLATE' ? 'bg-white shadow-sm font-bold text-orange-600' : 'text-gray-500'}`}
                    >
                        Template
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <section>
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Add Blocks</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {blockButtons.map((btn) => (
                            <button
                                key={btn.type}
                                onClick={() => addBlock(btn.type)}
                                className="flex items-center gap-3 w-full p-2.5 text-sm text-gray-600 hover:bg-orange-50 hover:text-orange-600 rounded-lg border border-gray-100 hover:border-orange-200 transition-all group"
                            >
                                <div className="p-1.5 bg-gray-50 rounded group-hover:bg-white">
                                    <btn.icon size={16} />
                                </div>
                                {btn.label}
                                <Plus size={14} className="ml-auto opacity-0 group-hover:opacity-100" />
                            </button>
                        ))}
                    </div>
                </section>

                {selectedBlockId && (
                    <section className="animate-in slide-in-from-bottom-2 duration-300">
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Selected Block</h3>
                        <div className="flex bg-gray-50 p-2 rounded-lg gap-1 border border-gray-200 shadow-sm">
                            <button 
                                onClick={() => moveBlock(selectedBlockId, 'UP')}
                                className="flex-1 p-2 hover:bg-white hover:text-orange-600 rounded transition-colors border border-transparent hover:border-gray-200"
                                title="Move Up"
                            >
                                <ArrowUp size={16} className="mx-auto" />
                            </button>
                            <button 
                                onClick={() => moveBlock(selectedBlockId, 'DOWN')}
                                className="flex-1 p-2 hover:bg-white hover:text-orange-600 rounded transition-colors border border-transparent hover:border-gray-200"
                                title="Move Down"
                            >
                                <ArrowDown size={16} className="mx-auto" />
                            </button>
                            <button 
                                onClick={() => deleteBlock(selectedBlockId)}
                                className="flex-1 p-2 hover:bg-red-50 hover:text-red-600 rounded transition-colors border border-transparent hover:border-red-100"
                                title="Delete"
                            >
                                <Trash2 size={16} className="mx-auto" />
                            </button>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};
