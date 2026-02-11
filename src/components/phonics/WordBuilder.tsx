import { useState } from 'react';
import { Hammer, Check, RotateCcw, Sparkles } from 'lucide-react';
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import confetti from 'canvas-confetti';

// Simple predefined CVC word list for MVP
const WORD_LIST = [
    { word: "CAT", image: "🐱" },
    { word: "DOG", image: "🐶" },
    { word: "BAT", image: "🦇" },
    { word: "SUN", image: "☀️" },
    { word: "PIG", image: "🐷" },
    { word: "BOX", image: "📦" },
];

const DraggableLetter = ({ letter, id }: { letter: string; id: string }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: id,
        data: { letter },
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="w-16 h-16 bg-white border-2 border-amber-200 rounded-xl shadow-md flex items-center justify-center text-3xl font-bold text-slate-700 hover:scale-105 active:scale-95 touch-none"
        >
            {letter}
        </button>
    );
};

const DropZone = ({ index, letter }: { index: number; letter: string | null }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `drop-${index}`,
    });

    return (
        <div
            ref={setNodeRef}
            className={`
        w-20 h-20 rounded-xl border-4 border-dashed flex items-center justify-center text-4xl font-black transition-colors
        ${isOver ? 'bg-amber-100 border-amber-400' : 'bg-white/50 border-amber-200'}
        ${letter ? 'border-solid border-amber-500 bg-white text-amber-600' : 'text-slate-300'}
      `}
        >
            {letter}
        </div>
    );
};

export const WordBuilder = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [placedLetters, setPlacedLetters] = useState<(string | null)[]>([null, null, null]);
    const [availableLetters, setAvailableLetters] = useState<{ id: string; letter: string }[]>([]);
    const [isComplete, setIsComplete] = useState(false);

    const currentWord = WORD_LIST[currentIndex];

    // Initialize letters on mount or word change
    useState(() => {
        shuffleLetters();
    });

    function shuffleLetters() {
        const letters = currentWord.word.split('').map((l, i) => ({ id: `letter-${l}-${i}-${Math.random()}`, letter: l }));
        // Add distractors? Maybe later. For now just scramble.
        setAvailableLetters(letters.sort(() => Math.random() - 0.5));
        setPlacedLetters(new Array(currentWord.word.length).fill(null));
        setIsComplete(false);
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && over.id.toString().startsWith('drop-')) {
            const dropIndex = parseInt(over.id.toString().split('-')[1]);
            const letter = active.data.current?.letter as string;
            const letterId = active.id as string;

            // Update placed letters
            const newPlaced = [...placedLetters];
            newPlaced[dropIndex] = letter;
            setPlacedLetters(newPlaced);

            // Remove from available
            setAvailableLetters(prev => prev.filter(l => l.id !== letterId));

            // Check win condition
            if (newPlaced.every(l => l !== null)) {
                if (newPlaced.join('') === currentWord.word) {
                    setIsComplete(true);
                    confetti({
                        particleCount: 150,
                        spread: 60,
                        colors: ['#A7F3D0', '#34D399', '#059669'] // Emerald greens
                    });
                }
            }
        }
    };

    const nextWord = () => {
        setCurrentIndex((prev) => (prev + 1) % WORD_LIST.length);
        // Logic to reset state handled by effect/function call? 
        // Need to trigger re-shuffle.
        setTimeout(() => {
            const nextIdx = (currentIndex + 1) % WORD_LIST.length;
            const nextWord = WORD_LIST[nextIdx];
            const letters = nextWord.word.split('').map((l, i) => ({ id: `letter-${l}-${i}-${Math.random()}`, letter: l }));
            setAvailableLetters(letters.sort(() => Math.random() - 0.5));
            setPlacedLetters(new Array(nextWord.word.length).fill(null));
            setIsComplete(false);
        }, 0)
    };

    const resetCurrent = () => {
        shuffleLetters();
    };

    return (
        <DndContext onDragEnd={handleDragEnd}>
            <div className="max-w-4xl mx-auto flex flex-col items-center gap-12 py-8">

                {/* Header / Target */}
                <div className="text-center animate-in zoom-in duration-500">
                    <div className="text-9xl mb-4 filter drop-shadow-xl">{currentWord.image}</div>
                    <h2 className="text-amber-800 font-bold text-xl opacity-50">Build the word!</h2>
                </div>

                {/* Drop Zones */}
                <div className="flex gap-4">
                    {placedLetters.map((letter, index) => (
                        <DropZone key={index} index={index} letter={letter} />
                    ))}
                </div>

                {/* Success Message or Reset */}
                <div className="h-16 flex items-center justify-center">
                    {isComplete ? (
                        <div className="flex flex-col items-center gap-4 animate-in slide-in-from-bottom-4">
                            <div className="flex items-center gap-2 text-2xl font-black text-emerald-600">
                                <Sparkles className="w-8 h-8" />
                                <span>{currentWord.word}!</span>
                            </div>
                            <button
                                onClick={nextWord}
                                className="px-6 py-2 bg-emerald-500 text-white rounded-full font-bold shadow-lg hover:bg-emerald-600 transition-transform hover:scale-105 active:scale-95"
                            >
                                Next Word
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={resetCurrent}
                            className="flex items-center gap-2 text-slate-400 hover:text-amber-600 transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            <span>Reset Letters</span>
                        </button>
                    )}
                </div>

                {/* Letter Pool */}
                <div className="flex flex-wrap justify-center gap-4 p-8 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 min-h-[160px] w-full max-w-lg">
                    {!isComplete && availableLetters.map((item) => (
                        <DraggableLetter key={item.id} id={item.id} letter={item.letter} />
                    ))}
                    {isComplete && (
                        <div className="flex items-center gap-2 text-slate-400 italic">
                            <Check className="w-5 h-5" />
                            <span>Word Complete!</span>
                        </div>
                    )}
                </div>

            </div>
        </DndContext>
    );
};
