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
    onSaveGame?: () => void;
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

const ShuffledGameView: React.FC<ShuffledGameViewProps> = ({ words, onBack, isPractice = false, onSaveGame }) => {
    const [gameWords, setGameWords] = useState<GameWord[]>([]);
    const [isComplete, setIsComplete] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [level, setLevel] = useState<number>(3); // 1 = Sentence, 2 = Paragraph, 3 = All

    const shuffleWords = (currentLevel: number) => {
        const initialWords: GameWord[] = words.map((w, idx) => ({
            id: `word-${idx}-${Date.now()}-${w.text}`,
            text: w.text,
            originalIndex: idx,
            isPunctuation: w.isPunctuation || false,
            isParagraphBreak: w.isParagraphBreak || false
        }));

        let buckets: { startIndex: number, endIndex: number, words: GameWord[] }[] = [];
        let currentBucketWords: GameWord[] = [];
        let startIndex = 0;

        for (let i = 0; i < initialWords.length; i++) {
            const w = initialWords[i];
            if (!w.isPunctuation && !w.isParagraphBreak && w.text.trim().length > 0) {
                currentBucketWords.push(w);
            }

            let isBoundary = false;
            if (currentLevel === 1) {
                // Sentence boundary (., ?, !) or paragraph break
                if ((w.isPunctuation && /^[.?!]+$/.test(w.text)) || w.isParagraphBreak || w.text.includes('\n') || i === initialWords.length - 1) {
                    isBoundary = true;
                }
            } else if (currentLevel === 2) {
                // Paragraph boundary
                if (w.isParagraphBreak || w.text.includes('\n') || i === initialWords.length - 1) {
                    isBoundary = true;
                }
            } else {
                // Level 3: All words are in a single bucket ends at the very end
                if (i === initialWords.length - 1) {
                    isBoundary = true;
                }
            }

            if (isBoundary && currentBucketWords.length > 0) {
                buckets.push({
                    startIndex: startIndex,
                    endIndex: i,
                    words: currentBucketWords
                });
                currentBucketWords = [];
                startIndex = i + 1;
            } else if (isBoundary) {
                startIndex = i + 1;
            }
        }

        // Shuffle each bucket
        buckets.forEach(b => {
            b.words = b.words.sort(() => Math.random() - 0.5);
        });

        // Reconstruct
        const finalWords: GameWord[] = [];
        let bucketIdx = 0;
        let wordInBucketIdx = 0;

        for (let i = 0; i < initialWords.length; i++) {
            const w = initialWords[i];
            if (!w.isPunctuation && !w.isParagraphBreak && w.text.trim().length > 0) {
                // Find correct bucket
                let currentBucket = buckets[bucketIdx];
                while (currentBucket && i > currentBucket.endIndex) {
                    bucketIdx++;
                    currentBucket = buckets[bucketIdx];
                    wordInBucketIdx = 0;
                }

                if (currentBucket && wordInBucketIdx < currentBucket.words.length) {
                    finalWords.push(currentBucket.words[wordInBucketIdx++]);
                } else {
                    finalWords.push(w);
                }
            } else {
                finalWords.push(w);
            }
        }

        setGameWords(finalWords);
        setIsComplete(false);
    };

    // Initialize game
    useEffect(() => {
        shuffleWords(level);
    }, [words, level]);

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
        shuffleWords(level);
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
                        <div className="flex items-center space-x-3">
                            {!isComplete && (
                                <div className="flex items-center bg-blue-700/50 rounded-lg px-2 py-1 border border-blue-500/30">
                                    <label className="text-sm font-medium text-blue-100 mr-2">Level:</label>
                                    <select
                                        value={level}
                                        onChange={(e) => setLevel(Number(e.target.value))}
                                        className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer"
                                    >
                                        <option value={1} className="text-gray-900">1 (Sentence)</option>
                                        <option value={2} className="text-gray-900">2 (Paragraph)</option>
                                        <option value={3} className="text-gray-900">3 (All)</option>
                                    </select>
                                </div>
                            )}
                            {!isComplete && (
                                <button
                                    onClick={handleReset}
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
                        <div className="px-8 py-4 bg-gray-50 border-t flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 text-sm">
                            <div className="flex items-center space-x-2 text-gray-500">
                                <PartyPopper size={18} className="text-blue-500" />
                                <span>Hint: Green words are in the correct position!</span>
                            </div>
                            <div className="flex items-center space-x-4">
                                {onSaveGame && (
                                    <button
                                        onClick={onSaveGame}
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
