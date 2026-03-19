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

const DictationView: React.FC<DictationViewProps> = ({
    words,
    selectedIndices,
    originalText,
    onBack,
    assignmentId,
    isPractice = false,
}) => {
    const { user } = useAuth();
    const [level] = useState<1 | 2 | 3>(
        (user?.memorization_level as 1 | 2 | 3) || 1
    );
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [accuracy, setAccuracy] = useState(0);
    const [startTime] = useState(Date.now());
    const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    // Filter relevant words (only those selected and not punctuation)
    const selectedWords = words.filter(w => selectedIndices.includes(w.index) && !w.isPunctuation);

    useEffect(() => {
        // Auto-focus first input
        const firstIndex = selectedIndices[0];
        if (firstIndex !== undefined && inputRefs.current[firstIndex]) {
            inputRefs.current[firstIndex]?.focus();
        }
    }, [selectedIndices]);

    const handleInputChange = (index: number, value: string) => {
        setUserAnswers(prev => ({ ...prev, [index]: value }));
    };

    const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
        if (e.key === 'Enter') {
            const currentIdxInSelected = selectedIndices.indexOf(currentIndex);
            if (currentIdxInSelected < selectedIndices.length - 1) {
                const nextIndex = selectedIndices[currentIdxInSelected + 1];
                inputRefs.current[nextIndex]?.focus();
            } else {
                handleSubmit();
            }
        }
    };

    const handleSubmit = async () => {
        if (isSubmitted) return;

        let correctCount = 0;
        const totalCount = selectedWords.length;
        console.log('Total selected words:', totalCount);

        selectedWords.forEach(word => {
            const userAnswer = (userAnswers[word.index] || '').trim().toLowerCase();
            let expectedPart = '';

            if (level === 1) {
                if (word.text.length >= 4) {
                    expectedPart = word.text.slice(1).toLowerCase();
                }
            } else if (level === 2) {
                if (word.text.length >= 3) {
                    expectedPart = word.text.slice(1).toLowerCase();
                }
            } else { // Level 3
                if (word.text.length <= 3) {
                    expectedPart = word.text.toLowerCase();
                } else {
                    expectedPart = word.text.slice(1).toLowerCase();
                }
            }

            if (expectedPart && userAnswer === expectedPart) {
                correctCount++;
            } else if (!expectedPart) {
                // Not masked, so considered "correct" for calculation?
                // Or just don't include in totalCount.
            }
        });

        // Re-calculate counts based on what was actually masked
        let maskedCount = 0;
        selectedWords.forEach(word => {
            if (level === 3 || (level === 2 && word.text.length >= 3) || (level === 1 && word.text.length >= 4)) {
                maskedCount++;
            }
        });

        const accuracyPercentage = maskedCount > 0 ? Math.round((correctCount / maskedCount) * 100) : 100;
        setAccuracy(accuracyPercentage);
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
        if (word.isParagraphBreak) return <div key={idx} className="w-full h-8" />;
        if (word.text === '\n') return <br key={idx} />;

        const isSelected = selectedIndices.includes(word.index);
        const isMasked = isSelected && !word.isPunctuation && (
            (level === 1 && word.text.length >= 4) ||
            (level === 2 && word.text.length >= 3) ||
            (level === 3)
        );

        if (!isMasked) {
            return (
                <span key={idx} className="inline-block px-1 py-1 text-gray-800">
                    {word.text}
                </span>
            );
        }

        const showFirstLetter = word.text.length >= 4 || (level === 2 && word.text.length === 3);
        const firstLetter = showFirstLetter ? word.text[0] : '';
        const remainingPart = showFirstLetter ? word.text.slice(1) : word.text;

        const currentAnswer = userAnswers[word.index] || '';
        const isCorrect = isSubmitted && currentAnswer.trim().toLowerCase() === remainingPart.toLowerCase();

        return (
            <span key={idx} className="inline-flex items-baseline mx-0.5">
                {showFirstLetter && <span className="text-gray-800 mr-0.5">{firstLetter}</span>}
                <div className="relative group">
                    <input
                        ref={el => inputRefs.current[word.index] = el}
                        type="text"
                        value={currentAnswer}
                        onChange={(e) => handleInputChange(word.index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, word.index)}
                        disabled={isSubmitted}
                        className={`
                            h-8 border-b-2 outline-none transition-all text-center font-medium
                            ${isSubmitted
                                ? (isCorrect ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700')
                                : 'border-gray-300 focus:border-blue-500 hover:border-blue-300'
                            }
                        `}
                        style={{ width: `${Math.max(remainingPart.length + 1, 2)}ch` }}
                    />
                    {isSubmitted && !isCorrect && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            Correct: {remainingPart}
                        </div>
                    )}
                </div>
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
                                <p className="text-indigo-100 text-sm">Fill in the missing parts of the paragraph</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
{/* Hiding difficulty selection as it is now managed at student level
                            {!isSubmitted && (
                                <div className="flex bg-indigo-700/50 rounded-lg p-1 border border-indigo-500/30">
                                    <button
                                        onClick={() => setLevel(1)}
                                        className={`px-3 py-1 rounded-md text-sm font-bold transition-all ${level === 1 ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-100 hover:text-white'}`}
                                    >
                                        Level 1 (Easy)
                                    </button>
                                    <button
                                        onClick={() => setLevel(2)}
                                        className={`px-3 py-1 rounded-md text-sm font-bold transition-all ${level === 2 ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-100 hover:text-white'}`}
                                    >
                                        Level 2 (Normal)
                                    </button>
                                    <button
                                        onClick={() => setLevel(3)}
                                        className={`px-3 py-1 rounded-md text-sm font-bold transition-all ${level === 3 ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-100 hover:text-white'}`}
                                    >
                                        Level 3 (Advance)
                                    </button>
                                </div>
                            )}
                            */}
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
                        <div className="flex flex-wrap items-baseline leading-loose text-lg text-gray-800">
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
