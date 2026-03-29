import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
    ExamDocument, 
    Template, 
    Block, 
    BlockType 
} from '../types';

interface ExamContextType {
    document: ExamDocument;
    template: Template;
    mode: 'BUILD' | 'TEMPLATE';
    selectedBlockId: string | null;
    referenceFile: { url: string; name: string; type: string } | null;
    setMode: (mode: 'BUILD' | 'TEMPLATE') => void;
    setSelectedBlockId: (id: string | null) => void;
    setReferenceFile: (file: { url: string; name: string; type: string } | null) => void;
    updateTemplate: (updates: Partial<Template>) => void;
    addBlock: (type: BlockType, afterId?: string) => void;
    appendBlocks: (blocks: Block[]) => void;
    updateBlock: (id: string, updates: Partial<Block>) => void;
    deleteBlock: (id: string) => void;
    moveBlock: (id: string, direction: 'UP' | 'DOWN') => void;
}

const INITIAL_DOC: ExamDocument = {
    metadata: {
        title: 'Final Examination',
        subject: 'Mathematics',
        date: '2024-06-01',
        duration: '2 Hours',
        totalMarks: 100,
        version: '1.0'
    },
    templateId: 'default',
    blocks: []
};

const DEFAULT_TEMPLATE: Template = {
    id: 'default',
    name: 'Standard A4',
    theme: {
        pageSize: 'A4',
        fontFamily: 'serif',
        fontSize: 14,
        headerEnabled: true,
        footerEnabled: true,
        margins: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
        typography: {
            paragraphSpacing: 10,
            lineHeight: 1.5
        }
    },
    presets: {
        primaryEnglish: {
            name: "Primary English (Standard)",
            theme: {
                pageSize: 'A4',
                fontFamily: 'pmingliu',
                fontSize: 16,
                headerEnabled: true,
                footerEnabled: true,
                margins: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
                typography: { paragraphSpacing: 12, lineHeight: 1.5 }
            }
        }
    }
};

const ExamContext = createContext<ExamContextType | null>(null);

export const ExamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [document, setDocument] = useState<ExamDocument>(() => {
        const saved = localStorage.getItem('exam-formatter-doc');
        if (!saved) return INITIAL_DOC;
        try {
            const parsed = JSON.parse(saved);
            return { ...INITIAL_DOC, ...parsed };
        } catch (e) {
            return INITIAL_DOC;
        }
    });
    const [template, setTemplate] = useState<Template>(() => {
        const saved = localStorage.getItem('exam-formatter-template');
        if (!saved) return DEFAULT_TEMPLATE;
        try {
            const parsed = JSON.parse(saved);
            // Ensure typography and other nested objects are merged correctly
            return {
                ...DEFAULT_TEMPLATE,
                ...parsed,
                theme: {
                    ...DEFAULT_TEMPLATE.theme,
                    ...parsed.theme,
                    typography: {
                        ...DEFAULT_TEMPLATE.theme.typography,
                        ...(parsed.theme?.typography || {})
                    },
                    margins: {
                        ...DEFAULT_TEMPLATE.theme.margins,
                        ...(parsed.theme?.margins || {})
                    }
                }
            };
        } catch (e) {
            return DEFAULT_TEMPLATE;
        }
    });
    const [mode, setMode] = useState<'BUILD' | 'TEMPLATE'>('BUILD');
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [referenceFile, setReferenceFile] = useState<{ url: string; name: string; type: string } | null>(null);

    useEffect(() => {
        localStorage.setItem('exam-formatter-doc', JSON.stringify(document));
    }, [document]);

    useEffect(() => {
        localStorage.setItem('exam-formatter-template', JSON.stringify(template));
    }, [template]);

    const updateTemplate = useCallback((updates: Partial<Template>) => {
        setTemplate(prev => ({ ...prev, ...updates }));
    }, []);

    const addBlock = useCallback((type: BlockType, afterId?: string) => {
        const newBlock: Block = {
            id: uuidv4(),
            type,
            content: {},
            settings: {}
        };

        setDocument(prev => {
            const index = afterId ? prev.blocks.findIndex(b => b.id === afterId) : -1;
            const newBlocks = [...prev.blocks];
            if (index >= 0) {
                newBlocks.splice(index + 1, 0, newBlock);
            } else {
                newBlocks.push(newBlock);
            }
            return { ...prev, blocks: newBlocks };
        });
        setSelectedBlockId(newBlock.id);
    }, []);

    const appendBlocks = useCallback((blocks: Block[]) => {
        setDocument(prev => ({
            ...prev,
            blocks: [...prev.blocks, ...blocks]
        }));
    }, []);

    const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
        setDocument(prev => ({
            ...prev,
            blocks: prev.blocks.map(b => b.id === id ? { ...b, ...updates } : b)
        }));
    }, []);

    const deleteBlock = useCallback((id: string) => {
        setDocument(prev => ({
            ...prev,
            blocks: prev.blocks.filter(b => b.id !== id)
        }));
        if (selectedBlockId === id) setSelectedBlockId(null);
    }, [selectedBlockId]);

    const moveBlock = useCallback((id: string, direction: 'UP' | 'DOWN') => {
        setDocument(prev => {
            const index = prev.blocks.findIndex(b => b.id === id);
            if (index === -1) return prev;
            if (direction === 'UP' && index === 0) return prev;
            if (direction === 'DOWN' && index === prev.blocks.length - 1) return prev;

            const newBlocks = [...prev.blocks];
            const targetIndex = direction === 'UP' ? index - 1 : index + 1;
            [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
            return { ...prev, blocks: newBlocks };
        });
    }, []);

    return (
        <ExamContext.Provider value={{
            document,
            template,
            mode,
            selectedBlockId,
            referenceFile,
            setMode,
            setSelectedBlockId,
            setReferenceFile,
            updateTemplate,
            addBlock,
            appendBlocks,
            updateBlock,
            deleteBlock,
            moveBlock
        }}>
            {children}
        </ExamContext.Provider>
    );
};

export const useExam = () => {
    const context = useContext(ExamContext);
    if (!context) throw new Error('useExam must be used within ExamProvider');
    return context;
};
