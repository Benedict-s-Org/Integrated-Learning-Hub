import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, RotateCcw, PartyPopper, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Word } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface ShuffledGameViewProps {
    words: Word[];
    onBack: () => void;
    isPractice?: boolean;
    onSaveGame?: () => void;
    assignmentId?: string;
}

/** 1 = sentence / line ranges (. ? ! or line break); 2 = line / paragraph ranges only */
type ShuffleLevel = 1 | 2;

interface GameWord {
    id: string;
    text: string;
    originalIndex: number;
    isPunctuation: boolean;
    isParagraphBreak: boolean;
    /** Content words share a bucket; punctuation / breaks are null (fixed) */
    bucketId: number | null;
}

const isContentWord = (w: { isPunctuation: boolean; isParagraphBreak: boolean; text: string }) =>
    !w.isPunctuation && !w.isParagraphBreak && w.text.trim().length > 0;

const isLineBreak = (w: { text: string; isParagraphBreak: boolean }) =>
    w.isParagraphBreak || w.text === '\n' || w.text === '\r\n' || w.text.includes('\n');

const isSentenceEnd = (w: { isPunctuation: boolean; text: string }) =>
    w.isPunctuation && /^[.?!]+$/.test(w.text);

const fisherYatesShuffle = <T,>(items: T[]): T[] => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

/** One visual row per sentence / line range (not CSS width wrapping). */
const groupIntoSentenceRows = (gameWords: GameWord[]): { word: GameWord; globalIndex: number }[][] => {
    const rows: { word: GameWord; globalIndex: number }[][] = [];
    let current: { word: GameWord; globalIndex: number }[] = [];
    let currentBucket: number | null = null;

    const flush = () => {
        if (current.length > 0) rows.push(current);
        current = [];
        currentBucket = null;
    };

    gameWords.forEach((w, globalIndex) => {
        if (w.isParagraphBreak || w.text === '\n' || w.text === '\r\n') {
            flush();
            return;
        }

        if (isContentWord(w)) {
            if (currentBucket !== null && w.bucketId !== currentBucket) {
                flush();
            }
            current.push({ word: w, globalIndex });
            currentBucket = w.bucketId;
            return;
        }

        // Punctuation stays on the current sentence row
        current.push({ word: w, globalIndex });
    });

    flush();
    return rows;
};

const SortableWord = ({ id, text, isDragging }: { id: string; text: string; isDragging: boolean }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`
        inline-block px-3 py-2 m-1 rounded-lg border-2 cursor-grab active:cursor-grabbing select-none
        transition-all duration-200
        bg-white border-gray-200 text-gray-800 shadow-sm hover:border-blue-400 hover:shadow-md
        ${isDragging ? 'opacity-50 scale-105 shadow-xl' : 'opacity-100'}
      `}
        >
            {text}
        </div>
    );
};

const buildShuffledWords = (words: Word[], currentLevel: ShuffleLevel): GameWord[] => {
    const initialWords: GameWord[] = words.map((w, idx) => ({
        id: `word-${idx}-${w.text}`,
        text: w.text,
        originalIndex: idx,
        isPunctuation: w.isPunctuation || false,
        isParagraphBreak: w.isParagraphBreak || false,
        bucketId: null,
    }));

    type Bucket = { endIndex: number; words: GameWord[] };
    const buckets: Bucket[] = [];
    let currentBucketWords: GameWord[] = [];
    let bucketId = 0;

    const flushBucket = (endIndex: number) => {
        if (currentBucketWords.length === 0) return;
        currentBucketWords.forEach(w => {
            w.bucketId = bucketId;
        });
        buckets.push({
            endIndex,
            words: fisherYatesShuffle(currentBucketWords),
        });
        bucketId += 1;
        currentBucketWords = [];
    };

    for (let i = 0; i < initialWords.length; i++) {
        const w = initialWords[i];
        if (isContentWord(w)) {
            currentBucketWords.push(w);
        }

        const atEnd = i === initialWords.length - 1;
        const boundary =
            atEnd ||
            isLineBreak(w) ||
            (currentLevel === 1 && isSentenceEnd(w));

        if (boundary) {
            flushBucket(i);
        }
    }

    // Reconstruct: keep punctuation / breaks fixed; fill content slots from shuffled buckets
    const finalWords: GameWord[] = [];
    let bucketIdx = 0;
    let wordInBucketIdx = 0;

    for (let i = 0; i < initialWords.length; i++) {
        const w = initialWords[i];
        if (isContentWord(w)) {
            let currentBucket = buckets[bucketIdx];
            while (currentBucket && i > currentBucket.endIndex) {
                bucketIdx += 1;
                currentBucket = buckets[bucketIdx];
                wordInBucketIdx = 0;
            }

            if (currentBucket && wordInBucketIdx < currentBucket.words.length) {
                const shuffled = currentBucket.words[wordInBucketIdx++];
                finalWords.push({
                    ...shuffled,
                    id: `slot-${i}-${shuffled.originalIndex}-${Math.random().toString(36).slice(2, 8)}`,
                });
            } else {
                finalWords.push({ ...w, id: `slot-${i}-${w.originalIndex}` });
            }
        } else {
            finalWords.push({ ...w, id: `fixed-${i}-${w.text}` });
        }
    }

    return finalWords;
};

