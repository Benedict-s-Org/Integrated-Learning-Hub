import React from 'react';
import { useExam } from '../store/ExamContext';
import { BlockRenderer } from './BlockRenderer.tsx';

export const Canvas: React.FC = () => {
    const { document, template, selectedBlockId, setSelectedBlockId } = useExam();
    const { theme } = template;

    const pageStyle: React.CSSProperties = {
        width: theme.pageSize === 'A4' ? '210mm' : '8.5in',
        minHeight: theme.pageSize === 'A4' ? '297mm' : '11in',
        padding: `${theme.margins.top}cm ${theme.margins.right}cm ${theme.margins.bottom}cm ${theme.margins.left}cm`,
        backgroundColor: 'white',
        boxShadow: '0 0 20px rgba(0,0,0,0.1)',
        margin: '2rem auto',
        position: 'relative',
        fontFamily: theme.fontFamily === 'serif' ? '"Times New Roman", Times, serif' : 
                    theme.fontFamily === 'monospace' ? 'monospace' : 'Inter, sans-serif',
        fontSize: `${theme.fontSize}px`,
        lineHeight: '1.5',
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
                        className={`relative group transition-all duration-200 cursor-pointer rounded-sm
                            ${selectedBlockId === block.id ? 'ring-2 ring-orange-400 ring-offset-4 z-10' : 'hover:ring-1 hover:ring-orange-200'}
                        `}
                        style={{ marginBottom: `${theme.typography.paragraphSpacing}pt` }}
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
