import React from 'react';
import { useExam } from '../store/ExamContext';
import { BlockRenderer } from './BlockRenderer.tsx';

export const Canvas: React.FC = () => {
    const { document, template, selectedBlockId, setSelectedBlockId } = useExam();
    const { theme } = template;

    const pageStyle: React.CSSProperties = {
        width: theme.pageSize === 'A4' ? '210mm' : '8.5in',
        minHeight: theme.pageSize === 'A4' ? '297mm' : '11in',
        padding: `${theme.margins?.top || 2.5}cm ${theme.margins?.right || 2.5}cm ${theme.margins?.bottom || 2.5}cm ${theme.margins?.left || 2.5}cm`,
        backgroundColor: 'white',
        boxShadow: '0 0 20px rgba(0,0,0,0.1)',
        margin: '2rem auto',
        position: 'relative',
        fontFamily: theme.fontFamily === 'serif' ? '"Times New Roman", Times, serif' : 
                    theme.fontFamily === 'pmingliu' ? '"PMingLiU", "新細明體", "Apple LiSung", "Songti TC", serif' :
                    theme.fontFamily === 'monospace' ? 'monospace' : 'Inter, sans-serif',
        fontSize: `${theme.fontSize}px`,
        lineHeight: theme.typography?.lineHeight || 1.5,
        color: '#1a1a1a',
        boxSizing: 'border-box'
    };

    return (
        <div className="bg-gray-200 min-h-full w-full py-12 flex justify-center overflow-auto">
            <div 
                style={pageStyle}
                className="transition-all duration-300"
            >
                {document.blocks.map((block, index) => (
                    <div 
                        key={block.id}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBlockId(block.id);
                        }}
                        className={`relative group transition-all duration-200 cursor-text rounded-sm p-2 -m-2
                            ${selectedBlockId === block.id ? 'bg-blue-50/30 ring-1 ring-blue-100 z-10 shadow-[0_0_10px_rgba(59,130,246,0.05)]' : 'hover:bg-gray-50/50'}
                        `}
                        style={{ marginBottom: `${theme.typography?.paragraphSpacing || 10}pt` }}
                    >
                        {selectedBlockId === block.id && (
                            <div className="absolute -left-12 top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-white shadow-sm border p-1 rounded text-xs font-bold text-gray-400">
                                    {block.type}
                                </div>
                            </div>
                        )}
                        <BlockRenderer block={block} index={index} />
                    </div>
                ))}
            </div>
        </div>
    );
};
