import React, { useState, useEffect } from 'react';
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

interface ShuffledGameViewProps {
    words: Word[];
    onBack: () => void;
    isPractice?: boolean;
}

interface GameWord {
    id: string; // Unique ID for dnd-kit
    text: string;
    originalIndex: number;
    isPunctuation: boolean;
    isParagraphBreak: boolean;
}

const SortableWord = ({ id, text, isCorrect, isDragging }: { id: string; text: string; isCorrect: boolean; isDragging: boolean }) => {
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
        ${isCorrect
                    ? 'bg-green-100 border-green-400 text-green-800'
                    : 'bg-white border-gray-200 text-gray-800 shadow-sm hover:border-blue-400 hover:shadow-md'
                }
        ${isDragging ? 'opacity-50 scale-105 shadow-xl' : 'opacity-100'}
      `}
        >
            {text}
        </div>
    );
};

const ShuffledGameView: React.FC<ShuffledGameViewProps> = ({ words, onBack, isPractice = false }) => {
    const [gameWords, setGameWords] = useState<GameWord[]>([]);
    const [isComplete, setIsComplete] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

    // Initialize game
    useEffect(() => {
        // Only shuffle the selected words (the ones intended for the game)
        // Actually, usually we'd want to shuffle ALL words if it's a "Sentence Scramble"
        // But based on the selection, maybe only some are "blanks"?
        // The user said: "arrange shuffled words from a paragraph into their correct order"
        // Usually that means ALL words.

        const initialWords: GameWord[] = words.map((w, idx) => ({
            id: `word-${idx}-${w.text}`,
            text: w.text,
            originalIndex: idx,
            isPunctuation: w.isPunctuation || false,
            isParagraphBreak: w.isParagraphBreak || false
        }));

        // Identify which words to shuffle (exclude punctuation and paragraph breaks)
        const wordsToShuffle = initialWords
            .filter(w => !w.isPunctuation && !w.isParagraphBreak && w.text.trim().length > 0);

        const shuffled = [...wordsToShuffle].sort(() => Math.random() - 0.5);

        // Reconstruct the array with shuffled words in word-positions and punctuation in place
        let shuffledIdx = 0;
        const finalWords = initialWords.map(w => {
            if (!w.isPunctuation && !w.isParagraphBreak && w.text.trim().length > 0) {
                return shuffled[shuffledIdx++];
            }
            return w;
        });

        setGameWords(finalWords);
        setIsComplete(false);
    }, [words]);

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

        if (over && active.id !== over.id) {
            setGameWords((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);

                // Prevent moving non-shuffleable items?
                // Actually, it's better to allow full freedom but only shuffle words initially.

                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // Check if current order matches original text sequence
    useEffect(() => {
        if (gameWords.length === 0) return;

        // Check correctness: every word position should match the text of the original word at that position
        // We ignore punctuation/breaks if they are intended to be fixed, but here we allow full reordering.
        // The "Repeated words" rule: as long as the text matches, it's fine.

        const isCorrect = gameWords.every((word, idx) => {
            // Allow soft matching (trimming) if necessary, but usually exact match is expected
            return word.text === words[idx].text;
        });

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

    const handleReset = () => {
        // Simple reset logic:
        const initialWords: GameWord[] = words.map((w, idx) => ({
            id: `word-${idx}-${Date.now()}`, // New IDs to force refresh
            text: w.text,
            originalIndex: idx,
            isPunctuation: w.isPunctuation || false,
            isParagraphBreak: w.isParagraphBreak || false
        }));

        const wordsToShuffleList = initialWords.filter(w => !w.isPunctuation && !w.isParagraphBreak && w.text.trim().length > 0);
        const shuffledList = [...wordsToShuffleList].sort(() => Math.random() - 0.5);

        let sIdx = 0;
        const finalWords = initialWords.map(w => {
            if (!w.isPunctuation && !w.isParagraphBreak && w.text.trim().length > 0) {
                return shuffledList[sIdx++];
            }
            return w;
        });

        setGameWords(finalWords);
        setIsComplete(false);
    };

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
                            >
                                <ArrowLeft size={24} />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold">Shuffled Word Game</h1>
                                <p className="text-blue-100 text-sm">
                                    Drag and drop words into the correct order
                                </p>
                            </div>
                        </div>
                        {!isComplete && (
                            <button
                                onClick={handleReset}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors font-medium border border-blue-400"
                            >
                                <RotateCcw size={18} />
                                <span>Reset</span>
                            </button>
                        )}
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
                                    <div className="flex flex-wrap items-baseline leading-loose text-lg">
                                        {gameWords.map((word, idx) => {
                                            if (word.isParagraphBreak) {
                                                return <div key={word.id} className="w-full h-8" />;
                                            }
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
                                                    isCorrect={word.text === words[idx].text}
                                                />
                                            );
                                        })}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        )}
                    </div>

                    {/* Footer Info */}
                    {!isComplete && (
                        <div className="px-8 py-4 bg-gray-50 border-t flex justify-between items-center">
                            <div className="flex items-center space-x-2 text-gray-500">
                                <PartyPopper size={18} className="text-blue-500" />
                                <span className="text-sm">Hint: Green words are in the correct position!</span>
                            </div>
                            <div className="text-gray-400 text-sm italic">
                                {isPractice ? 'Practice Mode' : 'Training'}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShuffledGameView;
