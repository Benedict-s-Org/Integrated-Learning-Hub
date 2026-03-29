import React from 'react';
import { Block } from '../types';
import { useExam } from '../store/ExamContext';
import { EditableText } from './EditableText';

interface BlockRendererProps {
    block: Block;
    index: number;
}

const getMCQSymbol = (index: number, style: string, isAnswer: boolean) => {
    switch (style) {
        case 'CIRCLE':
            // We use fromCodePoint for the filled symbols as they are outside the BMP
            try {
                if (isAnswer) return String.fromCodePoint(0x1F150 + index);
                return String.fromCharCode(0x24B6 + index);
            } catch (e) {
                return `${String.fromCharCode(65 + index)}.`;
            }
        case 'PAREN':
            return `(${String.fromCharCode(65 + index)})`;
        case 'NONE':
            return '';
        case 'ALPHA':
        default:
            return `${String.fromCharCode(65 + index)}.`;
    }
};

export const BlockRenderer: React.FC<BlockRendererProps> = ({ block, index }) => {
    const { updateBlock, setSelectedBlockId } = useExam();

    const handleContentChange = (field: string, value: any) => {
        updateBlock(block.id, {
            content: { ...block.content, [field]: value }
        });
    };
    switch (block.type) {
        case 'COVER':
            return (
                <div className="text-center py-8 border-b-2 border-black mb-8">
                    <EditableText 
                        value={block.content.title}
                        placeholder="EXAMINATION PAPER"
                        className="text-3xl font-bold uppercase tracking-widest mb-2 text-center"
                        onChange={(val) => handleContentChange('title', val)}
                        onFocus={() => setSelectedBlockId(block.id)}
                    />
                    <EditableText 
                        value={block.content.subtitle}
                        placeholder="Subject Name"
                        className="text-xl font-semibold text-center"
                        onChange={(val) => handleContentChange('subtitle', val)}
                        onFocus={() => setSelectedBlockId(block.id)}
                    />
                    <div className="mt-8 grid grid-cols-2 gap-4 text-left max-w-md mx-auto italic">
                        <div>Name: ______________________</div>
                        <div>Class: ______________________</div>
                        <div>Date: ______________________</div>
                        <div>Duration: ___________________</div>
                    </div>
                </div>
            );

        case 'SECTION_HEADER':
            return (
                <div className="my-6">
                    <EditableText 
                        value={block.content.title}
                        placeholder="SECTION A"
                        className="text-lg font-bold uppercase tracking-wider"
                        onChange={(val) => handleContentChange('title', val)}
                        onFocus={() => setSelectedBlockId(block.id)}
                    />
                    <EditableText 
                        value={block.content.description}
                        placeholder="Enter section instructions..."
                        className="text-base font-bold mt-2"
                        multiline
                        onChange={(val) => handleContentChange('description', val)}
                        onFocus={() => setSelectedBlockId(block.id)}
                    />
                </div>
            );

        case 'READING_PASSAGE':
            return (
                <div className="my-6">
                    <EditableText 
                        value={block.content.title}
                        placeholder="Passage Title (Optional)"
                        className="text-center font-bold text-lg mb-4"
                        onChange={(val) => handleContentChange('title', val)}
                        onFocus={() => setSelectedBlockId(block.id)}
                    />
                    <EditableText 
                        value={block.content.text}
                        placeholder="Enter passage text here..."
                        className="whitespace-pre-wrap leading-relaxed"
                        multiline
                        onChange={(val) => handleContentChange('text', val)}
                        onFocus={() => setSelectedBlockId(block.id)}
                    />
                </div>
            );

        case 'GRID_LAYOUT':
            const { rows = 1, columns = 2, gridData = [] } = block.content;
            return (
                <div className="my-4 border border-dashed border-gray-300 p-2 relative group min-h-[100px]">
                    <div className="absolute -top-3 left-2 bg-white px-2 text-[10px] uppercase font-bold text-gray-400">
                        Grid Layout ({columns} Columns)
                    </div>
                    <div 
                        className="grid gap-4" 
                        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                    >
                        {Array.from({ length: rows * columns }).map((_, i) => (
                            <div key={i} className="min-h-[50px] border border-gray-100 p-2 flex flex-col gap-2">
                                {gridData[i]?.imageUrl && (
                                    <img src={gridData[i].imageUrl} alt="" className="w-full object-contain max-h-32" />
                                )}
                                <div className="editable-cell flex-1">
                                    <EditableText 
                                        value={gridData[i]?.text}
                                        placeholder="[Cell Text]"
                                        className="whitespace-pre-wrap min-h-full"
                                        multiline
                                        onChange={(val) => {
                                            const newData = [...gridData];
                                            if (!newData[i]) newData[i] = {};
                                            newData[i].text = val;
                                            handleContentChange('gridData', newData);
                                        }}
                                        onFocus={() => setSelectedBlockId(block.id)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );

        case 'STIMULUS_BOX':
            return (
                <div className="my-6 border border-black p-4 max-w-2xl mx-auto flex flex-col items-center">
                    {block.content.title && (
                        <EditableText 
                            value={block.content.title}
                            placeholder="Box Title (e.g. A Poster)"
                            className="font-bold text-center mb-2"
                            onChange={(val) => handleContentChange('title', val)}
                            onFocus={() => setSelectedBlockId(block.id)}
                        />
                    )}
                    {block.content.imageUrl && (
                        <div className="my-2 border border-dashed border-gray-300 p-2 min-h-[100px] w-full flex items-center justify-center relative group">
                            <span className="absolute -top-3 left-2 bg-white px-1 text-[10px] text-gray-400">Image</span>
                            <img src={block.content.imageUrl} alt="" className="max-w-full max-h-64 object-contain" />
                        </div>
                    )}
                    <EditableText 
                        value={block.content.text}
                        placeholder="Enter stimulus text here..."
                        className="whitespace-pre-wrap leading-relaxed text-center w-full"
                        multiline
                        onChange={(val) => handleContentChange('text', val)}
                        onFocus={() => setSelectedBlockId(block.id)}
                    />
                </div>
            );

        case 'QUESTION':
            const { 
                stem, 
                options, 
                marks, 
                bold, 
                mcqStyle = 'ALPHA', 
                mcqColumns = 1, 
                hangingIndent = true,
                answerIndex = null,
                markPosition = 'INLINE',
                questionType = 'MCQ'
            } = block.content;

            const gridCols = {
                1: 'grid-cols-1',
                2: 'grid-cols-2',
                4: 'grid-cols-4'
            }[mcqColumns as 1 | 2 | 4] || 'grid-cols-1';

            return (
                <div className="flex gap-2 items-start py-2 group">
                    <div className="font-bold min-w-[2.5rem] text-right">{index + 1}.</div>
                    <div className="flex-1 w-full">
                        <div className={`relative ${bold ? 'font-bold' : ''} ${hangingIndent ? 'pl-0' : ''}`}>
                            <EditableText 
                                value={stem}
                                placeholder="Enter question text here..."
                                className="whitespace-pre-wrap"
                                multiline
                                onChange={(val) => handleContentChange('stem', val)}
                                onFocus={() => setSelectedBlockId(block.id)}
                            />
                            
                            {/* Render blanks if it's a fill-in-the-blank question and no options */}
                            {questionType === 'FILL_BLANK' && (!options || options.length === 0) && (
                                <span className="inline-block border-b border-black w-32 ml-2 leading-none" style={{ height: '1.2em' }}> </span>
                            )}

                            {marks && markPosition === 'INLINE' && (
                                <span className="font-bold underline ml-2 italic whitespace-nowrap">
                                    [{marks}]
                                </span>
                            )}
                        </div>
                        
                        {/* Render Short Answer Lines */}
                        {questionType === 'SHORT_ANSWER' && (
                            <div className="mt-4 mb-2 space-y-6">
                                <div className="border-b border-dotted border-black w-full h-1"></div>
                                <div className="border-b border-dotted border-black w-full h-1"></div>
                            </div>
                        )}
                        
                        {options && options.length > 0 && questionType === 'MCQ' && (
                            <div className={`mt-3 grid ${gridCols} gap-x-8 gap-y-2`}>
                                {options.map((opt: string, i: number) => (
                                    <div key={i} className="flex gap-2 items-start">
                                        <span className="font-bold min-w-[2rem] text-right">
                                            {getMCQSymbol(i, mcqStyle, answerIndex === i)}
                                        </span>
                                        <EditableText 
                                            value={opt}
                                            className="flex-1"
                                            onChange={(newOpt) => {
                                                const newOptions = [...options];
                                                newOptions[i] = newOpt;
                                                handleContentChange('options', newOptions);
                                            }}
                                            onFocus={() => setSelectedBlockId(block.id)}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {marks && markPosition === 'RIGHT' && (
                        <div className="font-bold underline ml-4 italic whitespace-nowrap self-start">
                            [{marks}]
                        </div>
                    )}
                </div>
            );

        case 'INSTRUCTIONS':
            return (
                <div className="border border-black p-4 my-4 rounded-sm text-sm italic">
                    <h4 className="font-bold uppercase not-italic mb-2">Instructions to Candidates:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                        {(block.content.items || ['Answer all questions.', 'Write your answers clearly in the spaces provided.']).map((item: string, i: number) => (
                            <li key={i}>
                                <EditableText 
                                    value={item}
                                    onChange={(newVal) => {
                                        const newItems = [...(block.content.items || ['Answer all questions.', 'Write your answers clearly in the spaces provided.'])];
                                        newItems[i] = newVal;
                                        handleContentChange('items', newItems);
                                    }}
                                    onFocus={() => setSelectedBlockId(block.id)}
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            );

        case 'PAGE_BREAK':
            return (
                <div className="my-8 border-t-2 border-dashed border-gray-300 relative">
                    <span className="absolute left-1/2 -top-3 -translate-x-1/2 bg-gray-100 px-2 text-[10px] text-gray-400 font-mono uppercase tracking-widest">
                        Page Break
                    </span>
                </div>
            );

        default:
            return (
                <div className="p-4 bg-red-50 text-red-500 border border-red-200 rounded">
                    Unknown Block Type: {block.type}
                </div>
            );
    }
};
