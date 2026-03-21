import React from 'react';
import { Block } from '../types';

interface BlockRendererProps {
    block: Block;
    index: number;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({ block, index }) => {
    switch (block.type) {
        case 'COVER':
            return (
                <div className="text-center py-8 border-b-2 border-black mb-8">
                    <h1 className="text-3xl font-bold uppercase tracking-widest mb-2">
                        {block.content.title || 'EXAMINATION PAPER'}
                    </h1>
                    <h2 className="text-xl font-semibold">
                        {block.content.subtitle || 'Subject Name'}
                    </h2>
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
                <div className="bg-gray-50 p-4 border-l-4 border-black my-6">
                    <h3 className="text-lg font-bold uppercase tracking-wider">
                        {block.content.title || 'SECTION A'}
                    </h3>
                    {block.content.description && (
                        <p className="text-sm mt-1">{block.content.description}</p>
                    )}
                </div>
            );

        case 'QUESTION':
            return (
                <div className="flex gap-4 items-start py-2">
                    <div className="font-bold min-w-[2rem]">{index + 1}.</div>
                    <div className="flex-1">
                        <div className={`whitespace-pre-wrap ${block.content.bold ? 'font-bold' : ''}`}>
                            {block.content.stem || 'Enter question text here...'}
                        </div>
                        {block.content.options && (
                            <div className="mt-4 grid grid-cols-1 gap-2 pl-4">
                                {block.content.options.map((opt: string, i: number) => (
                                    <div key={i} className="flex gap-2">
                                        <span className="font-semibold">{String.fromCharCode(65 + i)}.</span>
                                        <span>{opt}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {block.content.marks && (
                        <div className="font-bold underline ml-4 italic whitespace-nowrap">
                            [{block.content.marks}]
                        </div>
                    )}
                </div>
            );

        case 'INSTRUCTIONS':
            return (
                <div className="border border-black p-4 my-4 rounded-sm text-sm italic">
                    <h4 className="font-bold uppercase not-italic mb-2">Instructions to Candidates:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                        {block.content.items?.map((item: string, i: number) => (
                            <li key={i}>{item}</li>
                        )) || (
                            <>
                                <li>Answer all questions.</li>
                                <li>Write your answers clearly in the spaces provided.</li>
                            </>
                        )}
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
