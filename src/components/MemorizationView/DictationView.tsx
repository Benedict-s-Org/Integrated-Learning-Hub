import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle2, RotateCcw, Award, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Word } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface DictationViewProps {
    words: Word[];
    selectedIndices: number[];
    originalText: string;
    onBack: () => void;
    assignmentId?: string;
    isPractice?: boolean;
}

const isBlankableWord = (w: Word) =>
    !w.isPunctuation && !w.isParagraphBreak && w.text !== '\n' && w.text !== '\r\n' && w.text.trim().length > 0;

/** Blanking rule: 3+ letters → first letter only; 1–2 letters → blank line only */
const shouldShowFirstLetter = (text: string): boolean => text.length >= 3;
const getExpectedAnswer = (text: string): string =>
    text.length >= 3 ? text.slice(1).toLowerCase() : text.toLowerCase();

const DictationView: React.FC<DictationViewProps> = ({
    words,
    selectedIndices: _selectedIndices,
    originalText,
    onBack,
    assignmentId,
    isPractice = false,
}) => {
    const { user } = useAuth();
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [accuracy, setAccuracy] = useState(0);
    const [startTime] = useState(Date.now());
    const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    // Dictation blanks every content word (selection is only used upstream for save metadata)
    const blankWords = words.filter(isBlankableWord);
    const blankIndices = blankWords.map(w => w.index);
    const firstBlankIndex = blankIndices[0];

    useEffect(() => {
        if (firstBlankIndex !== undefined && inputRefs.current[firstBlankIndex]) {
            inputRefs.current[firstBlankIndex]?.focus();
        }
    }, [firstBlankIndex]);

    const handleInputChange = (index: number, value: string) => {
        setUserAnswers(prev => ({ ...prev, [index]: value }));
    };

    const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
        if (e.key === 'Enter') {
            const currentIdxInBlank = blankIndices.indexOf(currentIndex);
            if (currentIdxInBlank < blankIndices.length - 1) {
                const nextIndex = blankIndices[currentIdxInBlank + 1];
                inputRefs.current[nextIndex]?.focus();
            } else {
                handleSubmit();
            }
        }
    };

    const handleSubmit = async () => {
        if (isSubmitted) return;

        let correctCount = 0;

        blankWords.forEach(word => {
            const userAnswer = (userAnswers[word.index] || '').trim().toLowerCase();
            const expectedPart = getExpectedAnswer(word.text);
            if (userAnswer === expectedPart) {
                correctCount++;
            }
        });

        const maskedCount = blankWords.length;
        const accuracyPercentage = maskedCount > 0 ? Math.round((correctCount / maskedCount) * 100) : 100;
        setAccuracy(accuracyPercentage);
        setIsSubmitted(true);

        if (accuracyPercentage === 100) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        }

        // Save session
        if (user) {
            try {
                const duration = Math.round((Date.now() - startTime) / 1000);
                const { error } = await supabase
                    .from('memorization_practice_sessions' as any)
                    .insert({
                        user_id: user.id,
                        title: originalText.slice(0, 50) + '...',
                        original_text: originalText,
                        total_words: words.length,
                        hidden_words_count: maskedCount,
                        session_duration_seconds: duration,
                        practice_mode: 'dictation',
                        correct_count: correctCount,
                        accuracy_percentage: accuracyPercentage,
                        user_answers: userAnswers,
                        completed_at: new Date().toISOString()
                    } as any);

                if (error) throw error;

                // Also mark assignment as complete if applicable
                if (assignmentId) {
                    await supabase.rpc('mark_assignment_complete' as any, {
                        p_assignment_id: assignmentId,
                        p_user_id: user.id
                    });
                }
            } catch (err) {
                console.error('Failed to save session:', err);
            }
        }
    };

    const renderWord = (word: Word, idx: number) => {
        // Preserve paragraph / line breaks from original text (same as MemorizationView / ShuffledGameView)
        if (word.isParagraphBreak) {
            return <div key={`para-break-${idx}`} className="block w-full basis-full h-6" aria-hidden="true" />;
        }
        if (word.text === '\n' || word.text === '\r\n') {
            // In flex layouts <br> is ignored; force a full-width wrap instead
            return <div key={`br-${idx}`} className="block w-full basis-full h-0" aria-hidden="true" />;
        }
        if (word.isPunctuation) {
            // Keep original spaces as text nodes so word spacing stays natural
            if (/^\s+$/.test(word.text)) {
                return <span key={`space-${idx}`}>{word.text}</span>;
            }
            return (
                <span key={`punct-${idx}`} className="text-gray-800">
                    {word.text}
                </span>
            );
        }

        if (!isBlankableWord(word)) {
            return (
                <span key={idx} className="inline-block px-1 py-1 text-gray-800">
                    {word.text}
                </span>
            );
        }

        const showFirstLetter = shouldShowFirstLetter(word.text);
        const firstLetter = showFirstLetter ? word.text[0] : '';
        const remainingPart = showFirstLetter ? word.text.slice(1) : word.text;
        const blankWidth = Math.max(remainingPart.length, showFirstLetter ? 2 : 1);

        const currentAnswer = userAnswers[word.index] || '';
        const isCorrect = isSubmitted && currentAnswer.trim().toLowerCase() === remainingPart.toLowerCase();

        return (
            <span key={idx} className="inline-flex items-baseline align-baseline mx-1.5 my-1">
                {showFirstLetter && (
                    <span className="text-gray-800 mr-1 shrink-0 font-medium">{firstLetter}</span>
                )}
                <span className="relative group inline-block">
                    <input
                        ref={el => inputRefs.current[word.index] = el}
                        type="text"
                        value={currentAnswer}
                        onChange={(e) => handleInputChange(word.index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, word.index)}
                        disabled={isSubmitted}
                        placeholder={'_'.repeat(blankWidth)}
                        aria-label={showFirstLetter ? `Complete word starting with ${firstLetter}` : 'Fill in the blank word'}
                        className={`
                            h-8 border-b-2 outline-none transition-all text-center font-medium bg-transparent
                            placeholder:text-gray-400 placeholder:tracking-widest
                            ${isSubmitted
                                ? (isCorrect ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700')
                                : 'border-gray-400 focus:border-blue-500 hover:border-blue-300'
                            }
                        `}
                        style={{ width: `${blankWidth + 1}ch` }}
                    />
                    {isSubmitted && !isCorrect && (
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            Correct: {remainingPart}
                        </span>
                    )}
                </span>
            </span>
        );
    };

    return (
        <div className="min-h-full bg-slate-50 pt-24 pb-12">
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b flex items-center justify-between bg-indigo-600 text-white">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={onBack}
                                className="p-2 hover:bg-indigo-700 rounded-full transition-colors"
                            >
                                <ArrowLeft size={24} />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold">Dictation Mode</h1>
                                <p className="text-indigo-100 text-sm">3+ letters: first letter given · 1–2 letters: blank line only</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            {isSubmitted && (
                                <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-4 py-2">
                                    <Award size={20} className="text-yellow-300" />
                                    <span className="font-bold">Accuracy: {accuracy}%</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="p-8 md:p-12">
                        <div className="flex flex-wrap items-baseline gap-y-2 text-lg leading-[2.4] text-gray-800">
                            {words.map((word, idx) => renderWord(word, idx))}
                        </div>

                        {/* Actions */}
                        <div className="mt-12 flex flex-col items-center border-t pt-8">
                            {!isSubmitted ? (
                                <button
                                    onClick={handleSubmit}
                                    className="px-12 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:scale-105 active:scale-95 flex items-center space-x-3"
                                >
                                    <Sparkles size={20} />
                                    <span>Check Accuracy</span>
                                </button>
                            ) : (
                                <div className="flex flex-col items-center space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center space-x-4">
                                        <div className={`p-4 rounded-full ${accuracy === 100 ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                            <CheckCircle2 size={40} />
                                        </div>
                                        <div className="text-left">
                                            <h2 className="text-2xl font-bold text-gray-800">
                                                {accuracy === 100 ? 'Perfect!' : 'Well Done!'}
                                            </h2>
                                            <p className="text-gray-600">Performance has been recorded.</p>
                                        </div>
                                    </div>
                                    <div className="flex space-x-4">
                                        <button
                                            onClick={onBack}
                                            className="px-8 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                                        >
                                            Finish
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsSubmitted(false);
                                                setUserAnswers({});
                                                setAccuracy(0);
                                            }}
                                            className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center space-x-2"
                                        >
                                            <RotateCcw size={18} />
                                            <span>Try Again</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Info */}
                    {!isSubmitted && (
                        <div className="px-8 py-4 bg-gray-50 border-t flex justify-between items-center text-sm text-gray-500">
                            <div className="flex items-center space-x-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                <span>Hint: Use <b>Tab</b> to move to the next word.</span>
                            </div>
                            <div className="italic">
                                {isPractice ? 'Practice Mode' : 'Training'}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DictationView;
