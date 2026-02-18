import { useState, useEffect, useCallback } from 'react';
import { Volume2, Trophy, Loader2, Sparkles, XCircle, RotateCcw } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import confetti from 'canvas-confetti';
import { usePhonicsGameHub } from '../../context/PhonicsGameHubContext';
import { useNavigate } from 'react-router-dom';

interface PhonicsSound {
    id: string;
    sound_code: string;
    display_name: string;
    audio_url: string;
    category: string;
}

export const PhonicsQuiz = () => {
    const [sounds, setSounds] = useState<PhonicsSound[]>([]);
    const [loading, setLoading] = useState(true);

    // Game State
    const [currentSound, setCurrentSound] = useState<PhonicsSound | null>(null);
    const [options, setOptions] = useState<PhonicsSound[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [bestStreak, setBestStreak] = useState(0);
    const [gameState, setGameState] = useState<'playing' | 'correct' | 'incorrect' | 'finished'>('playing');

    // Game Hub Integration
    const { recordSession } = usePhonicsGameHub();
    const navigate = useNavigate();
    const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0, startTime: Date.now() });
    const [xpGained, setXpGained] = useState(0);

    useEffect(() => {
        fetchSounds();
    }, []);

    const fetchSounds = async () => {
        try {
            const { data, error } = await supabase
                .from('phonics_sounds')
                .select('*');

            if (error) throw error;

            if (data && data.length > 0) {
                setSounds(data as unknown as PhonicsSound[]);
                setLoading(false);
                // Start first game round once sounds are loaded
                generateQuestion(data as unknown as PhonicsSound[]);
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error('Error fetching sounds:', error);
            setLoading(false);
        }
    };

    const generateQuestion = useCallback((soundPool: PhonicsSound[]) => {
        if (soundPool.length < 4) return;

        // Pick a random target sound
        const targetIndex = Math.floor(Math.random() * soundPool.length);
        const target = soundPool[targetIndex];

        // Pick 3 distractors
        const distractors: PhonicsSound[] = [];
        const usedIndices = new Set([targetIndex]);

        while (distractors.length < 3) {
            const idx = Math.floor(Math.random() * soundPool.length);
            if (!usedIndices.has(idx)) {
                distractors.push(soundPool[idx]);
                usedIndices.add(idx);
            }
        }

        // Shuffle options
        const allOptions = [target, ...distractors].sort(() => Math.random() - 0.5);

        setCurrentSound(target);
        setOptions(allOptions);
        setGameState('playing');

        // Auto-play sound after a short delay
        setTimeout(() => {
            const audio = new Audio(target.audio_url);
            audio.play().catch(e => console.error("Auto-play blocked", e));
        }, 500);

    }, []);

    const playTargetSound = () => {
        if (currentSound && !isPlaying) {
            setIsPlaying(true);
            const audio = new Audio(currentSound.audio_url);
            audio.onended = () => setIsPlaying(false);
            audio.play();
        }
    };

    const handleOptionClick = (selectedSound: PhonicsSound) => {
        if (gameState !== 'playing' || !currentSound) return;

        if (selectedSound.id === currentSound.id) {
            // Correct!
            setGameState('correct');
            setScore(s => s + 10);
            setSessionStats(prev => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
            setStreak(s => {
                const newStreak = s + 1;
                if (newStreak > bestStreak) setBestStreak(newStreak);
                return newStreak;
            });

            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FCD34D', '#F59E0B', '#D97706'] // Amber golds
            });

            // Play "ding" or positive sound effect could go here

            setTimeout(() => {
                nextQuestion();
            }, 1500);
        } else {
            // Incorrect
            setGameState('incorrect');
            setSessionStats(prev => ({ ...prev, total: prev.total + 1 }));
            setStreak(0);

            // Play "womp womp" or incorrect sound effect could go here
        }
    };

    const nextQuestion = () => {
        // End game after specific number of questions? 
        // For now, let's make it a 10-question round for the Game Hub integration.

        if (sessionStats.total >= 10) {
            finishGame();
        } else {
            generateQuestion(sounds);
        }
    };

    const finishGame = async () => {
        setGameState('finished');
        const duration = Math.floor((Date.now() - sessionStats.startTime) / 1000);
        // Calculate accuracy safely
        const accuracy = sessionStats.total > 0 ? Number(((sessionStats.correct / sessionStats.total) * 100).toFixed(2)) : 0;

        const result = await recordSession({
            game_mode: 'sound_match',
            score: score,
            correct_count: sessionStats.correct,
            total_questions: sessionStats.total,
            accuracy: accuracy,
            duration_seconds: duration,
            best_streak: bestStreak
        });

        setXpGained(result.xpEarned);

        if (result.xpEarned > 0) {
            confetti({
                particleCount: 150,
                spread: 100,
                origin: { y: 0.6 }
            });
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-amber-600">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Loading Quiz...</p>
            </div>
        );
    }

    if (sounds.length < 4) {
        return <div className="text-center py-20 text-amber-600">Not enough sounds to play. Please add more sounds to the library.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto px-4">
            {gameState === 'finished' ? (
                <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in duration-500">
                    <Trophy className="w-24 h-24 text-yellow-500 mb-6 drop-shadow-md animate-bounce" />
                    <h2 className="text-3xl font-black text-slate-800 mb-2">Session Complete!</h2>
                    <p className="text-slate-500 mb-8">Great job practicing your sounds.</p>

                    <div className="bg-white rounded-3xl p-8 shadow-xl w-full max-w-md border-b-4 border-slate-100 mb-8">
                        <div className="grid grid-cols-2 gap-8 mb-6">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-400 uppercase">Score</span>
                                <span className="text-3xl font-black text-slate-700">{score}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-400 uppercase">XP Earned</span>
                                <span className="text-3xl font-black text-amber-500">+{xpGained}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center border-t border-slate-100 pt-6">
                            <span className="text-sm font-bold text-slate-400 uppercase">Accuracy</span>
                            <span className="text-xl font-black text-slate-700">{Math.round((sessionStats.correct / Math.max(1, sessionStats.total)) * 100)}%</span>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => navigate('/phonics/games')}
                            className="px-6 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                        >
                            Back to Hub
                        </button>
                        <button
                            onClick={() => window.location.reload()} // Quick restart
                            className="px-6 py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 shadow-lg shadow-amber-200 transition-transform active:scale-95"
                        >
                            Play Again
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Score Header */}
                    <div className="flex justify-between items-center bg-white/60 backdrop-blur rounded-2xl p-4 mb-8 shadow-sm">
                        <button onClick={() => navigate('/phonics/games')} className="text-sm font-medium text-slate-500 hover:text-amber-600">
                            ← Quit
                        </button>
                        <div className="absolute left-1/2 -translate-x-1/2 font-bold text-slate-400 text-sm">
                            {sessionStats.total + 1} / 10
                        </div>
                        <div className="flex items-center gap-2">
                            <Trophy className={`w-6 h-6 ${streak > 2 ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Streak</span>
                                <span className="text-xl font-black text-slate-700">{streak} <span className="text-xs font-normal text-slate-400">/ Best: {bestStreak}</span></span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Score</span>
                            <span className="text-xl font-black text-amber-600">{score}</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-12">
                        {/* Play Button */}
                        <div className="relative">
                            <button
                                onClick={playTargetSound}
                                className={`
                        w-32 h-32 rounded-full flex items-center justify-center shadow-xl transition-all duration-300
                        ${isPlaying ? 'scale-95 bg-amber-400 shadow-inner' : 'bg-amber-500 hover:bg-amber-600 hover:scale-105'}
                    `}
                            >
                                <Volume2 className={`w-16 h-16 text-white ${isPlaying ? 'animate-pulse' : ''}`} />
                            </button>
                            <p className="text-center mt-4 text-amber-800 font-medium">Click to listen</p>
                        </div>

                        {/* Options Grid */}
                        <div className="grid grid-cols-2 gap-4 sm:gap-6 w-full max-w-2xl">
                            {options.map((option) => {
                                let cardStyle = "bg-white border-2 border-amber-100 hover:border-amber-300 hover:shadow-md"; // Default
                                if (gameState === 'correct' && option.id === currentSound?.id) {
                                    cardStyle = "bg-green-100 border-green-500 shadow-lg scale-105";
                                } else if (gameState === 'incorrect' && option.id !== currentSound?.id) {
                                    cardStyle = "bg-white border-amber-100 opacity-50"; // Dim others
                                } else if (gameState === 'incorrect' && option.id === currentSound?.id) {
                                    cardStyle = "bg-green-50 border-green-300 border-dashed"; // Show correct answer
                                }

                                return (
                                    <button
                                        key={option.id}
                                        disabled={gameState !== 'playing'}
                                        onClick={() => handleOptionClick(option)}
                                        className={`
                                    h-24 sm:h-32 rounded-2xl flex items-center justify-center text-3xl sm:text-5xl font-bold text-slate-700
                                    transition-all duration-300
                                    ${cardStyle}
                                `}
                                    >
                                        {option.sound_code}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Feedback Message */}
                        <div className="h-12 flex items-center justify-center">
                            {gameState === 'correct' && (
                                <div className="flex items-center gap-2 text-green-600 font-bold text-xl animate-in zoom-in slide-in-from-bottom-2">
                                    <Sparkles className="w-6 h-6" />
                                    <span>Correct! Great Job!</span>
                                </div>
                            )}
                            {gameState === 'incorrect' && (
                                <button
                                    onClick={nextQuestion}
                                    className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition-colors animate-in fade-in"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    <span>Try Next One</span>
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