const ShuffledGameView: React.FC<ShuffledGameViewProps> = ({ words, onBack, isPractice = false, onSaveGame, assignmentId }) => {
    const { user } = useAuth();
    const profileLevel = (user?.reading_rearranging_level as ShuffleLevel | undefined) || 1;
    const [level] = useState<ShuffleLevel>(profileLevel === 2 ? 2 : 1);
    const [gameWords, setGameWords] = useState<GameWord[]>([]);
    const [isComplete, setIsComplete] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const completionMarkedRef = useRef(false);

    const shuffleWords = useCallback((currentLevel: ShuffleLevel) => {
        setGameWords(buildShuffledWords(words, currentLevel));
        setIsComplete(false);
    }, [words]);

    useEffect(() => {
        shuffleWords(level);
    }, [shuffleWords, level]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over || active.id === over.id) return;

        setGameWords((items) => {
            const oldIndex = items.findIndex(item => item.id === active.id);
            const newIndex = items.findIndex(item => item.id === over.id);
            if (oldIndex < 0 || newIndex < 0) return items;

            const activeWord = items[oldIndex];
            const overWord = items[newIndex];

            // Only reorder content words within the same sentence / line range
            if (
                activeWord.bucketId === null ||
                overWord.bucketId === null ||
                activeWord.bucketId !== overWord.bucketId
            ) {
                return items;
            }

            return arrayMove(items, oldIndex, newIndex);
        });
    };

    useEffect(() => {
        if (gameWords.length === 0) return;

        const isCorrect = gameWords.every((word, idx) => word.text === words[idx].text);

        if (isCorrect && !isComplete) {
            setIsComplete(true);
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
            });
        }
    }, [gameWords, words, isComplete]);

    useEffect(() => {
        if (!isComplete || !assignmentId || !user || completionMarkedRef.current) return;
        completionMarkedRef.current = true;
        void supabase.rpc('mark_assignment_complete' as any, {
            p_assignment_id: assignmentId,
            p_assignment_type: 'memorization',
        }).then(({ error }) => {
            if (error) console.error('Error marking memorization assignment complete:', error);
        });
    }, [isComplete, assignmentId, user]);

    const handleReset = () => {
        shuffleWords(level);
    };

    const levelHint =
        level === 1
            ? 'Each sentence (or line) is its own row — words shuffle only inside that row'
            : 'Each line / paragraph is its own row — words shuffle only inside that row'

    return (
        <div className="min-h-full bg-gray-50 pt-20 pb-12">
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b flex items-center justify-between bg-blue-600 text-white">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={onBack}
                                className="p-2 hover:bg-blue-700 rounded-full transition-colors"
                                data-ui="BTN-BACK"
                            >
                                <ArrowLeft size={24} />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold">Shuffled Word Game</h1>
                                <p className="text-blue-100 text-sm">{levelHint}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            {!isComplete && (
                                <button
                                    onClick={handleReset}
                                    data-ui="BTN-REFRESH"
                                    className="flex items-center space-x-2 px-3 py-1.5 bg-blue-500/80 hover:bg-blue-400 rounded-lg transition-colors font-medium border border-blue-400 shadow-sm text-sm"
                                >
                                    <RotateCcw size={16} />
                                    <span>Reset</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Game Area */}
                    <div className="p-8 min-h-[400px]">
                        {isComplete ? (
                            <div className="flex flex-col items-center justify-center space-y-6 py-12 animate-in zoom-in duration-500">
                                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                                    <CheckCircle2 size={64} />
                                </div>
                                <div className="text-center">
                                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Well Done!</h2>
                                    <p className="text-gray-600 text-lg">You've correctly arranged the paragraph.</p>
                                </div>
                                <div className="flex space-x-4">
                                    <button
                                        onClick={onBack}
                                        className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition-all transform hover:scale-105"
                                    >
                                        Finish
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        className="px-8 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={gameWords.map(w => w.id)}
                                    strategy={horizontalListSortingStrategy}
                                >
                                    <div className="flex flex-col gap-4">
                                        {groupIntoSentenceRows(gameWords).map((row, rowIdx) => (
                                            <div
                                                key={`row-${rowIdx}`}
                                                className="flex flex-wrap items-center gap-y-1 rounded-xl bg-slate-50/80 px-2 py-2 border border-slate-100"
                                            >
                                                {row.map(({ word }) => {
                                                    if (word.isPunctuation) {
                                                        return (
                                                            <div key={word.id} className="px-1 py-2 text-gray-400 select-none">
                                                                {word.text}
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <SortableWord
                                                            key={word.id}
                                                            id={word.id}
                                                            text={word.text}
                                                            isDragging={activeId === word.id}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        )}
                    </div>

                    {/* Footer Info */}
                    {!isComplete && (
                        <div className="px-8 py-4 bg-gray-50 border-t flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 text-sm">
                            <div className="flex items-center space-x-2 text-gray-500">
                                <PartyPopper size={18} className="text-blue-500" />
                                <span>Hint: Drag words only within the same sentence or line.</span>
                            </div>
                            <div className="flex items-center space-x-4">
                                {onSaveGame && (
                                    <button
                                        onClick={onSaveGame}
                                        data-ui="BTN-SAVE-PRACTICE"
                                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow-sm transition-colors"
                                    >
                                        Save Game
                                    </button>
                                )}
                                <span className="text-gray-400 italic">
                                    {isPractice ? 'Practice Mode' : 'Training'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShuffledGameView;
